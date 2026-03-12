'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Pointage } from '@/types/database'

export type PointageType = 'arrivee' | 'midi_out' | 'midi_in' | 'depart'

export async function pointerAction(type: PointageType): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  // Arrondi à la minute
  now.setSeconds(0, 0)
  const nowIso = now.toISOString()

  const { error } = await supabase.from('pointage').upsert(
    { user_id: user.id, date: today, [type]: nowIso },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function getTodayPointage(): Promise<Pointage | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('pointage')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  return data ?? null
}

export async function getWorkerMonthPointage(
  year: number,
  month: number
): Promise<Pointage[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await supabase
    .from('pointage')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  return data ?? []
}
