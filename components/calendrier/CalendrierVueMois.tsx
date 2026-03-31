import React from 'react'
import type { TravailleurCalendrier } from '@/types/calendrier'
import StatutCell from './StatutCell'

type Props = {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string  // 1er du mois ISO
}

function nomAbregé(prenom: string, nom: string): string {
  return `${prenom[0]}. ${nom}`
}

export default function CalendrierVueMois({ travailleurs, dateDebut }: Props) {
  // Générer toutes les dates du mois en UTC
  const [year, month] = dateDebut.split('-').map(Number)
  const nbJours = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const dates: string[] = []
  for (let d = 1; d <= nbJours; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
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
    <>
      {/* Message mobile */}
      <p className="md:hidden text-sm text-gray-500 p-4">
        La vue mensuelle n&apos;est pas disponible sur mobile. Utilisez la vue semaine.
      </p>

      {/* Grille desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[120px]">
                Travailleur
              </th>
              {dates.map((date) => (
                <th key={date} className="px-0.5 py-2 text-center font-medium text-gray-400 min-w-[28px]">
                  {parseInt(date.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <React.Fragment key={service}>
                <tr>
                  <td
                    colSpan={dates.length + 1}
                    className="sticky left-0 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {service}
                  </td>
                </tr>
                {byService.get(service)!.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white z-10 px-3 py-1 text-xs text-gray-700 whitespace-nowrap">
                      {nomAbregé(t.prenom, t.nom)}
                    </td>
                    {t.jours.map((jour) => (
                      <td key={jour.date} className="px-0.5 py-1 text-center">
                        <StatutCell statut={jour.statut} label={jour.label} size="sm" indicateurs={jour.indicateurs} />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {travailleurs.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} className="text-center py-8 text-gray-400">
                  Aucun travailleur trouvé pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
