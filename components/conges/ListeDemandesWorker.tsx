'use client'

import { useState } from 'react'
import { Conge } from '@/types/database'
import { annulerCongeAction } from '@/lib/conges/actions'
import { formatDateFr, labelTypeConge, labelStatutConge } from '@/lib/utils/dates'

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

interface Props {
  conges: Conge[]
}

export default function ListeDemandesWorker({ conges }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleAnnuler(id: string) {
    if (!confirm('Confirmer l\'annulation de cette demande ?')) return
    setLoadingId(id)
    const result = await annulerCongeAction(id)
    if (result.error) setErrors((prev) => ({ ...prev, [id]: result.error! }))
    setLoadingId(null)
  }

  if (conges.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-xs italic">
        Aucune demande de congé
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-50">
        {conges.map((c) => (
          <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-semibold text-[#1a2332]">
                  {labelTypeConge(c.type)}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                  {labelStatutConge(c.statut)}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)} — <strong>{c.nb_jours} j</strong>
              </div>
              {c.commentaire_admin && (
                <div className="text-[10px] text-gray-400 mt-1 italic">
                  Note admin : {c.commentaire_admin}
                </div>
              )}
              {errors[c.id] && (
                <div className="text-[10px] text-red-500 mt-1">{errors[c.id]}</div>
              )}
            </div>
            {c.statut === 'en_attente' && (
              <button
                onClick={() => handleAnnuler(c.id)}
                disabled={loadingId === c.id}
                className="flex-shrink-0 text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 transition-colors disabled:opacity-50"
              >
                {loadingId === c.id ? '...' : 'Annuler'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
