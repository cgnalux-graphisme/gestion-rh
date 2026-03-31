import { createClient } from '@/lib/supabase/server'
import { isEte } from '@/lib/horaires/utils'
import { formatLocalDate, todayBrussels } from '@/lib/utils/dates'
import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'
import type { HorairesBureauHebdo, DayStatus } from '@/types/database'
import type {
  StatutSimple,
  CoverageStatus,
  JourBureau,
  TravailleurBureau,
  CalendrierBureauData,
} from '@/types/calendrier-bureau'

type Params = {
  bureauCode: string
  dateDebut: string
  dateFin: string
}

/**
 * Fetches calendar data for the worker-facing bureau view.
 * Returns workers assigned to the selected bureau (permanent + temp),
 * their simplified statuses, coverage alerts, and permanent workers.
 */
export async function getCalendrierBureauData(params: Params): Promise<CalendrierBureauData> {
  const { bureauCode, dateDebut, dateFin } = params
  const supabase = createClient()

  // ─── 1. Fetch bureau + all bureaux first (need bureau.id for filtered queries) ───
  const [bureauRes, allBureauxRes] = await Promise.all([
    supabase.from('bureaux').select('id, nom, code, horaires_normaux, horaires_ete').eq('code', bureauCode).single(),
    supabase.from('bureaux').select('id, nom, code').order('nom'),
  ])

  const bureau = bureauRes.data
  if (!bureau) throw new Error(`Bureau "${bureauCode}" introuvable`)
  const allBureaux = allBureauxRes.data ?? []

  // ─── 2. Parallel queries (filtered by bureau.id where needed) ───
  const [
    profilesRes,
    schedulesRes,
    tempAffectRes,
    dayStatusesRes,
    congesRes,
    bureauServicesRes,
    seuilsRes,
  ] = await Promise.all([
    // Profils actifs avec service
    supabase
      .from('profiles')
      .select('id, prenom, nom, service_id, is_active, service:services(id, nom, code)')
      .eq('is_active', true)
      .order('nom'),
    // Schedules permanents (tous, triés par valide_depuis desc)
    supabase
      .from('user_bureau_schedule')
      .select('user_id, bureau_id, jour, valide_depuis')
      .order('valide_depuis', { ascending: false }),
    // Affectations temporaires dans la plage
    supabase
      .from('bureau_affectation_temp')
      .select('user_id, bureau_id, date')
      .gte('date', dateDebut)
      .lte('date', dateFin),
    // Day statuses dans la plage
    supabase
      .from('day_statuses')
      .select('user_id, date, status')
      .gte('date', dateDebut)
      .lte('date', dateFin),
    // Congés approuvés chevauchant la plage
    supabase
      .from('conges')
      .select('user_id, date_debut, date_fin')
      .eq('statut', 'approuve')
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut),
    // Services présents dans CE bureau
    supabase
      .from('bureau_services')
      .select('service_id')
      .eq('bureau_id', bureau.id),
    // Seuils pour CE bureau
    supabase
      .from('bureau_service_seuils')
      .select('service_id, seuil_minimum')
      .eq('bureau_id', bureau.id),
  ])

  const schedules = schedulesRes.data ?? []
  const tempAffect = tempAffectRes.data ?? []
  const dayStatuses = dayStatusesRes.data ?? []
  const conges = congesRes.data ?? []

  // Bureau service IDs et seuils
  const bureauServiceIdsSet = new Set(
    (bureauServicesRes.data ?? []).map((bs: { service_id: string }) => bs.service_id)
  )
  const seuilMap = new Map<string, number>(
    (seuilsRes.data ?? []).map((s: { service_id: string; seuil_minimum: number }) =>
      [s.service_id, s.seuil_minimum] as [string, number]
    )
  )

  // ─── 3. Index maps ───

  // day_statuses: key = "userId|date"
  const statusIndex = new Map<string, DayStatus>()
  for (const ds of dayStatuses) {
    statusIndex.set(`${ds.user_id}|${ds.date}`, ds.status as DayStatus)
  }

  // congés approuvés: key = userId → array of { date_debut, date_fin }
  const congesIndex = new Map<string, { date_debut: string; date_fin: string }[]>()
  for (const c of conges) {
    const arr = congesIndex.get(c.user_id) ?? []
    arr.push({ date_debut: c.date_debut, date_fin: c.date_fin })
    congesIndex.set(c.user_id, arr)
  }

  // temp affectations: key = "userId|date" → bureau_id
  const tempIndex = new Map<string, string>()
  for (const ta of tempAffect) {
    tempIndex.set(`${ta.user_id}|${ta.date}`, ta.bureau_id)
  }

  // schedules: key = "userId|jour" → bureau_id (most recent valide_depuis first, already sorted)
  const scheduleIndex = new Map<string, string>()
  for (const s of schedules) {
    const key = `${s.user_id}|${s.jour}`
    if (!scheduleIndex.has(key)) {
      scheduleIndex.set(key, s.bureau_id)
    }
  }

  // ─── 4. Generate date range ───
  const dates: string[] = []
  const cur = new Date(dateDebut + 'T12:00:00')
  const end = new Date(dateFin + 'T12:00:00')
  while (cur <= end) {
    dates.push(formatLocalDate(cur))
    cur.setDate(cur.getDate() + 1)
  }

  // Jours fériés (Map<string, string>)
  const feriesMap = joursFeriesPlage(dateDebut, dateFin)

  // ─── 5. Normalize profile service (Supabase join returns array) ───
  const profiles = (profilesRes.data ?? []).map((p: Record<string, unknown>) => {
    const svc = Array.isArray(p.service)
      ? (p.service[0] as { id: string; nom: string; code: string } | undefined)
      : (p.service as { id: string; nom: string; code: string } | null)
    return {
      id: p.id as string,
      prenom: p.prenom as string,
      nom: p.nom as string,
      service_id: svc?.id ?? '',
      service_nom: svc?.nom ?? '',
      service_code: svc?.code ?? '',
    }
  })

  // ─── 6. Separate permanents ───
  const permanents = profiles.filter(p => p.service_code === 'permanent')
  const nonPermanents = profiles.filter(p => p.service_code !== 'permanent')

  // ─── 7. Determine which workers appear in this bureau ───
  function isInBureau(userId: string, dateStr: string): boolean {
    // Check temp affectation first (overrides permanent)
    const tempBureau = tempIndex.get(`${userId}|${dateStr}`)
    if (tempBureau) return tempBureau === bureau!.id

    // Check permanent schedule
    const d = new Date(dateStr + 'T12:00:00')
    const dow = d.getDay()
    if (dow === 0 || dow === 6) return false
    const scheduleBureau = scheduleIndex.get(`${userId}|${dow}`)
    return scheduleBureau === bureau!.id
  }

  // Workers who appear at least once in this bureau during the date range
  const workerIds = new Set<string>()
  const workerTempDates = new Map<string, Set<string>>()
  for (const p of nonPermanents) {
    for (const dateStr of dates) {
      if (isInBureau(p.id, dateStr)) {
        workerIds.add(p.id)
        const tempBureau = tempIndex.get(`${p.id}|${dateStr}`)
        if (tempBureau === bureau.id) {
          const set = workerTempDates.get(p.id) ?? new Set()
          set.add(dateStr)
          workerTempDates.set(p.id, set)
        }
      }
    }
  }

  // ─── 8. Compute simplified status per worker per day ───
  const todayStr = todayBrussels()

  function getStatut(userId: string, dateStr: string): StatutSimple {
    const d = new Date(dateStr + 'T12:00:00')
    const dow = d.getDay()
    if (dow === 0 || dow === 6) return '-'
    if (feriesMap.has(dateStr)) return 'F'

    // Check day_status
    const ds = statusIndex.get(`${userId}|${dateStr}`)
    if (ds === 'C') return 'C'
    if (ds === 'M') return 'M'
    if (ds === 'P') return 'P'
    if (ds === 'F') return 'F'
    // R, A, G → shown as absent (empty)
    if (ds === 'R' || ds === 'A' || ds === 'G') return ''

    // Check approved leave
    const userConges = congesIndex.get(userId) ?? []
    for (const c of userConges) {
      if (dateStr >= c.date_debut && dateStr <= c.date_fin) return 'C'
    }

    // Future date → empty, past/today → assume present if in bureau
    if (dateStr > todayStr) return ''
    if (isInBureau(userId, dateStr)) return 'P'
    return ''
  }

  const travailleurs: TravailleurBureau[] = nonPermanents
    .filter(p => workerIds.has(p.id))
    .map(p => ({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      service_id: p.service_id,
      service_nom: p.service_nom,
      jours: dates.map(dateStr => ({
        date: dateStr,
        statut: getStatut(p.id, dateStr),
      })),
      is_temp: workerTempDates.has(p.id),
    }))
    .sort((a, b) => a.service_nom.localeCompare(b.service_nom) || a.nom.localeCompare(b.nom))

  // ─── 9. Compute coverage per day ───
  // Build a map of service_id → service_nom from bureauServiceIdsSet
  const serviceNomMap = new Map<string, string>()
  for (const p of profiles) {
    if (bureauServiceIdsSet.has(p.service_id) && !serviceNomMap.has(p.service_id)) {
      serviceNomMap.set(p.service_id, p.service_nom)
    }
  }

  const jours: JourBureau[] = dates.map(dateStr => {
    const d = new Date(dateStr + 'T12:00:00')
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const isFerie = feriesMap.has(dateStr)

    const coverage: CoverageStatus[] = []

    if (!isWeekend && !isFerie) {
      for (const serviceId of Array.from(bureauServiceIdsSet)) {
        const seuil = seuilMap.get(serviceId) ?? 1
        const serviceNom = serviceNomMap.get(serviceId) ?? ''

        // Count present workers of this service in this bureau on this day
        const presents = travailleurs.filter(t =>
          t.service_id === serviceId &&
          t.jours.find(j => j.date === dateStr)?.statut === 'P'
        ).length

        coverage.push({
          service_id: serviceId,
          service_nom: serviceNom,
          presents,
          seuil,
          alerte: presents < seuil,
        })
      }
    }

    return { date: dateStr, coverage }
  })

  // ─── 10. Permanents status for today ───
  const permanentsData = permanents.map(p => ({
    id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    statut_aujourdhui: getStatut(p.id, todayStr),
  }))

  // ─── 11. Bureau horaires (current season) ───
  const ete = isEte(new Date())
  const horaires = ete ? bureau.horaires_ete as HorairesBureauHebdo : bureau.horaires_normaux as HorairesBureauHebdo

  return {
    bureau: { id: bureau.id, nom: bureau.nom, code: bureau.code, horaires },
    travailleurs,
    permanents: permanentsData,
    jours,
    bureaux: allBureaux,
  }
}
