'use client'

import { useState, useTransition } from 'react'
import { UnreadDecision, markDecisionVue, markAllDecisionsVues } from '@/lib/notifications/actions'
import { formatDateFr, labelTypeConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'
import { formatMinutes } from '@/lib/horaires/utils'
import { useRouter } from 'next/navigation'

const CHAMP_LABELS: Record<string, string> = {
  arrivee: 'Arrivée',
  midi_out: 'Midi Out',
  midi_in: 'Midi In',
  depart: 'Départ',
}

function DecisionItem({
  decision,
  onDismiss,
}: {
  decision: UnreadDecision
  onDismiss: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isReassignation = decision.type === 'reassignation'
  const isApproved = isReassignation
    ? null
    : decision.data.statut === 'approuve'

  const message = (() => {
    if (decision.type === 'conge') {
      const c = decision.data
      const period = c.date_debut === c.date_fin
        ? formatDateFr(c.date_debut)
        : `${formatDateFr(c.date_debut)} → ${formatDateFr(c.date_fin)}`
      const demiLabel = c.demi_journee ? ` (${labelDemiJournee(c.demi_journee)})` : ''
      return `${labelTypeConge(c.type)} du ${period}${demiLabel} (${formatNbJours(c.nb_jours)}j)`
    }
    if (decision.type === 'heures_sup') {
      const h = decision.data
      return `Heures sup du ${formatDateFr(h.date)} (${formatMinutes(h.nb_minutes)})`
    }
    if (decision.type === 'reassignation') {
      const r = decision.data
      const bureau = (r as Record<string, unknown>).bureau as { nom: string } | null
      const conge = (r as Record<string, unknown>).conge as { profile: { prenom: string; nom: string } } | null
      return `Réaffectation au ${bureau?.nom ?? 'bureau'} le ${formatDateFr(r.date)} (remplacement de ${conge?.profile?.prenom ?? ''} ${conge?.profile?.nom ?? ''})`
    }
    const cr = decision.data
    return `Correction pointage du ${formatDateFr(cr.date)} — ${CHAMP_LABELS[cr.champ] ?? cr.champ} → ${cr.heure_proposee}`
  })()

  const adminComment = (() => {
    if (decision.type === 'reassignation') return null
    if (decision.type === 'correction') return decision.data.commentaire_admin
    return decision.data.commentaire_admin
  })()

  const table = decision.type === 'conge'
    ? 'conges' as const
    : decision.type === 'heures_sup'
      ? 'demandes_heures_sup' as const
      : decision.type === 'reassignation'
        ? 'reassignations_temporaires' as const
        : 'corrections_pointage' as const

  function handleDismiss() {
    startTransition(async () => {
      await markDecisionVue(table, decision.data.id)
      onDismiss()
    })
  }

  const bgClass = isReassignation
    ? 'bg-blue-50 border-blue-200'
    : isApproved
      ? 'bg-green-50 border-green-200'
      : 'bg-red-50 border-red-200'

  const emoji = isReassignation ? '🔄' : isApproved ? '✅' : '❌'
  const statusLabel = isReassignation
    ? 'Réaffectation'
    : isApproved
      ? 'Approuvé'
      : 'Refusé'
  const statusColor = isReassignation
    ? 'text-blue-700'
    : isApproved
      ? 'text-green-700'
      : 'text-red-700'

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${bgClass}`}>
      <span className="text-sm flex-shrink-0 mt-0.5">
        {emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#1a2332]">
          <span className={`font-bold ${statusColor}`}>
            {statusLabel}
          </span>
          {' — '}
          {message}
        </p>
        {adminComment && (
          <p className="text-[10px] text-gray-500 mt-0.5 italic">
            Commentaire RH : {adminComment}
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        disabled={isPending}
        className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold flex-shrink-0 mt-0.5"
      >
        {isPending ? '...' : 'OK'}
      </button>
    </div>
  )
}

export default function NotificationsBanner({
  decisions: initialDecisions,
}: {
  decisions: UnreadDecision[]
}) {
  const [decisions, setDecisions] = useState(initialDecisions)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (decisions.length === 0) return null

  function handleDismissOne(id: string) {
    setDecisions((prev) => prev.filter((d) => d.data.id !== id))
    router.refresh()
  }

  function handleDismissAll() {
    startTransition(async () => {
      await markAllDecisionsVues()
      setDecisions([])
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Notifications
          <span className="ml-2 bg-[#e53e3e] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {decisions.length}
          </span>
        </p>
        {decisions.length > 1 && (
          <button
            onClick={handleDismissAll}
            disabled={isPending}
            className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold"
          >
            {isPending ? '...' : 'Tout marquer comme lu'}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {decisions.map((d) => (
          <DecisionItem
            key={d.data.id}
            decision={d}
            onDismiss={() => handleDismissOne(d.data.id)}
          />
        ))}
      </div>
    </div>
  )
}
