'use client'

import { useState, useTransition } from 'react'
import { demanderAnnulationCongeAction } from '@/lib/conges/actions'
import { Button } from '@/components/ui/button'

interface Props {
  congeId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DemandeAnnulationModal({ congeId, open, onClose, onSuccess }: Props) {
  const [motif, setMotif] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await demanderAnnulationCongeAction(congeId, motif)
      if (result.error) {
        setError(result.error)
      } else {
        setMotif('')
        onSuccess()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-gray-200 p-5 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-sm font-bold text-[#1a2332] mb-3">Demander l&apos;annulation</h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Votre demande sera soumise au RH pour validation. Le congé reste actif jusqu&apos;à approbation.
        </p>
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Motif *</label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder="Expliquez pourquoi vous souhaitez annuler ce congé..."
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600 mb-3">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 text-[12px] h-9"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !motif.trim()}
            className="flex-1 bg-[#e53e3e] hover:bg-[#c53030] text-white text-[12px] h-9"
          >
            {isPending ? 'Envoi...' : 'Envoyer la demande'}
          </Button>
        </div>
      </div>
    </div>
  )
}
