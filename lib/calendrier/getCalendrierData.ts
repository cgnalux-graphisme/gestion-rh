import { createClient } from '@/lib/supabase/server'
import type { TravailleurCalendrier, JourCalendrier, StatutJour, IndicateursJour, IndicateurPointage } from '@/types/calendrier'
import type { TypeConge, HorairesHebdo, Pointage, OptionHoraire, HorairesTravailHebdo } from '@/types/database'
import { joursFeriesPlage } from './joursFeries'
import { isEte, getHorairesJour } from '@/lib/horaires/utils'
import { formatLocalDate, todayBrussels } from '@/lib/utils/dates'

const TYPE_CONGE_LABEL: Record<TypeConge, string> = {
  conge_annuel: 'Congé annuel',
  repos_comp: 'Repos compensatoire',
  recuperation: 'Récupération',
  maladie: 'Maladie',
  autre: 'Autre',
}

const DAY_STATUS_MAP: Record<string, { statut: StatutJour; label?: string }> = {
  P: { statut: 'present' },
  A: { statut: 'absent' },
  C: { statut: 'conge', label: 'Congé annuel' },
  M: { statut: 'maladie', label: 'Maladie' },
  R: { statut: 'conge', label: 'Repos compensatoire' },
  G: { statut: 'greve', label: 'Grève' },
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
  bureaux: { id: string; nom: string; code: string }[]
}

