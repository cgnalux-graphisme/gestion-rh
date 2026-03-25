'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getJoursOuvrables } from '@/lib/utils/dates'
import type {
  SoldeConges,
  PotHeures,
  Conge,
  Profile,
  RegimeTravail,
  ReassignationTemporaire,
  OptionHoraire,
  TypeConge,
} from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Type definitions ───

export type SoldeAlert = 'ok' | 'warning' | 'danger'

export type WorkerSoldes = {
  type: TypeConge
  soldeActuel: number
  apresApprobation: number
  unite: 'jours' | 'minutes'
  alert: SoldeAlert
  label: string
}

export type WorkerPresence = {
  userId: string
  prenom: string
  nom: string
  status: 'present' | 'conge' | 'maladie' | 'absent' | 'demandeur'
}

export type DayCoverage = {
  date: string
  bureauId: string
  bureauNom: string
  workers: WorkerPresence[]
  presentCount: number
  totalCount: number
  ratio: number
  alert: boolean
}

export type AvailableWorker = {
  userId: string
  prenom: string
  nom: string
  bureauActuel: string
}

export type DayAvailability = {
  date: string
  bureauId: string
  bureauNom: string
  availableWorkers: AvailableWorker[]
}

export type CongeContext = {
  conge: Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email' | 'option_horaire'> }
  soldes: WorkerSoldes
  coverage: DayCoverage[]
  availability: DayAvailability[]
  reassignationsExistantes: ReassignationTemporaire[]
}

// ─── assertAdmin (copied pattern — not exported from admin-actions) ───

async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')
  return user
}

// ─── Helpers ───

/** Returns 1-7 (1=Monday) from a 'YYYY-MM-DD' string, using noon to avoid TZ issues */
function safeDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  // JS getDay(): 0=Sun, 1=Mon...6=Sat → convert to 1=Mon...7=Sun
  const jsDay = d.getDay()
  return jsDay === 0 ? 7 : jsDay
}

// ─── getWorkerSoldes ───

async function getWorkerSoldes(
  admin: SupabaseClient,
  userId: string,
  congeType: TypeConge,
  nbJours: number,
  optionHoraire: OptionHoraire | null
): Promise<WorkerSoldes> {
  const annee = new Date().getFullYear()

  if (congeType === 'recuperation') {
    const { data: pot } = await admin
      .from('pot_heures')
      .select('*')
      .eq('user_id', userId)
      .eq('annee', annee)
      .single()

    const option = optionHoraire ?? 'B'
    const minutesParJour = option === 'A' ? 438 : 408
    const minutesNeeded = nbJours * minutesParJour
    const soldeActuel = (pot as PotHeures | null)?.solde_minutes ?? 0
    const apresApprobation = soldeActuel - minutesNeeded

    return {
      type: congeType,
      soldeActuel,
      apresApprobation,
      unite: 'minutes',
      alert: apresApprobation < 0 ? 'danger' : apresApprobation === 0 ? 'warning' : 'ok',
      label: `Pot d'heures: ${soldeActuel} min → ${apresApprobation} min après approbation`,
    }
  }

  // conge_annuel, repos_comp, maladie, autre
  const { data: solde } = await admin
    .from('soldes_conges')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', annee)
    .single()

  const s = solde as SoldeConges | null

  if (congeType === 'conge_annuel') {
    const total = (s?.conges_annuels_total ?? 0) + (s?.reliquat_conges_annuels ?? 0)
    const pris = s?.conges_annuels_pris ?? 0
    const soldeActuel = total - pris
    const apresApprobation = soldeActuel - nbJours
    return {
      type: congeType,
      soldeActuel,
      apresApprobation,
      unite: 'jours',
      alert: apresApprobation < 0 ? 'danger' : apresApprobation === 0 ? 'warning' : 'ok',
      label: `Congés annuels: ${soldeActuel}j → ${apresApprobation}j après approbation`,
    }
  }

  if (congeType === 'repos_comp') {
    const total = (s?.repos_comp_total ?? 0) + (s?.reliquat_repos_comp ?? 0)
    const pris = s?.repos_comp_pris ?? 0
    const soldeActuel = total - pris
    const apresApprobation = soldeActuel - nbJours
    return {
      type: congeType,
      soldeActuel,
      apresApprobation,
      unite: 'jours',
      alert: apresApprobation < 0 ? 'danger' : apresApprobation === 0 ? 'warning' : 'ok',
      label: `Repos compensatoires: ${soldeActuel}j → ${apresApprobation}j après approbation`,
    }
  }

  // maladie / autre — no balance tracking, always ok
  return {
    type: congeType,
    soldeActuel: 0,
    apresApprobation: 0,
    unite: 'jours',
    alert: 'ok',
    label: congeType === 'maladie' ? 'Maladie (pas de solde à vérifier)' : 'Autre (pas de solde à vérifier)',
  }
}

