import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStatsData } from '@/lib/rapports/getStatsData'
import RapportsFiltres from '@/components/rapports/RapportsFiltres'
import TauxPresenceChart from '@/components/rapports/TauxPresenceChart'
import AbsencesParTypeChart from '@/components/rapports/AbsencesParTypeChart'
import TopAbsences from '@/components/rapports/TopAbsences'
import PotHeuresChart from '@/components/rapports/PotHeuresChart'
import ExportsSection from '@/components/rapports/ExportsSection'
import type { PeriodeType } from '@/types/rapports'

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: { periode?: string; date?: string; service?: string; bureau?: string }
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

  // Parse searchParams
  const periodeType: PeriodeType =
    searchParams.periode === 'trimestre' || searchParams.periode === 'annee'
      ? searchParams.periode
      : 'mois'

  const now = new Date()
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const periodeDate = searchParams.date ?? defaultDate

  const serviceId = searchParams.service || undefined
  const bureauId = searchParams.bureau || undefined

  const stats = await getStatsData({ periodeType, periodeDate, serviceId, bureauId })

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Rapports & Statistiques</h1>
        <Link
          href="/admin/recap"
          className="text-xs text-[#e53e3e] hover:underline"
        >
          Voir le récap mensuel →
        </Link>
      </div>

      {/* Filtres */}
      <RapportsFiltres
        periodeType={periodeType}
        periodeDate={periodeDate}
        serviceId={serviceId}
        bureauId={bureauId}
        services={stats.services}
        bureaux={stats.bureaux}
      />

      {/* Stats grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <TauxPresenceChart tauxPresence={stats.tauxPresence} tauxGlobal={stats.tauxGlobal} />
        <AbsencesParTypeChart absencesParType={stats.absencesParType} totalAbsences={stats.totalAbsences} />
        <TopAbsences topAbsences={stats.topAbsences} />
        <PotHeuresChart potHeures={stats.potHeures} />
      </div>

      {/* Section Exports */}
      <ExportsSection
        periodeType={periodeType}
        periodeDate={periodeDate}
        serviceId={serviceId}
        bureauId={bureauId}
      />
    </div>
  )
}
