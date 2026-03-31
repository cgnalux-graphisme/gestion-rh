'use client'

import { useState, useTransition } from 'react'
import { DemandeHeuresSup, Profile } from '@/types/database'
import { formatDateFr } from '@/lib/utils/dates'
import { formatMinutes } from '@/lib/horaires/utils'
import { traiterDemandeHSAction } from '@/lib/heures-sup/admin-actions'

type DemandeHSWithProfile = DemandeHeuresSup & {
  profile: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

const STATUT_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  en_attente: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'En attente' },
  approuve: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approuvé' },
  refuse: { bg: 'bg-red-100', text: 'text-red-700', label: 'Refusé' },
}

export default function DemandesHSTable({ demandes }: { demandes: DemandeHSWithProfile[] }) {
  const [isPending, startTransition] = useTransition()
  const [refuseId, setRefuseId] = useState<string | null>(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleApprouver(id: string) {
    setFeedback(null)
    startTransition(async () => {
      const result = await traiterDemandeHSAction(id, 'approuve')
      if (result.error) setFeedback({ type: 'error', message: result.error })
      else setFeedback({ type: 'success', message: 'Demande approuvée' })
    })
  }

  function handleRefuser(id: string) {
    if (!motifRefus.trim()) return
    setFeedback(null)
    startTransition(async () => {
      const result = await traiterDemandeHSAction(id, 'refuse', motifRefus)
      if (result.error) setFeedback({ type: 'error', message: result.error })
      else {
        setFeedback({ type: 'success', message: 'Demande refusée' })
        setRefuseId(null)
        setMotifRefus('')
      }
    })
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {demandes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Aucune demande d&apos;heures supplémentaires.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Travailleur</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Durée</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Motif</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => {
                const badge = STATUT_BADGES[d.statut] ?? STATUT_BADGES.en_attente
                return (
                  <tr key={d.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#1a2332]">
                      {d.profile.prenom} {d.profile.nom}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDateFr(d.date)}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{formatMinutes(d.nb_minutes)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={d.commentaire_travailleur ?? ''}>
                      {d.commentaire_travailleur || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.statut === 'en_attente' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprouver(d.id)}
                            disabled={isPending}
                            className="text-xs font-bold text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            ✓ Approuver
                          </button>
                          <button
                            onClick={() => setRefuseId(refuseId === d.id ? null : d.id)}
                            disabled={isPending}
                            className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            ✗ Refuser
                          </button>
                        </div>
                      ) : d.statut === 'refuse' && d.commentaire_admin ? (
                        <span className="text-xs text-gray-400 italic" title={d.commentaire_admin}>
                          {d.commentaire_admin.length > 30
                            ? d.commentaire_admin.slice(0, 30) + '...'
                            : d.commentaire_admin}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal refus */}
      {refuseId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-[#1a2332]">Motif du refus</p>
          <textarea
            value={motifRefus}
            onChange={(e) => setMotifRefus(e.target.value)}
            rows={2}
            placeholder="Expliquez la raison du refus..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e] resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setRefuseId(null); setMotifRefus('') }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Annuler
            </button>
            <button
              onClick={() => handleRefuser(refuseId)}
              disabled={isPending || !motifRefus.trim()}
              className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg disabled:opacity-50"
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
