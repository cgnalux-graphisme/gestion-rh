import { formatMinutes } from '@/lib/horaires/utils'
import { SoldeConges } from '@/types/database'

interface Props {
  soldeHeures: number | null
  soldesConges: SoldeConges | null
}

export default function SoldesWidget({ soldeHeures, soldesConges }: Props) {
  const minutesValue = soldeHeures ?? 0
  const isHeuresPositif = minutesValue >= 0
  const isHeuresZero = minutesValue === 0

  // Calcul VA
  const vaTotal = soldesConges
    ? soldesConges.conges_annuels_total + soldesConges.reliquat_conges_annuels
    : 0
  const vaPris = soldesConges?.conges_annuels_pris ?? 0
  const vaDisponible = vaTotal - vaPris

  // Calcul RC
  const rcTotal = soldesConges
    ? soldesConges.repos_comp_total + soldesConges.reliquat_repos_comp
    : 0
  const rcPris = soldesConges?.repos_comp_pris ?? 0
  const rcDisponible = rcTotal - rcPris

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Solde Heures */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          ⏱ Solde heures
        </p>
        {soldeHeures === null ? (
          <p className="text-xs text-gray-400 italic">—</p>
        ) : (
          <>
            <p
              className={`text-xl font-black ${
                isHeuresZero
                  ? 'text-gray-400'
                  : isHeuresPositif
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {isHeuresPositif && !isHeuresZero ? '+' : ''}
              {formatMinutes(minutesValue)}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">
              {isHeuresPositif && !isHeuresZero
                ? 'Crédit heures'
                : isHeuresZero
                ? 'Solde équilibré'
                : 'Débit heures'}
            </p>
          </>
        )}
      </div>

      {/* Solde VA */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          🌴 Solde VA
        </p>
        {!soldesConges ? (
          <p className="text-xs text-gray-400 italic">—</p>
        ) : (
          <>
            <p
              className={`text-xl font-black ${
                vaDisponible > 0
                  ? 'text-green-600'
                  : vaDisponible === 0
                  ? 'text-gray-400'
                  : 'text-red-600'
              }`}
            >
              {vaDisponible}j
            </p>
            <p className="text-[9px] text-gray-400 mt-1">
              {vaPris} pris / {vaTotal} total
            </p>
          </>
        )}
      </div>

      {/* Solde RC */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          🔄 Solde RC
        </p>
        {!soldesConges ? (
          <p className="text-xs text-gray-400 italic">—</p>
        ) : (
          <>
            <p
              className={`text-xl font-black ${
                rcDisponible > 0
                  ? 'text-green-600'
                  : rcDisponible === 0
                  ? 'text-gray-400'
                  : 'text-red-600'
              }`}
            >
              {rcDisponible}j
            </p>
            <p className="text-[9px] text-gray-400 mt-1">
              {rcPris} pris / {rcTotal} total
            </p>
          </>
        )}
      </div>
    </div>
  )
}
