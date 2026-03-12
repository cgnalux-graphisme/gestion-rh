// components/dashboard/SoldeHeuresWidget.tsx
import { formatMinutes } from '@/lib/horaires/utils'

export default function SoldeHeuresWidget({ solde }: { solde: number | null }) {
  const minutesValue = solde ?? 0
  const isPositif = minutesValue >= 0
  const isZero = minutesValue === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        ⏱ Solde heures
      </p>

      {solde === null ? (
        <p className="text-xs text-gray-400 italic">Aucun pointage enregistré cette année</p>
      ) : (
        <>
          <p
            className={`text-2xl font-black ${
              isZero
                ? 'text-gray-400'
                : isPositif
                ? 'text-green-600'
                : 'text-red-600'
            }`}
            title="Heures supplémentaires accumulées cette année"
          >
            {isPositif && !isZero ? '+' : ''}
            {formatMinutes(minutesValue)}
          </p>
          <p className="text-[9px] text-gray-400 mt-1">
            {isPositif && !isZero
              ? 'Crédit heures — année en cours'
              : isZero
              ? 'Solde équilibré'
              : 'Débit heures — année en cours'}
          </p>
        </>
      )}
    </div>
  )
}
