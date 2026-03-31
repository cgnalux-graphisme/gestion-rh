'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Bureau } from '@/types/database'

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

/** Get all bureaux with their opening hours */
export async function getAllBureauxAdmin(): Promise<Bureau[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('bureaux')
    .select('*')
    .order('nom')
  return (data ?? []) as Bureau[]
}

/** Update opening hours for a bureau */
export async function updateBureauHorairesAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const bureauId = formData.get('bureau_id') as string
  if (!bureauId) return { error: 'Bureau non spécifié' }

  const horaires_normaux: Record<string, any> = {}
  const horaires_ete: Record<string, any> = {}
  for (let j = 1; j <= 5; j++) {
    horaires_normaux[String(j)] = {
      matin_debut: formData.get(`normal_${j}_matin_debut`) as string,
      matin_fin: formData.get(`normal_${j}_matin_fin`) as string,
      aprem_debut: formData.get(`normal_${j}_aprem_debut`) as string,
      aprem_fin: formData.get(`normal_${j}_aprem_fin`) as string,
    }
    horaires_ete[String(j)] = {
      matin_debut: formData.get(`ete_${j}_matin_debut`) as string,
      matin_fin: formData.get(`ete_${j}_matin_fin`) as string,
      aprem_debut: formData.get(`ete_${j}_aprem_debut`) as string,
      aprem_fin: formData.get(`ete_${j}_aprem_fin`) as string,
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bureaux')
    .update({
      horaires_normaux,
      horaires_ete,
    })
    .eq('id', bureauId)

  if (error) return { error: error.message }

  revalidatePath('/admin/ouvertures-bureaux')
  revalidatePath('/profil')
  return { success: true }
}
