'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateCoordonneesAction(_prev: unknown, formData: FormData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword) {
    if (newPassword.length < 8)
      return { error: 'Le mot de passe doit comporter au moins 8 caractères.' }
    if (newPassword !== confirmPassword)
      return { error: 'Les mots de passe ne correspondent pas.' }
  }

  const updates: Record<string, string | null> = {
    prenom: formData.get('prenom') as string,
    nom: formData.get('nom') as string,
    telephone: (formData.get('telephone') as string) || null,
    contact_urgence: (formData.get('contact_urgence') as string) || null,
    rue: (formData.get('rue') as string) || null,
    numero: (formData.get('numero') as string) || null,
    boite: (formData.get('boite') as string) || null,
    code_postal: (formData.get('code_postal') as string) || null,
    commune: (formData.get('commune') as string) || null,
    pays: (formData.get('pays') as string) || 'Belgique',
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
  if (error) return { error: error.message }

  if (newPassword) {
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
    if (pwError) return { error: pwError.message }
  }

  revalidatePath('/profil')
  return { success: true }
}

export async function updateAdminRhAction(userId: string, isAdmin: boolean) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caller } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!caller?.is_admin_rh) redirect('/')

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_admin_rh: isAdmin })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/travailleurs')
  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}
