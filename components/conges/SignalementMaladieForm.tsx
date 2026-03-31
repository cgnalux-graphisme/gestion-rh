'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { signalerMaladieAction } from '@/lib/conges/actions'
import { calcJoursOuvrables } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

interface Props {
  onSuccess?: () => void
}

export default function SignalementMaladieForm({ onSuccess }: Props) {
  const [state, formAction] = useFormState(signalerMaladieAction, null)
  const [isPending, startTransition] = useTransition()
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const nbJours = dateDebut && dateFin && dateFin >= dateDebut
    ? calcJoursOuvrables(dateDebut, dateFin)
    : 0

  if (state?.success && onSuccess) {
    onSuccess()
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date de début *</label>
          <input
            type="date"
            name="date_debut"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date de fin *</label>
          <input
            type="date"
            name="date_fin"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            min={dateDebut}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            required
          />
        </div>
      </div>

      {/* Nb jours calculé */}
      {nbJours > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] text-blue-700 font-semibold">
          📅 {nbJours} jour{nbJours > 1 ? 's' : ''} ouvrable{nbJours > 1 ? 's' : ''}
        </div>
      )}

      {/* Certificat médical */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
          Certificat médical (optionnel)
        </label>
        <input
          type="file"
          name="piece_jointe"
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-full text-[11px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
        />
        <p className="text-[10px] text-gray-400 mt-1">PDF, JPG ou PNG — max 5 MB. Vous pouvez le joindre plus tard.</p>
      </div>

      {/* Commentaire */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Commentaire (optionnel)</label>
        <textarea
          name="commentaire_travailleur"
          rows={2}
          placeholder="Informations complémentaires..."
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
        />
      </div>

      {/* Erreur / succès */}
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[11px] text-green-700">
          ✅ Signalement envoyé avec succès.
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || nbJours === 0}
        className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white text-[12px] h-9"
      >
        {isPending ? 'Envoi en cours...' : 'Signaler l\'absence maladie'}
      </Button>
    </form>
  )
}
