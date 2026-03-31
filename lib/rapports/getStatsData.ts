import { createClient } from '@/lib/supabase/server'
import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'
import { calculerPlage } from './periodes'
import { formatLocalDate } from '@/lib/utils/dates'
import type { PeriodeType, StatsData } from '@/types/rapports'

const ABSENCE_MAP: Record<string, { label: string; couleur: string }> = {
  C: { label: 'Congé annuel', couleur: '#f59e0b' },
  M: { label: 'Maladie', couleur: '#ef4444' },
  R: { label: 'Repos compensatoire', couleur: '#6c63ff' },
  A: { label: 'Absent non justifié', couleur: '#f97316' },
}

type Params = {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
}

export async function getStatsData(params: Params): Promise<StatsData> {
  const { periodeType, periodeDate, serviceId, bureauId } = params
  const { dateDebut, dateFin } = calculerPlage(periodeType, periodeDate)
  const annee = parseInt(periodeDate.slice(0, 4))
  const supabase = createClient()

  // --- Requête 1 : profiles actifs ---
  let profilesQuery = supabase
    .from('profiles')
    .select('id, prenom, nom, service_id, service:services(id, nom)')
    .eq('is_active', true)
    .order('nom')

  if (serviceId) {
    profilesQuery = profilesQuery.eq('service_id', serviceId)
  }

  const { data: profilesData } = await profilesQuery
  const profiles = profilesData ?? []
  const userIds = profiles.map((p) => p.id)

  // Charger services + bureaux pour les filtres
  const [servicesRes, bureauxRes] = await Promise.all([
    supabase.from('services').select('id, nom').order('nom'),
    supabase.from('bureaux').select('id, nom').order('nom'),
  ])
  const services = servicesRes.data ?? []
  const bureaux = bureauxRes.data ?? []

  if (userIds.length === 0) {
    return {
      tauxPresence: [], tauxGlobal: 0,
      absencesParType: [], totalAbsences: 0,
      topAbsences: [],
      potHeures: [],
      services, bureaux,
    }
  }

  // --- Requêtes 2, 3, 4 en parallèle ---
  const [dayStatusesRes, potHeuresRes, bureauSchedulesRes] = await Promise.all([
    supabase
      .from('day_statuses')
      .select('user_id, date, status')
      .in('user_id', userIds)
      .gte('date', dateDebut)
      .lte('date', dateFin),
    supabase
      .from('pot_heures')
      .select('user_id, solde_minutes')
      .in('user_id', userIds)
      .eq('annee', annee),
    bureauId
      ? supabase
          .from('user_bureau_schedule')
          .select('user_id, bureau_id, jour, valide_depuis')
          .in('user_id', userIds)
      : Promise.resolve({ data: null }),
  ])

  const dayStatuses = dayStatusesRes.data ?? []
  const potHeuresData = potHeuresRes.data ?? []
  const bureauSchedules = bureauSchedulesRes.data ?? []

  // --- Jours fériés + jours ouvrables ---
  const feries = joursFeriesPlage(dateDebut, dateFin)
  const joursOuvrablesList: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = formatLocalDate(cur)
    if (dow >= 1 && dow <= 5 && !feries.has(iso)) {
      joursOuvrablesList.push(iso)
    }
    cur.setDate(cur.getDate() + 1)
  }
  const joursOuvrables = joursOuvrablesList.length

  // --- Filtre bureau : construire index ---
  const bureauIndex = new Map<string, Map<number, { bureau_id: string; valide_depuis: string }[]>>()
  if (bureauId) {
    for (const bs of bureauSchedules) {
      if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
      const byJour = bureauIndex.get(bs.user_id)!
      if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
      byJour.get(bs.jour)!.push(bs)
    }
    bureauIndex.forEach((byJour) => {
      byJour.forEach((list) => {
        list.sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis))
      })
    })
  }

  // Déterminer quels travailleurs sont retenus (et pour quels jours)
  function isUserInBureau(userId: string, dateIso: string): boolean {
    if (!bureauId) return true
    const d = new Date(dateIso + 'T00:00:00')
    const dow = d.getDay()
    if (dow === 0 || dow === 6) return false
    const byJour = bureauIndex.get(userId)
    const list = byJour?.get(dow) ?? []
    const entry = list.find((bs) => bs.valide_depuis <= dateIso) ?? null
    return entry?.bureau_id === bureauId
  }

  // Filtrer les profiles si bureauId est fourni
  const filteredProfiles = bureauId
    ? profiles.filter((p) =>
        joursOuvrablesList.some((d) => isUserInBureau(p.id, d))
      )
    : profiles

  // --- Index day_statuses par userId → date → status ---
  const statusIndex = new Map<string, Map<string, string>>()
  for (const ds of dayStatuses) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, ds.status)
  }

  // --- TAUX DE PRÉSENCE par service ---
  const serviceMap = new Map<string, { nom: string; id: string; present: number; workers: number }>()
  let totalPresent = 0
  let totalWorkerDays = 0

  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string; nom: string } | null)
    const svcId = svc?.id ?? p.service_id
    const svcNom = svc?.nom ?? 'Inconnu'
    if (!serviceMap.has(svcId)) serviceMap.set(svcId, { nom: svcNom, id: svcId, present: 0, workers: 0 })
    const entry = serviceMap.get(svcId)!
    entry.workers++

    const userStatuses = statusIndex.get(p.id)
    let userPresent = 0
    for (const d of joursOuvrablesList) {
      if (bureauId && !isUserInBureau(p.id, d)) continue
      if (userStatuses?.get(d) === 'P') userPresent++
    }
    entry.present += userPresent
    totalPresent += userPresent
    totalWorkerDays += bureauId
      ? joursOuvrablesList.filter((d) => isUserInBureau(p.id, d)).length
      : joursOuvrables
  }

  // Calculer les jours effectifs par service (tenant compte du filtre bureau)
  const serviceDaysMap = new Map<string, number>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string } | null)
    const svcId = svc?.id ?? p.service_id
    const prevDays = serviceDaysMap.get(svcId) ?? 0
    const effectiveDays = bureauId
      ? joursOuvrablesList.filter((d) => isUserInBureau(p.id, d)).length
      : joursOuvrables
    serviceDaysMap.set(svcId, prevDays + effectiveDays)
  }

  const tauxPresence = Array.from(serviceMap.values()).map((s) => {
    const denominator = serviceDaysMap.get(s.id) ?? (joursOuvrables * s.workers)
    return {
      service: s.nom,
      serviceId: s.id,
      taux: denominator > 0 ? Math.round((s.present / denominator) * 100) : 0,
      joursPresent: s.present,
      joursOuvrables: denominator,
    }
  })
  const tauxGlobal = totalWorkerDays > 0 ? Math.round((totalPresent / totalWorkerDays) * 100) : 0

  // --- ABSENCES PAR TYPE ---
  const absenceCounts: Record<string, number> = { C: 0, M: 0, R: 0, A: 0 }
  const filteredUserIds = new Set(filteredProfiles.map((p) => p.id))
  for (const ds of dayStatuses) {
    if (!filteredUserIds.has(ds.user_id)) continue
    if (bureauId && !isUserInBureau(ds.user_id, ds.date)) continue
    if (ds.status in absenceCounts) {
      absenceCounts[ds.status]++
    }
  }
  const absencesParType = Object.entries(ABSENCE_MAP).map(([type, meta]) => ({
    type,
    label: meta.label,
    count: absenceCounts[type] ?? 0,
    couleur: meta.couleur,
  }))
  const totalAbsences = Object.values(absenceCounts).reduce((a, b) => a + b, 0)

  // --- TOP ABSENCES ---
  const userAbsences = new Map<string, { prenom: string; nom: string; service: string; m: number; a: number }>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { nom: string } | null)?.nom ?? 'Inconnu'
    userAbsences.set(p.id, { prenom: p.prenom, nom: p.nom, service: svc, m: 0, a: 0 })
  }
  for (const ds of dayStatuses) {
    const entry = userAbsences.get(ds.user_id)
    if (!entry) continue
    if (bureauId && !isUserInBureau(ds.user_id, ds.date)) continue
    if (ds.status === 'M') entry.m++
    if (ds.status === 'A') entry.a++
  }
  const topAbsences = Array.from(userAbsences.values())
    .map((e) => ({
      prenom: e.prenom,
      nom: e.nom,
      service: e.service,
      joursMaladie: e.m,
      joursAbsent: e.a,
      total: e.m + e.a,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // --- POT D'HEURES PAR SERVICE ---
  const potIndex = new Map<string, number>()
  for (const ph of potHeuresData) {
    potIndex.set(ph.user_id, ph.solde_minutes)
  }

  const potServiceMap = new Map<string, { nom: string; id: string; total: number; count: number }>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string; nom: string } | null)
    const svcId = svc?.id ?? p.service_id
    const svcNom = svc?.nom ?? 'Inconnu'
    if (!potServiceMap.has(svcId)) potServiceMap.set(svcId, { nom: svcNom, id: svcId, total: 0, count: 0 })
    const entry = potServiceMap.get(svcId)!
    entry.count++
    entry.total += potIndex.get(p.id) ?? 0
  }
  const potHeures = Array.from(potServiceMap.values()).map((s) => ({
    service: s.nom,
    serviceId: s.id,
    moyenneMinutes: s.count > 0 ? Math.round(s.total / s.count) : 0,
    nbTravailleurs: s.count,
  }))

  return {
    tauxPresence, tauxGlobal,
    absencesParType, totalAbsences,
    topAbsences,
    potHeures,
    services, bureaux,
  }
}
