import { UserBureauSchedule } from '@/types/database'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export default function AffectationSection({
  schedules,
}: {
  schedules: UserBureauSchedule[]
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">📍 Affectation par bureau</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
          🔒 Géré par l'administration
        </span>
      </div>

      <div className="p-4 overflow-x-auto">
        {schedules.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Sur la route — aucune affectation fixe par bureau
          </p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {JOURS.map((j) => (
                  <th
                    key={j}
                    className="text-center text-gray-400 font-semibold pb-2 text-[9px] uppercase tracking-wider"
                  >
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {[1, 2, 3, 4, 5].map((day) => {
                  const s = schedules.find((sch) => sch.jour === day)
                  return (
                    <td key={day} className="text-center py-1">
                      {s ? (
                        <span className="inline-block px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[10px]">
                          {s.bureau?.nom ?? '—'}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
