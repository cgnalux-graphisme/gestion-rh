import type { TopAbsenceEntry } from '@/types/rapports'

export default function TopAbsences({ topAbsences }: { topAbsences: TopAbsenceEntry[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Top 5 — Absences (maladie + non justifié)
      </h3>
      {topAbsences.length === 0 ? (
        <p className="text-xs text-gray-400">Aucune absence sur la période</p>
      ) : (
        <ol className="space-y-2">
          {topAbsences.map((e, i) => (
            <li key={`${e.prenom}-${e.nom}`} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0">
                {i + 1}
              </span>
              <span className="font-medium text-gray-800">
                {e.prenom} {e.nom}
              </span>
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">
                {e.service}
              </span>
              <span className="ml-auto text-gray-600">
                {e.total}j ({e.joursMaladie} maladie, {e.joursAbsent} non justifié)
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