export async function getCalendrierData(params: Params): Promise<GetCalendrierDataResult> {
  const { dateDebut, dateFin, serviceId, bureauId } = params
  const supabase = createClient()

  // --- Requête 1 : profiles actifs ---
  let profilesQuery = supabase
    .from('profiles')
    .select('id, prenom, nom, option_horaire, service:services(id, nom)')
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
      supabase.from('bureaux').select('id, nom, code').order('nom'),
    ])
    return { travailleurs: [], services: svc.data ?? [], bureaux: bur.data ?? [] }
  }

  // --- Requêtes 2, 3, 4, 5, 6, 7 en parallèle ---
  const [dayStatusesRes, congesRes, bureauSchedulesRes, servicesRes, bureauxRes, pointageRes, allSchedulesRes, paramOptRes] = await Promise.all([
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
      .select('user_id, type, date_debut, date_fin, demi_journee')
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
    supabase.from('bureaux').select('id, nom, code').order('nom'),

    // Requête 6 : pointages pour détection d'anomalies + indicateurs
    supabase
      .from('pointage')
      .select('user_id, date, arrivee, midi_out, midi_in, depart, corrections_appliquees')
      .in('user_id', userIds)
      .gte('date', dateDebut)
      .lte('date', dateFin),

    // Requête 7 : tous les bureau_schedules avec horaires (pour anomalies)
    supabase
      .from('user_bureau_schedule')
      .select('user_id, bureau_id, jour, valide_depuis, bureau:bureaux(horaires_normaux, horaires_ete)')
      .in('user_id', userIds)
      .order('valide_depuis', { ascending: false }),

    // Requête 8 : parametres_options (horaires par option A/B)
    supabase
      .from('parametres_options')
      .select('option_horaire, horaires, horaires_ete'),
  ])

  const dayStatuses = dayStatusesRes.data ?? []
  const conges = congesRes.data ?? []
  const bureauSchedules = bureauSchedulesRes.data ?? []
  const services = servicesRes.data ?? []
  const bureaux = bureauxRes.data ?? []
  const pointages = (pointageRes.data ?? []) as Pick<Pointage, 'user_id' | 'date' | 'arrivee' | 'midi_out' | 'midi_in' | 'depart' | 'corrections_appliquees'>[]
  const allSchedulesRaw = allSchedulesRes.data ?? []
  const allSchedules = allSchedulesRaw.map((s: Record<string, unknown>) => ({
    user_id: s.user_id as string,
    bureau_id: s.bureau_id as string,
    jour: s.jour as number,
    valide_depuis: s.valide_depuis as string,
    bureau: Array.isArray(s.bureau) ? (s.bureau[0] as { horaires_normaux: HorairesHebdo; horaires_ete: HorairesHebdo } | undefined) ?? null : (s.bureau as { horaires_normaux: HorairesHebdo; horaires_ete: HorairesHebdo } | null),
  }))

  // --- Jours fériés ---
  const feries = joursFeriesPlage(dateDebut, dateFin)

  // --- Génération de la liste de dates de la plage ---
  const dates: string[] = []
  const cur = new Date(dateDebut)
  const end = new Date(dateFin)
  while (cur <= end) {
    dates.push(formatLocalDate(cur))
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

  // --- Index pointages par userId → date → pointage ---
  type PointageIndexEntry = Pick<Pointage, 'arrivee' | 'midi_out' | 'midi_in' | 'depart' | 'corrections_appliquees'>
  const pointageIndex = new Map<string, Map<string, PointageIndexEntry>>()
  for (const p of pointages) {
    if (!pointageIndex.has(p.user_id)) pointageIndex.set(p.user_id, new Map())
    pointageIndex.get(p.user_id)!.set(p.date, {
      arrivee: p.arrivee,
      midi_out: p.midi_out,
      midi_in: p.midi_in,
      depart: p.depart,
      corrections_appliquees: p.corrections_appliquees ?? {},
    })
  }

  // --- Index all schedules par userId → jour → liste triée par valide_depuis DESC ---
  const allScheduleIndex = new Map<string, Map<number, typeof allSchedules>>()
  for (const s of allSchedules) {
    if (!allScheduleIndex.has(s.user_id)) allScheduleIndex.set(s.user_id, new Map())
    const byJour = allScheduleIndex.get(s.user_id)!
    if (!byJour.has(s.jour)) byJour.set(s.jour, [])
    byJour.get(s.jour)!.push(s)
  }

  // --- Index parametres_options par option_horaire ---
  const paramOptionsRaw = (paramOptRes.data ?? []) as { option_horaire: string; horaires: HorairesTravailHebdo; horaires_ete: HorairesTravailHebdo }[]
  const paramOptionsMap = new Map<string, { horaires: HorairesTravailHebdo; horaires_ete: HorairesTravailHebdo }>()
  for (const p of paramOptionsRaw) {
    paramOptionsMap.set(p.option_horaire, { horaires: p.horaires, horaires_ete: p.horaires_ete })
  }

  // --- Index option_horaire par userId ---
  const profileOptionMap = new Map<string, OptionHoraire>()
  for (const p of profiles) {
    profileOptionMap.set(p.id, ((p as Record<string, unknown>).option_horaire as OptionHoraire) ?? 'A')
  }

  const DELTA_SEUIL = 15 // minutes

  function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }

  /** Calcule l'indicateur de couleur pour un champ de pointage */
  function getChampIndicateur(
    champValue: string | null,
    attenduHHmm: string | null,
    champName: string,
    correctionsAppliquees: Record<string, boolean>
  ): IndicateurPointage {
    if (correctionsAppliquees[champName]) return 'corrige'
    if (!champValue) return 'manquant'
    if (!attenduHHmm) return 'ok'
    const actual = new Date(champValue)
    const actualMin = actual.getHours() * 60 + actual.getMinutes()
    const delta = Math.abs(actualMin - hhmmToMinutes(attenduHHmm))
    return delta > DELTA_SEUIL ? 'anomalie' : 'ok'
  }

  /** Calcule les indicateurs feu tricolore pour les 4 pointages d'un jour */
  function getIndicateurs(userId: string, dateStr: string): IndicateursJour | undefined {
    const pt = pointageIndex.get(userId)?.get(dateStr)
    if (!pt) return undefined

    const d = new Date(dateStr + 'T12:00:00')
    const rawDow = d.getDay()
    if (rawDow === 0 || rawDow === 6) return undefined
    const dow = rawDow as 1 | 2 | 3 | 4 | 5

    const ete = isEte(d)

    // Utiliser les horaires de l'option du travailleur (pas du bureau)
    const opt = profileOptionMap.get(userId) ?? 'A'
    const param = paramOptionsMap.get(opt)
    let debutHHmm: string | null = null
    let finHHmm: string | null = null
    if (param) {
      const hebdo = ete ? param.horaires_ete : param.horaires
      const dowKey = String(dow) as keyof HorairesTravailHebdo
      debutHHmm = hebdo[dowKey].debut
      finHHmm = hebdo[dowKey].fin
    }

    const corr = pt.corrections_appliquees ?? {}

    return {
      arrivee: getChampIndicateur(pt.arrivee, debutHHmm, 'arrivee', corr),
      midi_out: corr['midi_out'] ? 'corrige' : pt.midi_out ? 'ok' : 'manquant',
      midi_in: corr['midi_in'] ? 'corrige' : pt.midi_in ? 'ok' : 'manquant',
      depart: getChampIndicateur(pt.depart, finHHmm, 'depart', corr),
    }
  }

  /** Détecte si un pointage présente une anomalie (delta > 15 min vs horaire attendu) */
  function hasAnomalie(userId: string, dateStr: string): boolean {
    const pt = pointageIndex.get(userId)?.get(dateStr)
    if (!pt || (!pt.arrivee && !pt.depart)) return false

    const d = new Date(dateStr + 'T12:00:00')
    const rawDow = d.getDay()
    if (rawDow === 0 || rawDow === 6) return false
    const dow = rawDow as 1 | 2 | 3 | 4 | 5

    const ete = isEte(d)

    // Utiliser les horaires de l'option du travailleur (pas du bureau)
    const opt = profileOptionMap.get(userId) ?? 'A'
    const param = paramOptionsMap.get(opt)
    if (!param) return false

    const hebdo = ete ? param.horaires_ete : param.horaires
    const dowKey = String(dow) as keyof HorairesTravailHebdo
    const hj = hebdo[dowKey]

    if (pt.arrivee) {
      const arr = new Date(pt.arrivee)
      const arrMin = arr.getHours() * 60 + arr.getMinutes()
      const delta = arrMin - hhmmToMinutes(hj.debut)
      if (Math.abs(delta) > DELTA_SEUIL) return true
    }

    if (pt.depart) {
      const dep = new Date(pt.depart)
      const depMin = dep.getHours() * 60 + dep.getMinutes()
      const delta = depMin - hhmmToMinutes(hj.fin)
      if (Math.abs(delta) > DELTA_SEUIL) return true
    }

    return false
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
      const isMaladie = conge.type === 'maladie'
      const baseLabel = TYPE_CONGE_LABEL[conge.type as TypeConge] ?? 'Congé'
      const demiLabel = conge.demi_journee === 'matin' ? ' (matin)' : conge.demi_journee === 'apres_midi' ? ' (après-midi)' : ''
      return {
        date,
        statut: isMaladie ? 'maladie' : 'conge',
        label: `${baseLabel}${demiLabel}`,
      }
    }

    // Priorité 4 : DayStatusRecord
    const ds = statusIndex.get(userId)?.get(date)
    if (ds) {
      if (ds.status === 'F') {
        return { date, statut: 'ferie', label: 'Jour férié' }
      }
      const mapped = DAY_STATUS_MAP[ds.status]
      if (mapped) {
        const anomalie = mapped.statut === 'present' ? hasAnomalie(userId, date) : false
        const indicateurs = mapped.statut === 'present' ? getIndicateurs(userId, date) : undefined
        return { date, statut: mapped.statut, label: mapped.label, anomalie: anomalie || undefined, indicateurs }
      }
    }

    // Priorité 5 : En cours — aujourd'hui, pointage arrivée existe mais pas de départ
    const todayStr = todayBrussels()
    if (date === todayStr) {
      const pt = pointageIndex.get(userId)?.get(date)
      if (pt?.arrivee) {
        const indicateurs = getIndicateurs(userId, date)
        const anomalie = hasAnomalie(userId, date)
        return { date, statut: 'en_cours', label: 'En cours', anomalie: anomalie || undefined, indicateurs }
      }
    }

    // Priorité 6 : Vide — vérifier aussi si pointage avec anomalie
    const anomalieVide = hasAnomalie(userId, date)
    return { date, statut: 'vide', anomalie: anomalieVide || undefined }
  }

  // --- Déterminer le bureau principal de chaque travailleur ---
  // Index bureaux par id → nom
  const bureauNomIndex = new Map<string, string>()
  for (const b of bureaux) {
    bureauNomIndex.set(b.id, b.nom)
  }

  function getBureauPrincipal(userId: string): string {
    const byJour = allScheduleIndex.get(userId)
    if (!byJour) return ''
    // Compter les bureaux actifs (aujourd'hui ou le plus récent) pour chaque jour de la semaine
    const todayStr = todayBrussels()
    const bureauxCount = new Map<string, number>()
    for (let dow = 1; dow <= 5; dow++) {
      const schedList = byJour.get(dow) ?? []
      const active = schedList.find((s) => s.valide_depuis <= todayStr)
      if (active) {
        bureauxCount.set(active.bureau_id, (bureauxCount.get(active.bureau_id) ?? 0) + 1)
      }
    }
    // Bureau avec le plus de jours
    let maxBureauId = ''
    let maxCount = 0
    bureauxCount.forEach((cnt, bId) => {
      if (cnt > maxCount) { maxCount = cnt; maxBureauId = bId }
    })
    return bureauNomIndex.get(maxBureauId) ?? ''
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
      bureau: getBureauPrincipal(profile.id),
      jours,
    })
  }

  return { travailleurs, services, bureaux }
}
