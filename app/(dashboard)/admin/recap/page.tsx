import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Profile, Service, UserBureauSchedule } from '@/types/database'
import RecapMensuel from '@/components/admin/RecapMensuel'

export default async function RecapPage({
  searchParams,
}: {
  searchParams: { mois?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  // Parse month from ?mois=YYYY-MM, default to current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (searchParams.mois) {
    const parts = searchParams.mois.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        year = y
        month = m
      }
    }
  }

  const [workersRes, schedulesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, service:services(*)')
      .eq('is_active', true)
      .order('nom'),
    supabase.from('user_bureau_schedule').select('*, bureau:bureaux(*)'),
  ])

  const workers = (workersRes.data ?? []) as (Profile & { service?: Service })[]
  const allSchedules = (schedulesRes.data ?? []) as UserBureauSchedule[]

  const workersWithSchedules = workers.map((w) => ({
    ...w,
    schedules: allSchedules.filter((s) => s.user_id === w.id),
  }))

  return (
    <div className="max-w-full mx-auto p-4">
      <RecapMensuel workers={workersWithSchedules} year={year} month={month} />
    </div>
  )
}
