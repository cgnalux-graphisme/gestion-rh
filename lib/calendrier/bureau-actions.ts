'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

/** Assign a worker temporarily to a bureau for a specific date */
export async function assignTempBureauAction(
  userId: string,
  date: string,
  bureauId: string
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('bureau_affectation_temp').upsert(
    {
      user_id: userId,
      bureau_id: bureauId,
      date,
      created_by: adminUser.id,
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
  revalidatePath('/admin/calendrier')
  revalidatePath('/calendrier')
  return {}
}

/** Remove a temporary bureau assignment */
export async function removeTempBureauAction(
  userId: string,
  date: string
): Promise<{ error?: string }> {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('bureau_affectation_temp')
    .delete()
    .eq('user_id', userId)
    .eq('date', date)

  if (error) return { error: error.message }
  revalidatePath('/admin/calendrier')
  revalidatePath('/calendrier')
  return {}
}

/** Update the coverage threshold for a service in a bureau */
export async function updateSeuilAction(
  bureauId: string,
  serviceId: string,
  seuil: number
): Promise<{ error?: string }> {
  await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('bureau_service_seuils').upsert(
    {
      bureau_id: bureauId,
      service_id: serviceId,
      seuil_minimum: seuil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'bureau_id,service_id' }
  )

  if (error) return { error: error.message }
  revalidatePath('/calendrier')
  return {}
}
