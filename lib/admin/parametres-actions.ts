'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ParametresOption } from '@/types/database'

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

/** Get parameters for both options */
export async function getParametresOptions(): Promise<ParametresOption[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('parametres_options')
    .select('*')
    .order('option_horaire')
  return (data ?? []) as ParametresOption[]
}

/** Update parameters for an option */
export async function updateParametresOptionAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const id = formData.get('id') as string
  const heures_semaine = parseFloat(formData.get('heures_semaine') as string)
  const conges_annuels_defaut = parseInt(formData.get('conges_annuels_defaut') as string, 10)
  const repos_comp_defaut = parseInt(formData.get('repos_comp_defaut') as string, 10)
  const pot_heures_initial = parseInt(formData.get('pot_heures_initial') as string, 10)

  // Parse horaires from form
  const horaires: Record<string, any> = {}
  const horaires_ete: Record<string, any> = {}
  for (let j = 1; j <= 5; j++) {
    horaires[String(j)] = {
      debut: formData.get(`horaire_${j}_debut`) as string,
      fin: formData.get(`horaire_${j}_fin`) as string,
      pause_midi: parseInt(formData.get(`horaire_${j}_pause`) as string, 10) || 0,
    }
    horaires_ete[String(j)] = {
      debut: formData.get(`horaire_ete_${j}_debut`) as string,
      fin: formData.get(`horaire_ete_${j}_fin`) as string,
      pause_midi: parseInt(formData.get(`horaire_ete_${j}_pause`) as string, 10) || 0,
    }
  }

  if (!id || isNaN(heures_semaine)) return { error: 'Paramètres invalides' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('parametres_options')
    .update({
      heures_semaine,
      conges_annuels_defaut,
      repos_comp_defaut,
      pot_heures_initial,
      horaires,
      horaires_ete,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/parametres-horaires')
  revalidatePath('/profil')
  return { success: true }
}
