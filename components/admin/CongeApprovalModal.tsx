'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Conge, Profile } from '@/types/database'
import { traiterCongeAction, getSignedUrlAdminAction } from '@/lib/conges/admin-actions'
import { formatDateFr, labelTypeConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conge: CongeWithProfile
  open: boolean
  onClose: () => void
  onDone: () => void
}

export default function CongeApprovalModal({ conge, open, onClose, onDone }: Props) {
  const [commentaire, setCommentaire] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [certUrl, setCertUrl] = useState<string | null>(null)
  const [loadingCert, setLoadingCert] = useState(false)

  async function handleVoirCertificat() {
    if (!conge.piece_jointe_url) return
    setLoadingCert(true)
    const url = await getSignedUrlAdminAction(conge.piece_jointe_url)
    if (url) window.open(url, '_blank')
    setLoadingCert(false)
  }

  function handleDecision(decision: 'approuve' | 'refuse') {
    setError(null)
    startTransition(async () => {
      const result = await traiterCongeAction(conge.id, decision, commentaire || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        onDone()
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#1a2332]">
            Traiter la demande de congé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-[12px]">
          {/* Infos demande */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Travailleur</span>
              <span className="font-semibold text-[#1a2332]">{conge.profile.prenom} {conge.profile.nom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold">{labelTypeConge(conge.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Période</span>
              <span className="font-semibold">
                {conge.demi_journee
                  ? <>{formatDateFr(conge.date_debut)} ({labelDemiJournee(conge.demi_journee)})</>
                  : <>{formatDateFr(conge.date_debut)} → {formatDateFr(conge.date_fin)}</>
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Durée</span>
              <span className="font-semibold">{formatNbJours(conge.nb_jours)} jour{conge.nb_jours > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Commentaire travailleur */}
          {conge.commentaire_travailleur && (
            <div className="bg-blue-50 rounded-lg p-3 text-[11px] text-blue-700">
              <strong>Note du travailleur :</strong> {conge.commentaire_travailleur}
            </div>
          )}

          {/* Pièce jointe */}
          {conge.piece_jointe_url && (
            <div>
              <button
                onClick={handleVoirCertificat}
                disabled={loadingCert}
                className="text-[11px] text-[#e53e3e] font-semibold hover:underline disabled:opacity-50"
              >
                {loadingCert ? 'Chargement...' : '📎 Voir le certificat'}
              </button>
            </div>
          )}

          {/* Commentaire admin */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Commentaire admin (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Motif de refus, remarque..."
              className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => handleDecision('approuve')}
              disabled={isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[11px] h-8"
            >
              ✅ Approuver
            </Button>
            <Button
              onClick={() => handleDecision('refuse')}
              disabled={isPending}
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-[11px] h-8"
            >
              ❌ Refuser
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-[11px] h-7 text-gray-400"
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
