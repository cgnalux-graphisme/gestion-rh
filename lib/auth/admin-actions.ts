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
      option_horaire: formData.get('option_horaire') as 'A' | 'B',
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
