import type { PotHeuresService } from '@/types/rapports'
import { formatMinutes } from '@/lib/horaires/utils'

export default function PotHeuresChart({ potHeures }: { potHeures: PotHeuresService[] }) {
  const maxAbs = Math.max(...potHeures.map((s) => Math.abs(s.moyenneMinutes)), 1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Pot d&apos;heures par service</h3>
      <div className="space-y-3">
        {potHeures.map((s) => {
          const pct = Math.round((Math.abs(s.moyenneMinutes) / maxAbs) * 50)
          const isPositive = s.moyenneMinutes >= 0
          return (
            <div key={s.serviceId}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{s.service} ({s.nbTravailleurs})</span>
                <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                  {isPositive ? '+' : ''}{formatMinutes(s.moyenneMinutes)} (moy.)
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full relative">
                {/* Ligne centrale */}
                <div className="absolute left-1/2 top-0 w-px h-2 bg-gray-300" />
                {/* Barre */}
                <div
                  className={`absolute top-0 h-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{
                    left: isPositive ? '50%' : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
        {potHeures.length === 0 && (
          <p className="text-xs text-gray-400">Aucune donnée sur la période</p>
        )}
      </div>
    </div>
  )
}
