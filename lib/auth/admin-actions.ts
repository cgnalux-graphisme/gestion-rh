'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { inviteWorker } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  await assertAdmin()
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

export async function deactivateTravailleurAction(userId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  return { success: true }
}

export async function updateTravailleurAction(_prev: unknown, formData: FormData) {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  if (!userId) return { error: 'Utilisateur manquant' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      prenom: formData.get('prenom') as string,
      nom: formData.get('nom') as string,
      email: formData.get('email') as string,
      service_id: formData.get('service_id') as string,
      type_contrat: (formData.get('type_contrat') as string) || null,
      date_entree: (formData.get('date_entree') as string) || null,
      telephone: (formData.get('telephone') as string) || null,
      rue: (formData.get('rue') as string) || null,
      numero: (formData.get('numero') as string) || null,
      boite: (formData.get('boite') as string) || null,
      code_postal: (formData.get('code_postal') as string) || null,
      commune: (formData.get('commune') as string) || null,
      pays: (formData.get('pays') as string) || 'Belgique',
    })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function setBureauScheduleAction(_prev: unknown, formData: FormData) {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  if (!userId) return { error: 'Utilisateur manquant' }
  const admin = createAdminClient()
  const { error: delError } = await admin
    .from('user_bureau_schedule')
    .delete()
    .eq('user_id', userId)
  if (delError) return { error: delError.message }
  const today = new Date().toISOString().slice(0, 10)
  const inserts: { user_id: string; bureau_id: string; jour: number; valide_depuis: string }[] = []
  for (const jour of [1, 2, 3, 4, 5]) {
    const bureauId = formData.get(`jour_${jour}`) as string
    if (bureauId) inserts.push({ user_id: userId, bureau_id: bureauId, jour, valide_depuis: today })
  }
  if (inserts.length > 0) {
    const { error: insError } = await admin.from('user_bureau_schedule').insert(inserts)
    if (insError) return { error: insError.message }
  }
  revalidatePath(`/admin/travailleurs/${userId}`)
  revalidatePath('/admin/recap')
  return { success: true }
}

export async function updateOptionHoraireAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const newOption = formData.get('option_horaire') as 'A' | 'B'
  if (!userId || !newOption) return { error: 'Paramètres manquants' }

  const admin = createAdminClient()
  const today = new Date()
  // Deadline : après le 15 décembre → seule l'année suivante est modifiable
  const isApresDeadline = today.getMonth() === 11 && today.getDate() > 15

  if (isApresDeadline) {
    const { error } = await admin
      .from('profiles')
      .update({ option_horaire_prochaine: newOption })
      .eq('id', userId)
    if (error) return { error: error.message }
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

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function correcterPotHeuresAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const deltaStr = formData.get('delta_minutes') as string
  const anneeStr = formData.get('annee') as string
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

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}
