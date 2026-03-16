import { createClient } from '@/lib/supabase/server'
import type { TravailleurCalendrier, JourCalendrier, StatutJour } from '@/types/calendrier'
import type { TypeConge } from '@/types/database'
import { joursFeriesPlage } from './joursFeries'

const TYPE_CONGE_LABEL: Record<TypeConge, string> = {
  conge_annuel: 'Congé annuel',
  repos_comp: 'Repos compensatoire',
  maladie: 'Maladie',
  autre: 'Autre',
}

const DAY_STATUS_MAP: Record<string, { statut: StatutJour; label?: string }> = {
  P: { statut: 'present' },
  A: { statut: 'absent' },
  C: { statut: 'conge', label: 'Congé annuel' },
  M: { statut: 'conge', label: 'Maladie' },
  R: { statut: 'conge', label: 'Repos compensatoire' },
}
// 'F' est géré séparément car le label dépend de joursFeries

type Params = {
  dateDebut: string
  dateFin: string
  serviceId?: string
  bureauId?: string
}

// Note : le retour étend la signature de la spec (TravailleurCalendrier[] uniquement)
// pour y inclure services + bureaux nécessaires aux dropdowns de CalendrierFiltres.
// Les pages (Tasks 8/9) déstructurent { travailleurs, services, bureaux }.
type GetCalendrierDataResult = {
  travailleurs: TravailleurCalendrier[]
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}

