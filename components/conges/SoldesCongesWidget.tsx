import { SoldeConges } from '@/types/database'

interface Props {
  soldes: SoldeConges | null
}

function ProgressBar({ label, pris, total }: { label: string; pris: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((pris / total) * 100)) : 0
  const disponible = Math.max(0, total - pris)
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-semibold text-[#1a2332]">{label}</span>
        <span className="text-[10px] text-gray-500">
          <span className="font-bold text-[#1a2332]">{disponible}</span>/{total} jour{total > 1 ? 's' : ''} disponible{disponible > 1 ? 's' : ''}
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#10b981]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5">{pris} jour{pris !== 1 ? 's' : ''} pris</div>
    </div>
  )
}

export default function SoldesCongesWidget({ soldes }: Props) {
  const annee = new Date().getFullYear()

  if (!soldes) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
          🌴 Soldes congés {annee}
        </p>
        <p className="text-[11px] text-gray-400 italic">Aucun solde configuré pour cette année.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">
        🌴 Soldes congés {annee}
      </p>
      <div className="space-y-4">
        <ProgressBar
          label="Congés annuels"
          pris={soldes.conges_annuels_pris}
          total={soldes.conges_annuels_total}
        />
        <ProgressBar
          label="Repos compensatoires"
          pris={soldes.repos_comp_pris}
          total={soldes.repos_comp_total}
        />
      </div>
    </div>
  )
}