// ─── getCoverage ───

type CoverageResult = {
  coverage: DayCoverage[]
  dayStatusMap: Map<string, Map<string, string>> // date → userId → status
  regimeMap: Map<string, RegimeTravail>          // userId → latest regime
}

async function getCoverage(
  admin: SupabaseClient,
  userId: string,
  dateDebut: string,
  dateFin: string
): Promise<CoverageResult> {
  const joursOuvrables = getJoursOuvrables(dateDebut, dateFin)
  if (joursOuvrables.length === 0) {
    return { coverage: [], dayStatusMap: new Map(), regimeMap: new Map() }
  }

  // Determine which weekdays (1-5) we need
  const neededWeekdays = [...new Set(joursOuvrables.map(d => safeDayOfWeek(d)))]

  // Batch 1: Requester's bureau schedule for needed weekdays
  const { data: requesterSchedules } = await admin
    .from('user_bureau_schedule')
    .select('*, bureau:bureaux!bureau_id(id, nom, code)')
    .eq('user_id', userId)
    .in('jour', neededWeekdays)

  const schedules = (requesterSchedules ?? []) as Array<{
    bureau_id: string
    jour: number
    bureau: { id: string; nom: string; code: string }
  }>

  if (schedules.length === 0) {
    return { coverage: [], dayStatusMap: new Map(), regimeMap: new Map() }
  }

  // Build weekday → bureau mapping
  const weekdayBureauMap = new Map<number, { bureauId: string; bureauNom: string }>()
  for (const s of schedules) {
    weekdayBureauMap.set(s.jour, { bureauId: s.bureau_id, bureauNom: s.bureau.nom })
  }

  const bureauIds = [...new Set(schedules.map(s => s.bureau_id))]

  // Batch 2: All workers assigned to those bureaus on those weekdays (with profile)
  const { data: allBureauWorkers } = await admin
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, profile:profiles!user_id(prenom, nom)')
    .in('bureau_id', bureauIds)
    .in('jour', neededWeekdays)

  const bureauWorkers = (allBureauWorkers ?? []) as Array<{
    user_id: string
    bureau_id: string
    jour: number
    profile: { prenom: string; nom: string }
  }>

  // Collect all worker IDs
  const allWorkerIds = [...new Set(bureauWorkers.map(w => w.user_id))]

  if (allWorkerIds.length === 0) {
    return { coverage: [], dayStatusMap: new Map(), regimeMap: new Map() }
  }

  // Batch 3: All day_statuses for those workers in the date range
  const { data: dayStatuses } = await admin
    .from('day_statuses')
    .select('user_id, date, status')
    .in('user_id', allWorkerIds)
    .gte('date', dateDebut)
    .lte('date', dateFin)

  // Build dayStatusMap: date → userId → status
  const dayStatusMap = new Map<string, Map<string, string>>()
  for (const ds of (dayStatuses ?? [])) {
    if (!dayStatusMap.has(ds.date)) dayStatusMap.set(ds.date, new Map())
    dayStatusMap.get(ds.date)!.set(ds.user_id, ds.status)
  }

  // Batch 4: All regime_travail for those workers (filter by date range)
  const { data: regimes } = await admin
    .from('regime_travail')
    .select('*')
    .in('user_id', allWorkerIds)
    .lte('date_debut', dateFin)
    .or(`date_fin.is.null,date_fin.gte.${dateDebut}`)
    .order('date_debut', { ascending: false })

  // Build regimeMap: userId → latest applicable regime
  const regimeMap = new Map<string, RegimeTravail>()
  for (const r of (regimes ?? []) as RegimeTravail[]) {
    // Keep only the first (latest) per user since ordered desc
    if (!regimeMap.has(r.user_id)) {
      regimeMap.set(r.user_id, r)
    }
  }

  // Build worker lookup: (bureauId, jour) → workers[]
  const workersByBureauDay = new Map<string, typeof bureauWorkers>()
  for (const w of bureauWorkers) {
    const key = `${w.bureau_id}:${w.jour}`
    if (!workersByBureauDay.has(key)) workersByBureauDay.set(key, [])
    workersByBureauDay.get(key)!.push(w)
  }

  // Loop through days using in-memory Maps only
  const coverage: DayCoverage[] = []
  for (const date of joursOuvrables) {
    const dow = safeDayOfWeek(date)
    const bureauInfo = weekdayBureauMap.get(dow)
    if (!bureauInfo) continue

    const key = `${bureauInfo.bureauId}:${dow}`
    const dayWorkers = workersByBureauDay.get(key) ?? []
    const dateStatuses = dayStatusMap.get(date)

    const workers: WorkerPresence[] = dayWorkers.map(w => {
      // Check if this is the requester
      if (w.user_id === userId) {
        return {
          userId: w.user_id,
          prenom: w.profile.prenom,
          nom: w.profile.nom,
          status: 'demandeur' as const,
        }
      }

      const st = dateStatuses?.get(w.user_id)

      // Check regime — if worker has jour_off matching this day, consider absent
      const regime = regimeMap.get(w.user_id)
      if (regime?.jour_off === dow) {
        return {
          userId: w.user_id,
          prenom: w.profile.prenom,
          nom: w.profile.nom,
          status: 'absent' as const,
        }
      }

      let status: WorkerPresence['status'] = 'present'
      if (st === 'C' || st === 'R') status = 'conge'
      else if (st === 'M') status = 'maladie'
      else if (st === 'A' || st === 'I') status = 'absent'

      return {
        userId: w.user_id,
        prenom: w.profile.prenom,
        nom: w.profile.nom,
        status,
      }
    })

    const presentCount = workers.filter(w => w.status === 'present').length
    const totalCount = workers.length
    const ratio = totalCount > 0 ? presentCount / totalCount : 0

    coverage.push({
      date,
      bureauId: bureauInfo.bureauId,
      bureauNom: bureauInfo.bureauNom,
      workers,
      presentCount,
      totalCount,
      ratio,
      alert: presentCount === 0 || ratio < 0.5,
    })
  }

  return { coverage, dayStatusMap, regimeMap }
}

