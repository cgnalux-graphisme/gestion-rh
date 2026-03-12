'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DayStatusRecord, Pointage } from '@/types/database'

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

export async function updateDayStatusAction(
  targetUserId: string,
  date: string,
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A',
  commentaire?: string
): Promise<{ error?: string }> {
  const admin_user = await assertAdmin()
  const admin = createAdminClient()

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
  revalidatePath('/admin/recap')
  return {}
}

export async function correctPointageAction(
  targetUserId: string,
  date: string,
  arrivee: string,
  midi_out: string,
  midi_in: string,
  depart: string
): Promise<{ error?: string }> {
  await assertAdmin()
  const admin = createAdminClient()

  function toIso(date: string, time: string): string | null {
    if (!time) return null
    return new Date(`${date}T${time}:00`).toISOString()
  }

  const { error } = await admin.from('pointage').upsert(
    {
      user_id: targetUserId,
      date,
      arrivee: toIso(date, arrivee),
      midi_out: toIso(date, midi_out),
      midi_in: toIso(date, midi_in),
      depart: toIso(date, depart),
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
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
