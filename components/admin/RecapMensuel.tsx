import { Profile, Service, UserBureauSchedule, Bureau } from '@/types/database'
import Link from 'next/link'

type WorkerWithSchedules = Profile & {
  service?: Service
  schedules: UserBureauSchedule[]
}

function getWeekdaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function jourFromDate(d: Date): 1 | 2 | 3 | 4 | 5 {
  return d.getDay() as 1 | 2 | 3 | 4 | 5
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default function RecapMensuel({
  workers,
  year,
  month,
}: {
  workers: WorkerWithSchedules[]
  year: number
  month: number
}) {
  const weekdays = getWeekdaysOfMonth(year, month)

  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  // Group weekdays by week number for the sticky header weeks
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function getBureauLabel(worker: WorkerWithSchedules, date: Date): string {
    const jour = jourFromDate(date)
    const schedule = worker.schedules.find((s) => s.jour === jour)
    if (!schedule) return '—'
    const bureau = schedule.bureau as Bureau | undefined
    return bureau?.code ?? bureau?.nom?.slice(0, 3).toUpperCase() ?? '?'
  }

  return (
    <div className="max-w-full overflow-x-auto">
      {/* Header navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#1a2332]">
          📅 Planning mensuel — {MOIS_FR[month - 1]} {year}
        </h2>
        <div className="flex gap-2 items-center">
          <Link
            href={`/admin/recap?mois=${prevParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Précédent
          </Link>
          <Link
            href={`/admin/recap?mois=${nextParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Suivant →
          </Link>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-xs italic">
          Aucun travailleur actif
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="text-[10px] border-collapse w-full">
            <thead>
              <tr className="bg-[#1a2332] text-white">
                <th className="text-left px-3 py-2 font-semibold w-40 sticky left-0 bg-[#1a2332] z-10">
                  Travailleur
                </th>
                {weekdays.map((d) => {
                  const isToday = d.getTime() === today.getTime()
                  const dow = ['L', 'M', 'Me', 'J', 'V'][d.getDay() - 1]
                  return (
                    <th
                      key={d.toISOString()}
                      className={`text-center px-1 py-2 font-medium w-10 min-w-[2.5rem] ${
                        isToday ? 'bg-[#e53e3e]' : ''
                      }`}
                    >
                      <div className="text-white/60 text-[8px]">{dow}</div>
                      <div>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 sticky left-0 bg-white border-r border-gray-100 z-10">
                    <div className="font-semibold text-[#1a2332] truncate max-w-[9rem]">
                      {w.prenom} {w.nom}
                    </div>
                    <div className="text-[8px] text-gray-400 truncate">{w.service?.nom}</div>
                  </td>
                  {weekdays.map((d) => {
                    const label = getBureauLabel(w, d)
                    const isToday = d.getTime() === today.getTime()
                    return (
                      <td
                        key={d.toISOString()}
                        className={`text-center px-1 py-2 ${isToday ? 'bg-red-50' : ''}`}
                      >
                        {label === '—' ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[9px]">
                            {label}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[9px] text-gray-400 mt-3">
        Les cases indiquent le code bureau d'affectation hebdomadaire du travailleur.{' '}
        <Link href="/admin/travailleurs" className="underline hover:text-gray-600">
          Gérer les affectations →
        </Link>
      </p>
    </div>
  )
}