// ─── getAvailability ───

async function getAvailability(
  admin: SupabaseClient,
  alertDays: DayCoverage[],
  dayStatusMap: Map<string, Map<string, string>>,
  regimeMap: Map<string, RegimeTravail>
): Promise<DayAvailability[]> {
  if (alertDays.length === 0) return []

  // Collect bureau IDs to exclude and weekdays needed
  const alertBureauIds = [...new Set(alertDays.map(d => d.bureauId))]
  const alertWeekdays = [...new Set(alertDays.map(d => safeDayOfWeek(d.date)))]
  const dateRange = {
    min: alertDays.reduce((a, b) => a.date < b.date ? a : b).date,
    max: alertDays.reduce((a, b) => a.date > b.date ? a : b).date,
  }

  // Fetch workers from OTHER bureaus on those weekdays
  const { data: otherWorkers } = await admin
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, profile:profiles!user_id(prenom, nom), bureau:bureaux!bureau_id(nom)')
    .in('jour', alertWeekdays)

  const candidates = (otherWorkers ?? []).filter(
    (w: { bureau_id: string }) => !alertBureauIds.includes(w.bureau_id)
  ) as Array<{
    user_id: string
    bureau_id: string
    jour: number
    profile: { prenom: string; nom: string }
    bureau: { nom: string }
  }>

  if (candidates.length === 0) return alertDays.map(d => ({
    date: d.date,
    bureauId: d.bureauId,
    bureauNom: d.bureauNom,
    availableWorkers: [],
  }))

  // Collect candidate user IDs not yet in dayStatusMap
  const candidateIds = [...new Set(candidates.map(c => c.user_id))]
  const existingIds = new Set<string>()
  for (const [, userMap] of dayStatusMap) {
    for (const uid of userMap.keys()) existingIds.add(uid)
  }
  const missingIds = candidateIds.filter(id => !existingIds.has(id))

  // Fetch missing day_statuses + regimes
  if (missingIds.length > 0) {
    const [{ data: extraStatuses }, { data: extraRegimes }] = await Promise.all([
      admin
        .from('day_statuses')
        .select('user_id, date, status')
        .in('user_id', missingIds)
        .gte('date', dateRange.min)
        .lte('date', dateRange.max),
      admin
        .from('regime_travail')
        .select('*')
        .in('user_id', missingIds)
        .lte('date_debut', dateRange.max)
        .or(`date_fin.is.null,date_fin.gte.${dateRange.min}`)
        .order('date_debut', { ascending: false }),
    ])

    for (const ds of (extraStatuses ?? [])) {
      if (!dayStatusMap.has(ds.date)) dayStatusMap.set(ds.date, new Map())
      dayStatusMap.get(ds.date)!.set(ds.user_id, ds.status)
    }

    for (const r of (extraRegimes ?? []) as RegimeTravail[]) {
      if (!regimeMap.has(r.user_id)) {
        regimeMap.set(r.user_id, r)
      }
    }
  }

  // Build candidate lookup: weekday → candidates[]
  const candidatesByDay = new Map<number, typeof candidates>()
  for (const c of candidates) {
    if (!candidatesByDay.has(c.jour)) candidatesByDay.set(c.jour, [])
    candidatesByDay.get(c.jour)!.push(c)
  }

  const availability: DayAvailability[] = []
  for (const day of alertDays) {
    const dow = safeDayOfWeek(day.date)
    const dayCandidates = candidatesByDay.get(dow) ?? []
    const dateStatuses = dayStatusMap.get(day.date)

    const availableWorkers: AvailableWorker[] = []
    for (const c of dayCandidates) {
      const st = dateStatuses?.get(c.user_id)
      // Skip if on leave, sick, or absent
      if (st === 'C' || st === 'R' || st === 'M' || st === 'A' || st === 'I') continue

      // Skip if regime jour_off matches
      const regime = regimeMap.get(c.user_id)
      if (regime?.jour_off === dow) continue

      availableWorkers.push({
        userId: c.user_id,
        prenom: c.profile.prenom,
        nom: c.profile.nom,
        bureauActuel: c.bureau.nom,
      })
    }

    availability.push({
      date: day.date,
      bureauId: day.bureauId,
      bureauNom: day.bureauNom,
      availableWorkers,
    })
  }

  return availability
}

