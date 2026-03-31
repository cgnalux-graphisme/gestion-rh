'use client'

import type { TravailleurBureau, JourBureau, StatutSimple } from '@/types/calendrier-bureau'
import CoverageAlert from './CoverageAlert'

type Props = {
  travailleurs: TravailleurBureau[]
  jours: JourBureau[]
}

const STATUT_CONFIG: Record<StatutSimple, { bg: string; text: string; letter: string }> = {
  P: { bg: 'bg-green-100', text: 'text-green-800', letter: 'P' },
  C: { bg: 'bg-blue-100', text: 'text-blue-800', letter: 'C' },
  M: { bg: 'bg-orange-100', text: 'text-orange-800', letter: 'M' },
  F: { bg: 'bg-purple-100', text: 'text-purple-800', letter: 'F' },
  '-': { bg: 'bg-gray-100', text: 'text-gray-400', letter: '-' },
  '': { bg: 'bg-white', text: 'text-gray-300', letter: '' },
}

const JOURS_ABREGES = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']

function formatColHeader(dateISO: string): { dow: string; day: string } {
  const d = new Date(dateISO + 'T12:00:00')
  return {
    dow: JOURS_ABREGES[d.getDay()],
    day: String(d.getDate()),
  }
}

export default function BureauPresenceGrid({ travailleurs, jours }: Props) {
  // Group by service
  const byService = new Map<string, TravailleurBureau[]>()
  for (const t of travailleurs) {
    const arr = byService.get(t.service_nom) ?? []
    arr.push(t)
    byService.set(t.service_nom, arr)
  }

  const dates = jours.map(j => j.date)
  const joursMap = new Map(jours.map(j => [j.date, j]))

  if (travailleurs.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-4">Aucun travailleur affecté à ce bureau pour cette période.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left px-2 py-1 font-semibold text-gray-600 min-w-[120px]">
              Travailleur
            </th>
            {dates.map(dateStr => {
              const { dow, day } = formatColHeader(dateStr)
              const jour = joursMap.get(dateStr)
              const d = new Date(dateStr + 'T12:00:00')
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <th
                  key={dateStr}
                  className={`text-center px-0.5 py-1 min-w-[28px] ${isWeekend ? 'bg-gray-50' : ''}`}
                >
                  <div className="text-gray-400 font-normal">{dow}</div>
                  <div className="font-bold text-gray-700">{day}</div>
                  {jour && <CoverageAlert coverage={jour.coverage} />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from(byService.entries()).map(([serviceName, workers]) => (
            <ServiceGroup key={serviceName} serviceName={serviceName} workers={workers} dates={dates} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ServiceGroup({
  serviceName,
  workers,
  dates,
}: {
  serviceName: string
  workers: TravailleurBureau[]
  dates: string[]
}) {
  return (
    <>
      <tr>
        <td
          colSpan={dates.length + 1}
          className="bg-gray-50 px-2 py-1 font-bold text-gray-500 text-[10px] uppercase tracking-wider border-t"
        >
          {serviceName}
        </td>
      </tr>
      {workers.map(worker => (
        <tr key={worker.id} className="hover:bg-gray-50/50">
          <td className="sticky left-0 bg-white z-10 px-2 py-1 font-medium text-gray-700 whitespace-nowrap">
            {worker.prenom} {worker.nom}
            {worker.is_temp && (
              <span className="ml-1 text-[8px] text-amber-600" title="Affectation temporaire">↔</span>
            )}
          </td>
          {dates.map(dateStr => {
            const jour = worker.jours.find(j => j.date === dateStr)
            const statut = jour?.statut ?? ''
            const config = STATUT_CONFIG[statut]
            return (
              <td key={dateStr} className="text-center px-0.5 py-1">
                <div
                  className={`w-6 h-6 mx-auto rounded flex items-center justify-center font-bold ${config.bg} ${config.text}`}
                  title={statut === 'P' ? 'Présent' : statut === 'C' ? 'Congé' : statut === 'M' ? 'Maladie' : statut === 'F' ? 'Férié' : ''}
                >
                  {config.letter}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
