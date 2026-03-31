'use client'

import { useState } from 'react'
import { Conge, AnnulationConge } from '@/types/database'
import { annulerCongeAction } from '@/lib/conges/actions'
import { formatDateFr, labelTypeConge, labelStatutConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'
import DemandeAnnulationModal from './DemandeAnnulationModal'

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
  annule: 'bg-gray-100 text-gray-500',
}

interface Props {
  conges: Conge[]
  annulations: AnnulationConge[]
  onRefresh: () => void
}

export default function DemandesEnCours({ conges, annulations, onRefresh }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [annulationCongeId, setAnnulationCongeId] = useState<string | null>(null)

  // Congés en attente + approuvés à venir
  const today = new Date().toISOString().slice(0, 10)
  const congesEnCours = conges.filter(
    (c) => c.statut === 'en_attente' || (c.statut === 'approuve' && c.date_debut > today)
  )

  // Annulations en attente
  const annulationsEnCours = annulations.filter((a) => a.statut === 'en_attente')
  const annulationCongeIds = new Set(annulationsEnCours.map((a) => a.conge_id))

  async function handleAnnulerEnAttente(id: string) {
    if (!confirm('Confirmer l\'annulation de cette demande ?')) return
    setLoadingId(id)
    const result = await annulerCongeAction(id)
    if (result.error) setErrors((prev) => ({ ...prev, [id]: result.error! }))
    else onRefresh()
    setLoadingId(null)
  }

  if (congesEnCours.length === 0 && annulationsEnCours.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-[11px] italic">
        Aucune demande en cours
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {congesEnCours.map((c) => (
        <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-[#1a2332]">
                {labelTypeConge(c.type)}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                {labelStatutConge(c.statut)}
              </span>
              {annulationCongeIds.has(c.id) && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  Annulation demandée
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {c.demi_journee
                ? <>{formatDateFr(c.date_debut)} &mdash; <strong>{formatNbJours(c.nb_jours)} j</strong> ({labelDemiJournee(c.demi_journee)})</>
                : <>{formatDateFr(c.date_debut)} &rarr; {formatDateFr(c.date_fin)} &mdash; <strong>{formatNbJours(c.nb_jours)} j</strong></>
              }
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
          <div className="flex-shrink-0 flex gap-1.5">
            {c.statut === 'en_attente' && (
              <button
                onClick={() => handleAnnulerEnAttente(c.id)}
                disabled={loadingId === c.id}
                className="text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 transition-colors disabled:opacity-50"
              >
                {loadingId === c.id ? '...' : 'Annuler'}
              </button>
            )}
            {c.statut === 'approuve' && c.date_debut > today && !annulationCongeIds.has(c.id) && (
              <button
                onClick={() => setAnnulationCongeId(c.id)}
                className="text-[10px] text-purple-600 hover:text-purple-800 border border-purple-200 rounded px-2 py-1 transition-colors"
              >
                Demander l&apos;annulation
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Annulations récentes refusées */}
      {annulations.filter((a) => a.statut === 'refuse').slice(0, 3).map((a) => (
        <div key={a.id} className="px-4 py-2.5 bg-red-50/50">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Annulation refusée
            </span>
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">{a.motif}</div>
          {a.commentaire_admin && (
            <div className="text-[10px] text-red-600 mt-0.5 italic">Admin : {a.commentaire_admin}</div>
          )}
        </div>
      ))}

      <DemandeAnnulationModal
        congeId={annulationCongeId ?? ''}
        open={!!annulationCongeId}
        onClose={() => setAnnulationCongeId(null)}
        onSuccess={onRefresh}
      />
    </div>
  )
}
