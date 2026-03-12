import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Profile, Service } from '@/types/database'
import RecapMensuel from '@/components/admin/RecapMensuel'
import { getMonthPointageAdmin, getMonthDayStatusesAdmin } from '@/lib/pointage/admin-actions'

export default async function RecapPage({
  searchParams,
}: {
  searchParams: { mois?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (searchParams.mois) {
    const parts = searchParams.mois.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) { year = y; month = m }
    }
  }

  const [workersRes, allPointages, allDayStatuses] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, service:services(*)')
      .eq('is_active', true)
      .order('nom'),
    getMonthPointageAdmin(year, month),
    getMonthDayStatusesAdmin(year, month),
  ])

  const workers = (workersRes.data ?? []) as (Profile & { service?: Service })[]

  return (
    <div className="max-w-full mx-auto p-4">
      <RecapMensuel
        workers={workers}
        year={year}
        month={month}
        allPointages={allPointages}
        allDayStatuses={allDayStatuses}
      />
    </div>
  )
}
