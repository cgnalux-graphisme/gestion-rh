'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Profile, Service, Pointage, DayStatusRecord, DayStatus } from '@/types/database'
import { updateDayStatusAction } from '@/lib/pointage/admin-actions'
import PointageManquantModal from '@/components/admin/PointageManquantModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  workers: (Profile & { service?: Service })[]
  year: number
  month: number
  allPointages: Pointage[]
  allDayStatuses: DayStatusRecord[]
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const STATUS_LABELS: Record<string, string> = {
  P: 'Présent', C: 'Congé', M: 'Maladie', R: 'Récup.', F: 'Férié', A: 'Absent',
}

const STATUS_BG: Record<DayStatus, string> = {
  P: 'bg-[#10b981] text-white',
  C: 'bg-[#f59e0b] text-white',
  M: 'bg-[#ef4444] text-white',
  R: 'bg-[#6c63ff] text-white',
  F: 'bg-[#6b7280] text-white',
  A: 'bg-[#f97316] text-white',
  '?': 'bg-white text-red-600 border border-red-400 border-dashed',
  W: 'bg-gray-100 text-gray-300',
  '-': 'bg-white text-gray-200',
}

function getAllWeekdays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    if (d.getDay() >= 1 && d.getDay() <= 5) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function computeStatus(
  userId: string,
  dateStr: string,
  date: Date,
  today: Date,
  pointageMap: Record<string, Record<string, Pointage>>,
  statusMap: Record<string, Record<string, DayStatusRecord>>
): DayStatus {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return 'W'
  if (date > today) return '-'

  const ds = statusMap[userId]?.[dateStr]
  if (ds) return ds.status as DayStatus

  const p = pointageMap[userId]?.[dateStr]
  if (p && p.arrivee && p.midi_out && p.midi_in && p.depart) return 'P'

  return '?'
}

export default function RecapMensuel({
  workers,
  year,
  month,
  allPointages,
  allDayStatuses,
}: Props) {
  const weekdays = getAllWeekdays(year, month)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pointageMap: Record<string, Record<string, Pointage>> = {}
  for (const p of allPointages) {
    if (!pointageMap[p.user_id]) pointageMap[p.user_id] = {}
    pointageMap[p.user_id][p.date] = p
  }
  const statusMap: Record<string, Record<string, DayStatusRecord>> = {}
  for (const ds of allDayStatuses) {
    if (!statusMap[ds.user_id]) statusMap[ds.user_id] = {}
    statusMap[ds.user_id][ds.date] = ds
  }

  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  const [modal, setModal] = useState<{ userId: string; date: string; workerName: string } | null>(null)

  async function handleStatusChange(userId: string, date: string, status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A') {
    await updateDayStatusAction(userId, date, status)
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#1a2332]">
          📅 Pointage mensuel — {MOIS_FR[month - 1]} {year}
        </h2>
        <div className="flex gap-2 items-center">
          <Link
            href={`/admin/recap?mois=${prevParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            ← Précédent
          </Link>
          <Link
            href={`/admin/recap?mois=${nextParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
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
                      className={`text-center px-1 py-2 font-medium w-10 min-w-[2.5rem] ${isToday ? 'bg-[#e53e3e]' : ''}`}
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
                    const dateStr = d.toISOString().slice(0, 10)
                    const isToday = d.getTime() === today.getTime()
                    const status = computeStatus(w.id, dateStr, d, today, pointageMap, statusMap)
                    const bgClass = STATUS_BG[status]
                    const isMissing = status === '?'
                    const isPast = d <= today && d.getDay() >= 1 && d.getDay() <= 5

                    const cell = (
                      <span
                        className={[
                          'inline-flex items-center justify-center w-7 h-5 rounded text-[9px] font-bold',
                          bgClass,
                        ].join(' ')}
                      >
                        {status === '-' ? '' : status}
                      </span>
                    )

                    return (
                      <td
                        key={dateStr}
                        className={`text-center px-1 py-1.5 ${isToday ? 'bg-red-50' : ''}`}
                      >
                        {isMissing ? (
                          <button
                            onClick={() =>
                              setModal({
                                userId: w.id,
                                date: dateStr,
                                workerName: `${w.prenom} ${w.nom}`,
                              })
                            }
                            className="cursor-pointer"
                            title="Pointage manquant — cliquer pour corriger"
                          >
                            {cell}
                          </button>
                        ) : isPast && status !== 'W' && status !== '-' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="cursor-pointer" title="Changer le statut">
                              {cell}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="text-[10px]">
                              {(['P', 'C', 'M', 'R', 'F', 'A'] as const).map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  className="text-[10px]"
                                  onClick={() => handleStatusChange(w.id, dateStr, s)}
                                >
                                  {STATUS_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          cell
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

      <div className="flex flex-wrap gap-2 mt-3">
        {Object.entries(STATUS_LABELS).map(([s, label]) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`inline-flex w-5 h-4 rounded text-[8px] font-bold items-center justify-center ${STATUS_BG[s as DayStatus]}`}>
              {s}
            </span>
            <span className="text-[9px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {modal && (
        <PointageManquantModal
          open={true}
          onClose={() => setModal(null)}
          userId={modal.userId}
          date={modal.date}
          workerName={modal.workerName}
        />
      )}
    </div>
  )
}
