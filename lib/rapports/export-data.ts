import { createClient } from '@/lib/supabase/server'
import { calculerPlage, labelPeriode } from './periodes'
import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'
import { formatMinutes } from '@/lib/horaires/utils'
import { labelTypeConge, labelStatutConge, formatDateFr, formatLocalDate } from '@/lib/utils/dates'
import type { ExportParams } from '@/types/rapports'

export type ExportMeta = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
}

async function getAdminSupabase() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) throw new Error('Non autorisé')
  return supabase
}

/**
 * Filtre bureau partagé : charge user_bureau_schedule et retourne un Set de user_ids
 * assignés au bureau pour au moins un jour ouvrable de la plage.
 */
async function filterByBureau(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  bureauId: string | undefined,
  dateDebut: string,
  dateFin: string
): Promise<Set<string> | null> {
  if (!bureauId) return null // pas de filtre

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, valide_depuis')
    .in('user_id', userIds)

  const bureauIndex = new Map<string, Map<number, { bureau_id: string; valide_depuis: string }[]>>()
  for (const bs of (schedules ?? [])) {
    if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
    const byJour = bureauIndex.get(bs.user_id)!
    if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
    byJour.get(bs.jour)!.push(bs)
  }
  bureauIndex.forEach((byJour) => {
    byJour.forEach((list) => list.sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis)))
  })

  const feries = joursFeriesPlage(dateDebut, dateFin)
  const retained = new Set<string>()
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = formatLocalDate(cur)
    if (dow >= 1 && dow <= 5 && !feries.has(iso)) {
      for (const uid of userIds) {
        const byJour = bureauIndex.get(uid)
        const list = byJour?.get(dow) ?? []
        const entry = list.find((bs) => bs.valide_depuis <= iso) ?? null
        if (entry?.bureau_id === bureauId) retained.add(uid)
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return retained
}

export async function collectPointages(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const feries = joursFeriesPlage(dateDebut, dateFin)

  // Générer la liste de dates
  const dates: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    dates.push(formatLocalDate(cur))
    cur.setDate(cur.getDate() + 1)
  }

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, service:services(nom)')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: dayStatuses } = await supabase
    .from('day_statuses')
    .select('user_id, date, status')
    .in('user_id', workers.map((w) => w.id))
    .gte('date', dateDebut)
    .lte('date', dateFin)

  const statusIndex = new Map<string, Map<string, string>>()
  for (const ds of (dayStatuses ?? [])) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, ds.status)
  }

  const headers = ['Nom', 'Prénom', 'Service', ...dates.map((d) => d.slice(8)), 'Total P']
  const rows = workers.map((w) => {
    const svc = (w.service as unknown as { nom: string } | null)?.nom ?? ''
    let totalP = 0
    const cells = dates.map((d) => {
      const dow = new Date(d + 'T00:00:00').getDay()
      if (dow === 0 || dow === 6) return 'W'
      if (feries.has(d)) return 'F'
      const status = statusIndex.get(w.id)?.get(d) ?? ''
      if (status === 'P') totalP++
      return status
    })
    return [w.nom, w.prenom, svc, ...cells, String(totalP)]
  })

  return { titre: 'Pointages mensuels', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectTravailleurs(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, email, service:services(nom), option_horaire, type_contrat, date_entree, is_active')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('user_id, jour, bureau:bureaux(nom), valide_depuis')
    .in('user_id', workers.map((w) => w.id))

  const jourNoms = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
  const schedIndex = new Map<string, string>()
  for (const w of workers) {
    const userSchedules = (schedules ?? [])
      .filter((s) => s.user_id === w.id)
      .sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis))
    const byJour = new Map<number, string>()
    for (const s of userSchedules) {
      // Premier trouvé = le plus récent (trié DESC), ne pas écraser
      if (!byJour.has(s.jour)) {
        byJour.set(s.jour, (s.bureau as unknown as { nom: string })?.nom ?? '')
      }
    }
    const parts: string[] = []
    for (let j = 1; j <= 5; j++) {
      const b = byJour.get(j)
      if (b) parts.push(`${jourNoms[j]}: ${b}`)
    }
    schedIndex.set(w.id, parts.join(', ') || 'Non assigné')
  }

  const headers = ['Nom', 'Prénom', 'Email', 'Service', 'Bureau(x)', 'Option horaire', 'Type contrat', "Date d'entrée", 'Statut']
  const rows = workers.map((w) => [
    w.nom,
    w.prenom,
    w.email,
    (w.service as unknown as { nom: string } | null)?.nom ?? '',
    schedIndex.get(w.id) ?? '',
    w.option_horaire ?? '',
    w.type_contrat ?? '',
    w.date_entree ? formatDateFr(w.date_entree) : '',
    w.is_active ? 'Actif' : 'Inactif',
  ])

  return { titre: 'Liste des travailleurs', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectConges(params: ExportParams): Promise<ExportMeta & { soldesHeaders: string[]; soldesRows: string[][] }> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const annee = parseInt(params.periodeDate.slice(0, 4))

  // Charger les user_ids filtrés par service (et bureau si applicable)
  let profilesQ = supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profilesData } = await profilesQ
  let filteredUserIds = (profilesData ?? []).map((p) => p.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, filteredUserIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) filteredUserIds = filteredUserIds.filter((id) => bureauFilter.has(id))

  const congesQ = supabase
    .from('conges')
    .select('user_id, type, date_debut, date_fin, nb_jours, statut, commentaire_travailleur, profile:profiles(prenom, nom)')
    .in('user_id', filteredUserIds)
    .lte('date_debut', dateFin)
    .gte('date_fin', dateDebut)
    .order('date_debut')

  const { data: conges } = await congesQ

  const headers = ['Nom', 'Type', 'Date début', 'Date fin', 'Nb jours', 'Statut', 'Commentaire']
  const rows = (conges ?? []).map((c) => {
    const p = c.profile as unknown as { prenom: string; nom: string } | null
    return [
      p ? `${p.nom} ${p.prenom}` : '',
      labelTypeConge(c.type),
      formatDateFr(c.date_debut),
      formatDateFr(c.date_fin),
      String(c.nb_jours),
      labelStatutConge(c.statut),
      c.commentaire_travailleur ?? '',
    ]
  })

  // Soldes (filtrés par les mêmes user_ids)
  const soldesQ = supabase
    .from('soldes_conges')
    .select('user_id, conges_annuels_total, conges_annuels_pris, repos_comp_total, repos_comp_pris, profile:profiles(prenom, nom)')
    .in('user_id', filteredUserIds)
    .eq('annee', annee)
  const { data: soldes } = await soldesQ

  const soldesHeaders = ['Nom', 'CA total', 'CA pris', 'CA restant', 'RC total', 'RC pris', 'RC restant']
  const soldesRows = (soldes ?? []).map((s) => {
    const p = s.profile as unknown as { prenom: string; nom: string } | null
    return [
      p ? `${p.nom} ${p.prenom}` : '',
      String(s.conges_annuels_total),
      String(s.conges_annuels_pris),
      String(s.conges_annuels_total - s.conges_annuels_pris),
      String(s.repos_comp_total),
      String(s.repos_comp_pris),
      String(s.repos_comp_total - s.repos_comp_pris),
    ]
  })

  return { titre: 'Congés', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows, soldesHeaders, soldesRows }
}

