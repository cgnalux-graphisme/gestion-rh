import type { TauxPresenceService } from '@/types/rapports'

export default function TauxPresenceChart({
  tauxPresence,
  tauxGlobal,
}: {
  tauxPresence: TauxPresenceService[]
  tauxGlobal: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-gray-900">{tauxGlobal}%</span>
        <span className="text-sm text-gray-500">Taux de présence global</span>
      </div>
      <div className="space-y-3">
        {tauxPresence.map((s) => (
          <div key={s.serviceId}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{s.service}</span>
              <span>{s.taux}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${s.taux}%` }}
              />
            </div>
          </div>
        ))}
        {tauxPresence.length === 0 && (
          <p className="text-xs text-gray-400">Aucune donnée sur la période</p>
        )}
      </div>
    </div>
  )
}
