'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { inviteWorker } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isApresDeadlineChangementOption } from '@/lib/horaires/utils'
import { logAudit } from '@/lib/audit/logger'
import { todayBrussels } from '@/lib/utils/dates'

async function assertAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')
  return user
}

export async function createTravailleurAction(_prev: unknown, formData: FormData) {
  const adminUser = await assertAdmin()
  const result = await inviteWorker({
    prenom: formData.get('prenom') as string,
    nom: formData.get('nom') as string,
    email: formData.get('email') as string,
    service_id: formData.get('service_id') as string,
    option_horaire: formData.get('option_horaire') as 'A' | 'B',
    type_contrat: (formData.get('type_contrat') as string) || undefined,
    date_entree: (formData.get('date_entree') as string) || undefined,
  })
  if ('error' in result) return { error: result.error }
  revalidatePath('/admin/travailleurs')
  return { success: true }
}

export async function deactivateTravailleurAction(userId: string, commentaire?: string) {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)
  if (error) return { error: error.message }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'profil.desactivation',
    category: 'admin',
    description: 'Compte désactivé',
    commentaire,
  })

  revalidatePath('/admin/travailleurs')
  return { success: true }
}

export async function updateTravailleurAction(_prev: unknown, formData: FormData) {
  const adminUser = await assertAdmin()
  const userId = formData.get('user_id') as string
  if (!userId) return { error: 'Utilisateur manquant' }

  const prenom = (formData.get('prenom') as string)?.trim()
  const nom = (formData.get('nom') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()

  if (!prenom || prenom.length > 100) return { error: 'Prénom invalide (1-100 caractères)' }
  if (!nom || nom.length > 100) return { error: 'Nom invalide (1-100 caractères)' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Format email invalide' }

  const telephone = (formData.get('telephone') as string)?.trim() || null
  if (telephone && telephone.length > 20) return { error: 'Téléphone trop long (max 20 caractères)' }

  const code_postal = (formData.get('code_postal') as string)?.trim() || null
  if (code_postal && code_postal.length > 10) return { error: 'Code postal trop long (max 10 caractères)' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      prenom,
      nom,
      email,
      service_id: formData.get('service_id') as string,
      type_contrat: (formData.get('type_contrat') as string)?.trim() || null,
      date_entree: (formData.get('date_entree') as string)?.trim() || null,
      telephone,
      contact_urgence: (formData.get('contact_urgence') as string)?.trim() || null,
      rue: (formData.get('rue') as string)?.trim() || null,
      numero: (formData.get('numero') as string)?.trim() || null,
      boite: (formData.get('boite') as string)?.trim() || null,
      code_postal,
      commune: (formData.get('commune') as string)?.trim() || null,
      pays: (formData.get('pays') as string)?.trim() || 'Belgique',
    })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function setBureauScheduleAction(_prev: unknown, formData: FormData) {
  const adminUser = await assertAdmin()
  const userId = formData.get('user_id') as string
  if (!userId) return { error: 'Utilisateur manquant' }
  const admin = createAdminClient()
  const { error: delError } = await admin
    .from('user_bureau_schedule')
    .delete()
    .eq('user_id', userId)
  if (delError) return { error: delError.message }
  const today = todayBrussels()
  const inserts: { user_id: string; bureau_id: string; jour: number; valide_depuis: string }[] = []
  for (const jour of [1, 2, 3, 4, 5]) {
    const bureauId = formData.get(`jour_${jour}`) as string
    if (bureauId) inserts.push({ user_id: userId, bureau_id: bureauId, jour, valide_depuis: today })
  }
  if (inserts.length > 0) {
    const { error: insError } = await admin.from('user_bureau_schedule').insert(inserts)
    if (insError) return { error: insError.message }
  }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'profil.bureau_schedule',
    category: 'admin',
    description: 'Affectation bureaux mise à jour',
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  revalidatePath('/admin/recap')
  return { success: true }
}

export async function updateOptionHoraireAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  const adminUser = await assertAdmin()
  const userId = formData.get('user_id') as string
  const newOption = formData.get('option_horaire') as 'A' | 'B'
  const commentaire = (formData.get('commentaire_admin') as string) || null
  if (!userId || !newOption) return { error: 'Paramètres manquants' }

  const admin = createAdminClient()
  const today = new Date()
  const isApresDeadline = isApresDeadlineChangementOption(today)

  if (isApresDeadline) {
    const { error } = await admin
      .from('profiles')
      .update({ option_horaire_prochaine: newOption })
      .eq('id', userId)
    if (error) return { error: error.message }

    await logAudit({
      targetUserId: userId,
      actorUserId: adminUser.id,
      action: 'profil.option_horaire',
      category: 'admin',
      description: `Option horaire planifiée: ${newOption} (effectif ${today.getFullYear() + 1})`,
      metadata: { option: newOption, planifie: isApresDeadline },
      commentaire,
    })

    revalidatePath(`/admin/travailleurs/${userId}`)
    return {
      success: true,
      warning: `Après le 15 décembre, le changement est planifié pour ${today.getFullYear() + 1}. L'option actuelle reste inchangée jusqu'au 1er janvier.`,
    }
  }

  // Cas normal : mettre à jour option_horaire + effacer option_horaire_prochaine
  const { error } = await admin
    .from('profiles')
    .update({ option_horaire: newOption, option_horaire_prochaine: null })
    .eq('id', userId)
  if (error) return { error: error.message }

  // Recalculer le pot_heures de l'année courante (les heures théoriques ont changé)
  await admin.rpc('recalculer_pot_heures_annee', {
    p_user_id: userId,
    p_annee: today.getFullYear(),
  })

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'profil.option_horaire',
    category: 'admin',
    description: `Option horaire changée: ${newOption}`,
    metadata: { option: newOption, planifie: isApresDeadline },
    commentaire,
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function correcterPotHeuresAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const userId = formData.get('user_id') as string
  const deltaStr = formData.get('delta_minutes') as string
  const anneeStr = formData.get('annee') as string
  const commentaire = (formData.get('commentaire_admin') as string) || null
  if (!userId || !deltaStr || !anneeStr) return { error: 'Paramètres manquants' }

  const delta = parseInt(deltaStr, 10)
  const annee = parseInt(anneeStr, 10)
  if (isNaN(delta) || isNaN(annee)) return { error: 'Valeurs invalides' }
  if (delta === 0) return { error: 'La correction doit être non-nulle' }

  const admin = createAdminClient()
  const { error } = await admin.rpc('corriger_pot_heures_admin', {
    p_user_id: userId,
    p_annee: annee,
    p_delta_minutes: delta,
  })
  if (error) return { error: error.message }

  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'pot_heures.correction',
    category: 'pot_heures',
    description: `Correction pot d'heures: ${delta > 0 ? '+' : ''}${delta} minutes`,
    metadata: { delta, annee },
    commentaire,
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}
