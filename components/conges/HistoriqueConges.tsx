'use client'

import { useState, useEffect } from 'react'
import { Conge } from '@/types/database'
import { getHistoriqueCongesAction } from '@/lib/conges/actions'
import { formatDateFr, labelTypeConge, labelStatutConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
  annule: 'bg-gray-100 text-gray-500',
}

export default function HistoriqueConges() {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [conges, setConges] = useState<Conge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getHistoriqueCongesAction(annee).then((data) => {
      setConges(data)
      setLoading(false)
    })
  }, [annee])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500">
          {conges.length} congé{conges.length !== 1 ? 's' : ''} en {annee}
        </span>
        <select
          value={annee}
          onChange={(e) => setAnnee(parseInt(e.target.value))}
          className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-6 text-[11px] text-gray-400">Chargement...</div>
      ) : conges.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-gray-400 italic">
          Aucun congé VA/RC en {annee}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 px-2 font-semibold">Type</th>
                <th className="py-2 px-2 font-semibold">Statut</th>
                <th className="py-2 px-2 font-semibold">Dates</th>
                <th className="py-2 px-2 font-semibold text-center">Jours</th>
                <th className="py-2 px-2 font-semibold">Note admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {conges.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="py-2 px-2 text-[#1a2332] font-medium">{labelTypeConge(c.type)}</td>
                  <td className="py-2 px-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                      {labelStatutConge(c.statut)}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-600">
                    {c.demi_journee
                      ? <>{formatDateFr(c.date_debut)} ({labelDemiJournee(c.demi_journee)})</>
                      : <>{formatDateFr(c.date_debut)} &rarr; {formatDateFr(c.date_fin)}</>
                    }
                  </td>
                  <td className="py-2 px-2 text-center font-semibold text-[#1a2332]">{formatNbJours(c.nb_jours)}</td>
                  <td className="py-2 px-2 text-gray-400 italic max-w-[200px] truncate">
                    {c.commentaire_admin ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
