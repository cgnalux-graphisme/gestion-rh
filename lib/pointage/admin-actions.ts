'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DayStatusRecord, Pointage, RegimeTravail, OptionHoraire, HorairesHebdo, HorairesTravailHebdo } from '@/types/database'
import { isEte, getHorairesJour } from '@/lib/horaires/utils'
import { localTimeToIso, formatTimeBrussels } from '@/lib/utils/dates'
import { logAudit } from '@/lib/audit/logger'

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

export type UpdateDayStatusOptions = {
  /** Minutes de récupération (statut R). Si omis = journée complète */
  recupMinutes?: number
  /** Certificat médical requis (statut M) */
  certificatRecu?: boolean
}

export async function updateDayStatusAction(
  targetUserId: string,
  date: string,
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | 'G',
  commentaire?: string,
  options?: UpdateDayStatusOptions
): Promise<{ error?: string }> {
  const admin_user = await assertAdmin()
  const admin = createAdminClient()
  const annee = parseInt(date.slice(0, 4))

  // ─── Vérifier l'ancien statut pour annuler les effets précédents ───
  const { data: oldDayStatus } = await admin
    .from('day_statuses')
    .select('status, commentaire')
    .eq('user_id', targetUserId)
    .eq('date', date)
    .maybeSingle()

  const oldStatus = oldDayStatus?.status as string | undefined

  // ─── Annuler les effets de l'ancien statut (si on change) ───
  if (oldStatus && oldStatus !== status) {
    if (oldStatus === 'C') {
      // Rendre le jour de congé : décrémenter conges_annuels_pris
      await adjustSoldeConges(admin, targetUserId, annee, -1)
    }
    if (oldStatus === 'R') {
      // Rendre les minutes de récup au pot d'heures
      const oldComment = oldDayStatus?.commentaire ?? ''
      const oldMinMatch = oldComment.match(/Récup (\d+)min/)
      const oldMin = oldMinMatch ? parseInt(oldMinMatch[1]) : 0
      if (oldMin > 0) {
        await adjustPotHeures(admin, targetUserId, annee, oldMin) // remettre les minutes
      }
    }
  }

  // ─── Appliquer les effets du nouveau statut ───

  // Congé : déduire 1 jour du solde congés annuels
  if (status === 'C' && oldStatus !== 'C') {
    const res = await adjustSoldeConges(admin, targetUserId, annee, 1)
    if (res?.error) return { error: res.error }
  }

  // Maladie : noter si certificat reçu ou non
  if (status === 'M') {
    const certFlag = options?.certificatRecu ? '✓ Certificat reçu' : '⚠ Certificat non reçu'
    commentaire = commentaire
      ? `${commentaire} — ${certFlag}`
      : certFlag
  }

  // Récupération : déduire du pot d'heures
  if (status === 'R' && oldStatus !== 'R') {
    // Obtenir les minutes théoriques de la journée pour calculer le défaut
    const { data: profile } = await admin
      .from('profiles')
      .select('option_horaire')
      .eq('id', targetUserId)
      .single()
    const optHoraire = (profile?.option_horaire ?? 'A') as OptionHoraire
    const { minutesParJour } = await import('@/lib/horaires/utils')
    const minutesJournee = minutesParJour(optHoraire)

    const recupMin = options?.recupMinutes ?? minutesJournee
    const potRes = await adjustPotHeures(admin, targetUserId, annee, -recupMin)
    if (potRes?.error) return { error: potRes.error }

    const recupLabel = recupMin < minutesJournee
      ? `Récup ${recupMin}min (partielle)`
      : `Récup ${recupMin}min (journée complète)`
    commentaire = commentaire
      ? `${commentaire} — ${recupLabel}`
      : recupLabel
  }

  // ─── Upsert du day_status ───
  const { error } = await admin.from('day_statuses').upsert(
    {
      user_id: targetUserId,
      date,
      status,
      commentaire: commentaire ?? null,
      corrige_par: admin_user.id,
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }

  const STATUS_LABELS: Record<string, string> = { P: 'Présent', C: 'Congé', M: 'Maladie', R: 'Récupération', F: 'Formation', A: 'Absence injustifiée', G: 'Grève' }
  await logAudit({
    targetUserId: targetUserId,
    actorUserId: admin_user.id,
    action: 'pointage.statut_jour',
    category: 'pointage',
    description: `Statut ${date}: ${STATUS_LABELS[status] ?? status}${oldStatus ? ` (était: ${STATUS_LABELS[oldStatus] ?? oldStatus})` : ''}`,
    metadata: { date, status, oldStatus: oldStatus ?? null },
    commentaire,
  })

  revalidatePath('/admin/recap')
  revalidatePath('/admin/calendrier')
  revalidatePath(`/admin/travailleurs/${targetUserId}`)
  return {}
}

/** Ajuste conges_annuels_pris (+1 ou -1) */
async function adjustSoldeConges(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  annee: number,
  delta: number
): Promise<{ error?: string } | undefined> {
  const { data: solde } = await admin
    .from('soldes_conges')
    .select('conges_annuels_pris, conges_annuels_total, reliquat_conges_annuels')
    .eq('user_id', userId)
    .eq('annee', annee)
    .maybeSingle()

  if (!solde && delta > 0) {
    return { error: `Aucun solde de congés configuré pour ${annee}. Configurez d'abord les droits dans la fiche du travailleur.` }
  }
  if (!solde) return // pas de solde, rien à ajuster

  const newPris = solde.conges_annuels_pris + delta
  const totalDispo = solde.conges_annuels_total + (solde.reliquat_conges_annuels ?? 0)
  if (newPris > totalDispo) {
    return { error: `Solde congés insuffisant (${solde.conges_annuels_pris}/${totalDispo} jours déjà pris).` }
  }
  if (newPris < 0) return // ne pas descendre sous 0

  await admin
    .from('soldes_conges')
    .update({ conges_annuels_pris: newPris, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('annee', annee)
}

/** Ajuste le pot d'heures (négatif = déduction, positif = ajout). Refuse si solde résultant < 0 */
async function adjustPotHeures(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  annee: number,
  deltaMinutes: number
): Promise<{ error?: string } | void> {
  const { data: pot } = await admin
    .from('pot_heures')
    .select('solde_minutes')
    .eq('user_id', userId)
    .eq('annee', annee)
    .maybeSingle()

  const currentSolde = pot?.solde_minutes ?? 0
  const newSolde = currentSolde + deltaMinutes

  if (newSolde < 0) {
    return { error: `Pot d'heures insuffisant (${currentSolde} min disponibles, ${Math.abs(deltaMinutes)} min requises)` }
  }

  await admin.from('pot_heures').upsert(
    {
      user_id: userId,
      annee,
      solde_minutes: newSolde,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,annee' }
  )
}

export async function correctPointageAction(
  targetUserId: string,
  date: string,
  arrivee: string,
  midi_out: string,
  midi_in: string,
  depart: string,
  commentaire?: string
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('pointage').upsert(
    {
      user_id: targetUserId,
      date,
      arrivee: localTimeToIso(date, arrivee),
      midi_out: localTimeToIso(date, midi_out),
      midi_in: localTimeToIso(date, midi_in),
      depart: localTimeToIso(date, depart),
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }

  await logAudit({
    targetUserId,
    actorUserId: adminUser.id,
    action: 'pointage.correction_admin',
    category: 'pointage',
    description: `Correction pointage ${date}: ${arrivee}-${midi_out}/${midi_in}-${depart}`,
    metadata: { date, arrivee, midi_out, midi_in, depart },
    commentaire,
  })

  revalidatePath('/admin/recap')
  return {}
}

export async function getMonthPointageAdmin(
  year: number,
  month: number
): Promise<Pointage[]> {
  await assertAdmin()
  const admin = createAdminClient()

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await admin
    .from('pointage')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  return data ?? []
}

export async function getMonthDayStatusesAdmin(
  year: number,
  month: number
): Promise<DayStatusRecord[]> {
  await assertAdmin()
  const admin = createAdminClient()

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await admin
    .from('day_statuses')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  return data ?? []
}

// ─── Types pour le détail pointage dans la modale ───

export type PointageAlerte = {
  champ: 'arrivee' | 'midi_out' | 'midi_in' | 'depart'
  attendu: string       // 'HH:mm'
  reel: string          // 'HH:mm'
  deltaMinutes: number  // positif = retard, négatif = avance
  type: 'retard' | 'avance'
}

export type PointageDetail = {
  pointage: {
    arrivee: string | null   // 'HH:mm' ou null
    midi_out: string | null
    midi_in: string | null
    depart: string | null
  }
  horairesAttendus: {
    ouverture: string   // 'HH:mm'
    fermeture: string
    pause_midi: number  // minutes
  } | null
  alertes: PointageAlerte[]
  dayStatus: DayStatusRecord | null
  corrections: import('@/types/database').CorrectionPointage[]
  correctionsAppliquees: Record<string, boolean>
}

/** Convertit un ISO timestamp → 'HH:mm' en heure belge, ou null si absent */
function isoToHHmm(iso: string | null): string | null {
  if (!iso) return null
  const formatted = formatTimeBrussels(iso)
  return formatted === '—' ? null : formatted
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Récupère le pointage d'un travailleur pour une date + ses horaires attendus.
 * Compare les heures réelles vs attendues et retourne les alertes (delta > 15 min).
 */
export async function getPointageDetail(
  userId: string,
  date: string
): Promise<PointageDetail> {
  await assertAdmin()
  const admin = createAdminClient()

  // Requêtes en parallèle
  const [pointageRes, dayStatusRes, profileRes, scheduleRes, regimeRes, correctionsRes, paramOptRes] = await Promise.all([
    admin.from('pointage').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    admin.from('day_statuses').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    admin.from('profiles').select('option_horaire').eq('id', userId).single(),
    admin.from('user_bureau_schedule')
      .select('bureau_id, jour, valide_depuis, bureau:bureaux(horaires_normaux, horaires_ete)')
      .eq('user_id', userId)
      .order('valide_depuis', { ascending: false }),
    admin.from('regime_travail')
      .select('*')
      .eq('user_id', userId)
      .lte('date_debut', date)
      .or(`date_fin.is.null,date_fin.gte.${date}`)
      .order('date_debut', { ascending: false })
      .limit(1),
    admin.from('corrections_pointage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: true }),
    // Fetch parametres_options for both A and B
    admin.from('parametres_options').select('option_horaire, horaires, horaires_ete'),
  ])

  // Log query errors for debugging
  if (pointageRes.error) console.error('[getPointageDetail] pointage query error:', pointageRes.error)
  if (dayStatusRes.error) console.error('[getPointageDetail] dayStatus query error:', dayStatusRes.error)
  if (profileRes.error) console.error('[getPointageDetail] profile query error:', profileRes.error)
  if (correctionsRes.error) console.error('[getPointageDetail] corrections query error:', correctionsRes.error)
  if (paramOptRes.error) console.error('[getPointageDetail] paramOpt query error:', paramOptRes.error)

  const pointage = pointageRes.data as Pointage | null
  const dayStatus = dayStatusRes.data as DayStatusRecord | null
  const corrections = (correctionsRes.data ?? []) as import('@/types/database').CorrectionPointage[]
  const correctionsAppliquees = (pointage?.corrections_appliquees as Record<string, boolean>) ?? {}

  const pointageHHmm = {
    arrivee: isoToHHmm(pointage?.arrivee ?? null),
    midi_out: isoToHHmm(pointage?.midi_out ?? null),
    midi_in: isoToHHmm(pointage?.midi_in ?? null),
    depart: isoToHHmm(pointage?.depart ?? null),
  }

  // Déterminer les horaires attendus via l'option horaire du travailleur (pas le bureau)
  const d = new Date(date + 'T12:00:00')
  const dow = d.getDay() as 1 | 2 | 3 | 4 | 5 // 1=lundi...5=vendredi
  const ete = isEte(d)

  // Utiliser les horaires de l'option du travailleur (debut/fin)
  const optionHoraire = (profileRes.data?.option_horaire ?? 'A') as OptionHoraire
  const paramOptions = (paramOptRes.data ?? []) as { option_horaire: string; horaires: HorairesTravailHebdo; horaires_ete: HorairesTravailHebdo }[]
  const myParam = paramOptions.find((p) => p.option_horaire === optionHoraire)

  let horairesAttendus: PointageDetail['horairesAttendus'] = null
  if (myParam) {
    const hebdo = ete ? myParam.horaires_ete : myParam.horaires
    const dowKey = String(dow) as keyof HorairesTravailHebdo
    const hj = hebdo[dowKey]
    horairesAttendus = {
      ouverture: hj.debut,
      fermeture: hj.fin,
      pause_midi: hj.pause_midi,
    }
  }

  // Calculer les alertes (delta > 15 min)
  const alertes: PointageAlerte[] = []
  const DELTA_SEUIL = 15

  if (horairesAttendus && pointage) {
    // Arrivée : retard si > ouverture + 15min, avance si < ouverture - 15min
    if (pointageHHmm.arrivee) {
      const delta = hhmmToMinutes(pointageHHmm.arrivee) - hhmmToMinutes(horairesAttendus.ouverture)
      if (Math.abs(delta) > DELTA_SEUIL) {
        alertes.push({
          champ: 'arrivee',
          attendu: horairesAttendus.ouverture,
          reel: pointageHHmm.arrivee,
          deltaMinutes: delta,
          type: delta > 0 ? 'retard' : 'avance',
        })
      }
    }

    // Départ : retard si > fermeture + 15min (heures sup?), avance si < fermeture - 15min
    if (pointageHHmm.depart) {
      const delta = hhmmToMinutes(pointageHHmm.depart) - hhmmToMinutes(horairesAttendus.fermeture)
      if (Math.abs(delta) > DELTA_SEUIL) {
        alertes.push({
          champ: 'depart',
          attendu: horairesAttendus.fermeture,
          reel: pointageHHmm.depart,
          deltaMinutes: delta,
          type: delta > 0 ? 'retard' : 'avance',
        })
      }
    }

    // Midi out/in : on vérifie que la pause midi est cohérente si les deux sont présents
    if (pointageHHmm.midi_out && pointageHHmm.midi_in) {
      const pauseReelle = hhmmToMinutes(pointageHHmm.midi_in) - hhmmToMinutes(pointageHHmm.midi_out)
      const pauseAttendue = horairesAttendus.pause_midi
      const deltaPause = pauseReelle - pauseAttendue
      if (Math.abs(deltaPause) > DELTA_SEUIL) {
        alertes.push({
          champ: 'midi_in',
          attendu: `${pauseAttendue}min`,
          reel: `${pauseReelle}min`,
          deltaMinutes: deltaPause,
          type: deltaPause > 0 ? 'retard' : 'avance',
        })
      }
    }
  }

  return {
    pointage: pointageHHmm,
    horairesAttendus,
    alertes,
    dayStatus,
    corrections,
    correctionsAppliquees,
  }
}
