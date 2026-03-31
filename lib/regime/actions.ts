'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { RegimeTravail, RegimeType, RegimeFraction } from '@/types/database'
import { logAudit } from '@/lib/audit/logger'
import { todayBrussels, formatLocalDate } from '@/lib/utils/dates'

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

/** Récupérer tous les régimes d'un travailleur (triés par date_debut DESC) */
export async function getRegimesTravailleur(userId: string): Promise<RegimeTravail[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('regime_travail')
    .select('*')
    .eq('user_id', userId)
    .order('date_debut', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as RegimeTravail[]
}

/** Récupérer le régime actif d'un travailleur (à une date donnée, par défaut aujourd'hui) */
export async function getRegimeActif(userId: string, date?: string): Promise<RegimeTravail | null> {
  const admin = createAdminClient()
  const targetDate = date ?? todayBrussels()

  const { data, error } = await admin
    .from('regime_travail')
    .select('*')
    .eq('user_id', userId)
    .lte('date_debut', targetDate)
    .or(`date_fin.is.null,date_fin.gte.${targetDate}`)
    .order('date_debut', { ascending: false })
    .limit(1)
    .single()

  if (error?.code === 'PGRST116') return null // no rows
  if (error) throw new Error(error.message)
  return data as RegimeTravail
}

/** Créer un nouveau régime */
export async function createRegimeAction(
  userId: string,
  typeRegime: RegimeType,
  fraction: RegimeFraction,
  pourcentageTravail: number,
  joursParSemaine: number,
  dateDebut: string,
  dateFin: string | null,
  jourOff: number | null,
  heuresParJour: number | null,
  commentaire: string | null
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Clôturer automatiquement le régime actif précédent si la date_debut chevauche
  const { data: existing } = await admin
    .from('regime_travail')
    .select('id, date_debut')
    .eq('user_id', userId)
    .is('date_fin', null)
    .order('date_debut', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    // Clôturer le régime précédent au jour avant le nouveau
    const veille = new Date(dateDebut)
    veille.setDate(veille.getDate() - 1)
    const veilleStr = formatLocalDate(veille)

    await admin
      .from('regime_travail')
      .update({ date_fin: veilleStr, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
  }

  const { error } = await admin.from('regime_travail').insert({
    user_id: userId,
    type_regime: typeRegime,
    fraction,
    pourcentage_travail: pourcentageTravail,
    jours_par_semaine: joursParSemaine,
    date_debut: dateDebut,
    date_fin: dateFin || null,
    jour_off: jourOff,
    heures_par_jour: heuresParJour,
    commentaire: commentaire || null,
  })

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'regime.creation',
    category: 'regime',
    description: `Nouveau régime: ${typeRegime} (${pourcentageTravail}%) depuis ${dateDebut}`,
    metadata: { typeRegime, fraction, pourcentageTravail, joursParSemaine, dateDebut, dateFin },
    commentaire,
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return {}
}

/** Mettre à jour un régime existant */
export async function updateRegimeAction(
  regimeId: string,
  userId: string,
  typeRegime: RegimeType,
  fraction: RegimeFraction,
  pourcentageTravail: number,
  joursParSemaine: number,
  dateDebut: string,
  dateFin: string | null,
  jourOff: number | null,
  heuresParJour: number | null,
  commentaire: string | null
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('regime_travail')
    .update({
      type_regime: typeRegime,
      fraction,
      pourcentage_travail: pourcentageTravail,
      jours_par_semaine: joursParSemaine,
      date_debut: dateDebut,
      date_fin: dateFin || null,
      jour_off: jourOff,
      heures_par_jour: heuresParJour,
      commentaire: commentaire || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', regimeId)

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'regime.modification',
    category: 'regime',
    description: `Régime modifié: ${typeRegime} (${pourcentageTravail}%) depuis ${dateDebut}`,
    metadata: { regimeId, typeRegime, fraction, pourcentageTravail, joursParSemaine, dateDebut, dateFin },
    commentaire,
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return {}
}

/** Supprimer un régime */
export async function deleteRegimeAction(
  regimeId: string,
  userId: string
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('regime_travail')
    .delete()
    .eq('id', regimeId)

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'regime.suppression',
    category: 'regime',
    description: 'Régime supprimé',
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return {}
}