// ─── Main export ───

export async function getCongeContext(
  congeId: string
): Promise<{ error?: string; data?: CongeContext }> {
  await assertAdmin()
  const admin = createAdminClient()

  // Fetch conge with profile (including option_horaire)
  const { data: conge, error: congeError } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email, option_horaire)')
    .eq('id', congeId)
    .single()

  if (congeError || !conge) {
    return { error: 'Demande de congé introuvable' }
  }

  const typedConge = conge as Conge & {
    profile: Pick<Profile, 'prenom' | 'nom' | 'email' | 'option_horaire'>
  }

  // Fetch worker soldes
  const soldes = await getWorkerSoldes(
    admin,
    typedConge.user_id,
    typedConge.type,
    typedConge.nb_jours,
    typedConge.profile.option_horaire
  )

  // Fetch coverage (also returns shared maps)
  const { coverage, dayStatusMap, regimeMap } = await getCoverage(
    admin,
    typedConge.user_id,
    typedConge.date_debut,
    typedConge.date_fin
  )

  // Fetch availability for alert days
  const alertDays = coverage.filter(d => d.alert)
  const availability = await getAvailability(admin, alertDays, dayStatusMap, regimeMap)

  // Fetch existing reassignations for this conge
  const { data: reassignations } = await admin
    .from('reassignations_temporaires')
    .select('*, profile:profiles!travailleur_id(prenom, nom, email), bureau:bureaux!bureau_id(nom, code)')
    .eq('conge_id', congeId)
    .order('date', { ascending: true })

  return {
    data: {
      conge: typedConge,
      soldes,
      coverage,
      availability,
      reassignationsExistantes: (reassignations ?? []) as ReassignationTemporaire[],
    },
  }
}
