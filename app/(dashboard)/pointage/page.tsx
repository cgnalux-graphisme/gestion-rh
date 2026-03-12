import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkerMonthPointage } from '@/lib/pointage/actions'
import Link from 'next/link'
import { Pointage } from '@/types/database'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getAllDaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default async function PointagePage({
  searchParams,
}: {
  searchParams: { mois?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (searchParams.mois) {
    const [y, m] = searchParams.mois.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) { year = y; month = m }
  }

  const pointages = await getWorkerMonthPointage(year, month)
  const byDate: Record<string, Pointage> = {}
  for (const p of pointages) byDate[p.date] = p

  const days = getAllDaysOfMonth(year, month)
  const today = now.toISOString().slice(0, 10)

  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-[#1a2332]">
          ⏱ Mon pointage — {MOIS_FR[month - 1]} {year}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/pointage?mois=${prevParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            ← Précédent
          </Link>
          <Link
            href={`/pointage?mois=${nextParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#1a2332] text-white text-[10px]">
              <th className="text-left px-3 py-2 font-semibold">Date</th>
              <th className="text-center px-2 py-2">Arrivée</th>
              <th className="text-center px-2 py-2">Midi Out</th>
              <th className="text-center px-2 py-2">Midi In</th>
              <th className="text-center px-2 py-2">Départ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {days.map((d) => {
              const dow = d.getDay()
              const isWeekend = dow === 0 || dow === 6
              const dateStr = d.toISOString().slice(0, 10)
              const isToday = dateStr === today
              const p = byDate[dateStr]
              const DOW_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

              return (
                <tr
                  key={dateStr}
                  className={[
                    isWeekend ? 'bg-gray-50 text-gray-300' : 'hover:bg-gray-50',
                    isToday ? '!bg-red-50' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-1.5 font-medium text-[#1a2332]">
                    <span className="text-[9px] text-gray-400 mr-1">{DOW_FR[dow]}</span>
                    {d.getDate()}
                  </td>
                  {isWeekend ? (
                    <td colSpan={4} className="text-center text-gray-200 text-[9px]">—</td>
                  ) : (
                    <>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.arrivee ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.midi_out ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.midi_in ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.depart ?? null)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