export async function getCalendrierData(params: Params): Promise<GetCalendrierDataResult> {
  const { dateDebut, dateFin, serviceId, bureauId } = params
  const supabase = createClient()

  // --- Requête 1 : profiles actifs ---
  let profilesQuery = supabase
    .from('profiles')
    .select('id, prenom, nom, service:services(id, nom)')
    .eq('is_active', true)
    .order('nom')

  if (serviceId) {
    profilesQuery = profilesQuery.eq('service_id', serviceId)
  }

  const { data: profilesData } = await profilesQuery
  const profiles = profilesData ?? []
  const userIds = profiles.map((p) => p.id)

  if (userIds.length === 0) {
    const [svc, bur] = await Promise.all([
      supabase.from('services').select('id, nom').order('nom'),
      supabase.from('bureaux').select('id, nom').order('nom'),
    ])
    return { travailleurs: [], services: svc.data ?? [], bureaux: bur.data ?? [] }
  }

  // --- Requêtes 2, 3, 4, 5 en parallèle ---
  const [dayStatusesRes, congesRes, bureauSchedulesRes, servicesRes, bureauxRes] = await Promise.all([
    // Requête 2 : day_statuses
    supabase
      .from('day_statuses')
      .select('user_id, date, status')
      .in('user_id', userIds)
      .gte('date', dateDebut)
      .lte('date', dateFin),

    // Requête 3 : conges approuvés chevauchant la plage
    supabase
      .from('conges')
      .select('user_id, type, date_debut, date_fin')
      .eq('statut', 'approuve')
      .in('user_id', userIds)
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut),

    // Requête 4 : user_bureau_schedule (toutes entrées pour ces users)
    bureauId
      ? supabase
          .from('user_bureau_schedule')
          .select('user_id, bureau_id, jour, valide_depuis')
          .in('user_id', userIds)
      : Promise.resolve({ data: null }),

    // Requête 5 : listes complètes services + bureaux
    supabase.from('services').select('id, nom').order('nom'),
    supabase.from('bureaux').select('id, nom').order('nom'),
  ])

  const dayStatuses = dayStatusesRes.data ?? []
  const conges = congesRes.data ?? []
  const bureauSchedules = bureauSchedulesRes.data ?? []
  const services = servicesRes.data ?? []
  const bureaux = bureauxRes.data ?? []

  // --- Jours fériés ---
  const feries = joursFeriesPlage(dateDebut, dateFin)

  // --- Génération de la liste de dates de la plage ---
  const dates: string[] = []
  const cur = new Date(dateDebut)
  const end = new Date(dateFin)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  // --- Index day_statuses par userId → date → record ---
  const statusIndex = new Map<string, Map<string, { status: string }>>()
  for (const ds of dayStatuses) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, { status: ds.status })
  }

  // --- Index conges par userId → liste ---
  const congesIndex = new Map<string, typeof conges>()
  for (const c of conges) {
    if (!congesIndex.has(c.user_id)) congesIndex.set(c.user_id, [])
    congesIndex.get(c.user_id)!.push(c)
  }

  // --- Index bureau_schedule par userId → jourSemaine → liste triée par valide_depuis desc ---
  const bureauIndex = new Map<string, Map<number, typeof bureauSchedules>>()
  if (bureauId) {
    for (const bs of bureauSchedules) {
      if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
      const byJour = bureauIndex.get(bs.user_id)!
      if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
      byJour.get(bs.jour)!.push(bs)
    }
    // Trier chaque liste par valide_depuis DESC
    bureauIndex.forEach((byJour) => {
      byJour.forEach((list) => {
        list.sort((a: { valide_depuis: string }, b: { valide_depuis: string }) =>
          b.valide_depuis.localeCompare(a.valide_depuis)
        )
      })
    })
  }

  // --- Calculer le statut d'un jour pour un travailleur ---
  function getStatut(userId: string, date: string): JourCalendrier {
    const d = new Date(date)
    const dow = d.getDay() // 0=dim, 1=lun, ..., 6=sam

    // Priorité 1 : Weekend
    if (dow === 0 || dow === 6) return { date, statut: 'weekend' }

    // Priorité 2 : Jour férié
    const ferieNom = feries.get(date)
    if (ferieNom) return { date, statut: 'ferie', label: ferieNom }

    // Filtre bureau : si bureauId et ce jour n'est pas dans le bureau → vide
    if (bureauId) {
      const jourIso = dow // 1=lun...5=ven (dow === 0 ou 6 déjà exclus)
      const byJour = bureauIndex.get(userId)
      const list = byJour?.get(jourIso) ?? []
      // Trouver l'entrée valide_depuis <= date la plus récente
      const entry = list.find((bs) => bs.valide_depuis <= date) ?? null
      if (!entry || entry.bureau_id !== bureauId) {
        return { date, statut: 'vide' }
      }
    }

    // Priorité 3 : Congé approuvé couvrant cette date
    const mesConges = congesIndex.get(userId) ?? []
    const conge = mesConges.find((c) => c.date_debut <= date && c.date_fin >= date)
    if (conge) {
      return {
        date,
        statut: 'conge',
        label: TYPE_CONGE_LABEL[conge.type as TypeConge] ?? 'Congé',
      }
    }

    // Priorité 4 : DayStatusRecord
    const ds = statusIndex.get(userId)?.get(date)
    if (ds) {
      if (ds.status === 'F') {
        // Si on atteint ici, la date n'est pas dans joursFeries (priorité 2 l'aurait pris avant)
        // donc le label est toujours générique
        return { date, statut: 'ferie', label: 'Jour férié' }
      }
      const mapped = DAY_STATUS_MAP[ds.status]
      if (mapped) return { date, statut: mapped.statut, label: mapped.label }
    }

    // Priorité 5 : Vide
    return { date, statut: 'vide' }
  }

  // --- Assembler les travailleurs ---
  // Filtrer : si bureauId, inclure un travailleur uniquement s'il apparaît dans le bureau pour ≥1 jour ouvrable
  const travailleurs: TravailleurCalendrier[] = []

  for (const profile of profiles) {
    const jours = dates.map((date) => getStatut(profile.id, date))

    if (bureauId) {
      // Un travailleur apparaît si au moins un jour de la période l'inclut dans ce bureau
      const hasAnyBureauDay = dates.some((date) => {
        const d = new Date(date)
        const dow = d.getDay()
        if (dow === 0 || dow === 6) return false
        if (feries.get(date)) return false
        const jourIso = dow
        const byJour = bureauIndex.get(profile.id)
        const list = byJour?.get(jourIso) ?? []
        const entry = list.find((bs) => bs.valide_depuis <= date) ?? null
        return entry?.bureau_id === bureauId
      })
      if (!hasAnyBureauDay) continue
    }

    travailleurs.push({
      id: profile.id,
      prenom: profile.prenom,
      nom: profile.nom,
      service: (profile.service as unknown as { nom: string } | null)?.nom ?? '',
      jours,
    })
  }

  return { travailleurs, services, bureaux }
}
