'use client'

import { SoldeConges, PotHeures } from '@/types/database'

function formatMinutes(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.abs(mins) % 60
  const sign = mins < 0 ? '-' : ''
  return `${sign}${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

function SoldeCard({
  label,
  icon,
  pris,
  total,
  reliquat,
  unite,
}: {
  label: string
  icon: string
  pris: number
  total: number
  reliquat?: number
  unite: string
}) {
  const disponible = Math.max(0, total - pris + (reliquat ?? 0))
  const pct = total > 0 ? Math.min(100, Math.round((pris / (total + (reliquat ?? 0))) * 100)) : 0
  const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[#1a2332] mb-1">
        {disponible} <span className="text-sm font-normal text-gray-400">{unite}</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{pris} pris</span>
        <span>Total {total}{reliquat ? ` + ${reliquat} reliquat` : ''}</span>
      </div>
    </div>
  )
}

function PotCard({ pot }: { pot: PotHeures | null }) {
  const solde = pot?.solde_minutes ?? 0
  const isPositif = solde >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">&#9201;</span>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pot d&apos;heures</span>
      </div>
      <div className={`text-2xl font-bold mb-1 ${isPositif ? 'text-emerald-600' : 'text-red-600'}`}>
        {formatMinutes(solde)}
      </div>
      <div className="text-[10px] text-gray-400">
        {isPositif ? 'Crédit disponible' : 'Solde négatif'}
      </div>
    </div>
  )
}

interface Props {
  soldes: SoldeConges | null
  pot: PotHeures | null
}

export default function SoldesCards({ soldes, pot }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SoldeCard
        label="Congés annuels"
        icon="&#127796;"
        pris={soldes?.conges_annuels_pris ?? 0}
        total={soldes?.conges_annuels_total ?? 0}
        reliquat={soldes?.reliquat_conges_annuels}
        unite="jours dispo"
      />
      <SoldeCard
        label="Repos compensatoires"
        icon="&#128260;"
        pris={soldes?.repos_comp_pris ?? 0}
        total={soldes?.repos_comp_total ?? 0}
        reliquat={soldes?.reliquat_repos_comp}
        unite="jours dispo"
      />
      <PotCard pot={pot} />
    </div>
  )
}
