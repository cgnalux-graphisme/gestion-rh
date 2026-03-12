import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTodayPointage } from '@/lib/pointage/actions'
import { getSoldeHeuresAction } from '@/lib/pot-heures/actions'
import { UserBureauSchedule, Bureau } from '@/types/database'
import PointageWidget from '@/components/dashboard/PointageWidget'
import SoldeHeuresWidget from '@/components/dashboard/SoldeHeuresWidget'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const dow = today.getDay()

  const [pointage, schedulesRes, soldeData] = await Promise.all([
    getTodayPointage(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .eq('jour', dow)
      .single(),
    getSoldeHeuresAction(),
  ])

  const bureauDuJour = schedulesRes.data as (UserBureauSchedule & { bureau: Bureau }) | null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-sm font-bold text-[#1a2332]">Tableau de bord</h1>

      <PointageWidget pointage={pointage} />

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          📍 Bureau du jour
        </p>
        <p className="text-sm font-semibold text-[#1a2332]">
          {dow === 0 || dow === 6
            ? 'Week-end'
            : bureauDuJour?.bureau?.nom ?? 'Sur la route'}
        </p>
      </div>

      <SoldeHeuresWidget solde={soldeData?.solde_minutes ?? null} />
    </div>
  )
}
