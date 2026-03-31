'use client'

import { MouvementPotHeures } from '@/lib/heures-sup/actions'
import { formatMinutes } from '@/lib/horaires/utils'

const TYPE_CONFIG: Record<MouvementPotHeures['type'], { label: string; bg: string; text: string }> = {
  hs_approuvee: { label: 'HS', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  recup_prise: { label: 'Récup', bg: 'bg-amber-100', text: 'text-amber-700' },
  deduction_correction: { label: 'Déduction', bg: 'bg-red-100', text: 'text-red-700' },
  correction_admin: { label: 'Admin', bg: 'bg-blue-100', text: 'text-blue-700' },
  solde_initial: { label: 'Initial', bg: 'bg-gray-100', text: 'text-gray-600' },
}

interface Props {
  mouvements: MouvementPotHeures[]
}

export default function JournalMouvements({ mouvements }: Props) {
  if (mouvements.length === 0) {
    return (
      <div className="text-center py-6 text-[11px] text-gray-400 italic">
        Aucun mouvement cette année
      </div>
    )
  }

  // Afficher du plus récent au plus ancien
  const sorted = [...mouvements].reverse()

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2 px-2 font-semibold">Date</th>
            <th className="py-2 px-2 font-semibold">Type</th>
            <th className="py-2 px-2 font-semibold">Description</th>
            <th className="py-2 px-2 font-semibold text-right">+/-</th>
            <th className="py-2 px-2 font-semibold text-right">Solde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((m, i) => {
            const cfg = TYPE_CONFIG[m.type]
            const isPositif = m.delta_minutes >= 0
            return (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                  {m.date.split('-').reverse().join('/')}
                </td>
                <td className="py-2 px-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </td>
                <td className="py-2 px-2 text-gray-600 max-w-[200px] truncate">
                  {m.description}
                </td>
                <td className={`py-2 px-2 text-right font-semibold whitespace-nowrap ${isPositif ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositif ? '+' : ''}{formatMinutes(m.delta_minutes)}
                </td>
                <td className="py-2 px-2 text-right font-bold text-[#1a2332] whitespace-nowrap">
                  {formatMinutes(m.solde_apres)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
