'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Pointage } from '@/types/database'
import { todayBrussels, nowBrusselsIso } from '@/lib/utils/dates'
import { logAudit } from '@/lib/audit/logger'

export type PointageType = 'arrivee' | 'midi_out' | 'midi_in' | 'depart'

export async function pointerAction(type: PointageType): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayBrussels()
  const nowIso = nowBrusselsIso()

  const { error } = await supabase.from('pointage').upsert(
    { user_id: user.id, date: today, [type]: nowIso },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: `pointage.${type}`,
    category: 'pointage',
    description: `Pointage: ${type}`,
    metadata: { date: today, type },
  })

  revalidatePath('/', 'layout')
  return {}
}

export async function getTodayPointage(): Promise<Pointage | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = todayBrussels()
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
