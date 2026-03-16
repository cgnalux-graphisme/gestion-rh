import type { AbsenceParType } from '@/types/rapports'

export default function AbsencesParTypeChart({
  absencesParType,
  totalAbsences,
}: {
  absencesParType: AbsenceParType[]
  totalAbsences: number
}) {
  // Donut SVG
  const radius = 50
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const segments = absencesParType
    .filter((a) => a.count > 0)
    .map((a) => {
      const pct = totalAbsences > 0 ? a.count / totalAbsences : 0
      const dashArray = pct * circumference
      const seg = { ...a, dashArray, dashOffset: -offset }
      offset += dashArray
      return seg
    })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Absences par type</h3>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            {/* Fond gris */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
            {/* Segments */}
            {segments.map((seg) => (
              <circle
                key={seg.type}
                cx="60" cy="60" r={radius}
                fill="none"
                stroke={seg.couleur}
                strokeWidth="16"
                strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-700">{totalAbsences}</span>
          </div>
        </div>

        {/* Légende */}
        <div className="space-y-2">
          {absencesParType.map((a) => (
            <div key={a.type} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.couleur }} />
              <span className="text-gray-600">{a.label}</span>
              <span className="font-semibold text-gray-800 ml-auto">{a.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
