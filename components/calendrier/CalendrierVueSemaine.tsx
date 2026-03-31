import React from 'react'
import type { TravailleurCalendrier } from '@/types/calendrier'
import StatutCell from './StatutCell'
import { formatLocalDate } from '@/lib/utils/dates'

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Props = {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string  // lundi ISO de la semaine
}

function formatColHeader(dateISO: string): string {
  // Parser en UTC pour éviter le décalage timezone
  const [, , day] = dateISO.split('-').map(Number)
  const d = new Date(dateISO + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const jour = JOURS_COURTS[dow === 0 ? 6 : dow - 1]
  return `${jour} ${day}`
}

export default function CalendrierVueSemaine({ travailleurs, dateDebut }: Props) {
  // Générer les 7 dates de la semaine en UTC
  const dates: string[] = []
  const [y, m, d] = dateDebut.split('-').map(Number)
  for (let i = 0; i < 7; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i))
    dates.push(formatLocalDate(dt))
  }

  // Grouper par service
  const services: string[] = []
  const byService = new Map<string, TravailleurCalendrier[]>()
  for (const t of travailleurs) {
    if (!byService.has(t.service)) {
      services.push(t.service)
      byService.set(t.service, [])
    }
    byService.get(t.service)!.push(t)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[140px]">
              Travailleur
            </th>
            {dates.map((date) => (
              <th key={date} className="px-1 py-2 text-center font-medium text-gray-500 min-w-[40px]">
                {formatColHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <React.Fragment key={service}>
              <tr>
                <td
                  colSpan={8}
                  className="sticky left-0 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {service}
                </td>
              </tr>
              {byService.get(service)!.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white z-10 px-3 py-1.5 text-sm text-gray-700 whitespace-nowrap">
                    {t.prenom} {t.nom}
                  </td>
                  {t.jours.map((jour) => (
                    <td key={jour.date} className="px-1 py-1.5 text-center">
                      <StatutCell statut={jour.statut} label={jour.label} size="md" indicateurs={jour.indicateurs} />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
          {travailleurs.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                Aucun travailleur trouvé pour ces filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