export async function collectCalendrier(params: ExportParams): Promise<ExportMeta> {
  // Réutilise la logique de getCalendrierData
  const { getCalendrierData } = await import('@/lib/calendrier/getCalendrierData')
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const data = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId: params.serviceId,
    bureauId: params.bureauId,
  })

  const dates: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    dates.push(formatLocalDate(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const statutToCode: Record<string, string> = {
    present: 'P', absent: 'A', conge: 'C', ferie: 'F', weekend: 'W', vide: '—',
  }

  const headers = ['Nom', 'Service', ...dates.map((d) => d.slice(8))]
  const rows = data.travailleurs.map((t) => {
    const cells = t.jours.map((j) => statutToCode[j.statut] ?? '—')
    return [`${t.nom} ${t.prenom}`, t.service, ...cells]
  })

  return { titre: 'Calendrier de présence', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectPotHeures(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const annee = parseInt(params.periodeDate.slice(0, 4))
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, option_horaire, service:services(nom)')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: potData } = await supabase
    .from('pot_heures')
    .select('user_id, solde_minutes')
    .in('user_id', workers.map((w) => w.id))
    .eq('annee', annee)

  const potIndex = new Map<string, number>()
  for (const p of (potData ?? [])) potIndex.set(p.user_id, p.solde_minutes)

  const headers = ['Nom', 'Service', 'Option horaire', 'Solde (minutes)', 'Solde (format)']
  const rows = workers.map((w) => {
    const solde = potIndex.get(w.id) ?? 0
    return [
      `${w.nom} ${w.prenom}`,
      (w.service as unknown as { nom: string } | null)?.nom ?? '',
      w.option_horaire ?? '',
      String(solde),
      formatMinutes(solde),
    ]
  })

  return { titre: 'Pot d\'heures', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}
