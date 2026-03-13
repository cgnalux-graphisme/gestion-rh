'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { demanderCongeAction } from '@/lib/conges/actions'
import { calcJoursOuvrables } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

const TYPE_OPTIONS = [
  { value: 'conge_annuel', label: 'Congé annuel' },
  { value: 'repos_comp', label: 'Repos compensatoire' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'autre', label: 'Autre' },
]

interface Props {
  onSuccess?: () => void
}

export default function DemandeCongeForm({ onSuccess }: Props) {
  const [state, formAction] = useFormState(demanderCongeAction, null)
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState('conge_annuel')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const nbJours = dateDebut && dateFin && dateFin >= dateDebut
    ? calcJoursOuvrables(dateDebut, dateFin)
    : 0

  // Réinitialiser + notifier parent si succès
  if (state?.success && onSuccess) {
    onSuccess()
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      {/* Type */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type de congé *</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#1a2332] focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
          required
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

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

      {/* Pièce jointe — obligatoire si maladie */}
      {type === 'maladie' && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Certificat médical <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            name="piece_jointe"
            accept=".pdf,.jpg,.jpeg,.png"
            required
            className="w-full text-[11px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
          />
          <p className="text-[10px] text-gray-400 mt-1">PDF, JPG ou PNG — max 5 MB</p>
        </div>
      )}

      {type !== 'maladie' && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Pièce jointe (optionnel)
          </label>
          <input
            type="file"
            name="piece_jointe"
            accept=".pdf,.jpg,.jpeg,.png"
            className="w-full text-[11px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
          />
        </div>
      )}

      {/* Commentaire */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Commentaire (optionnel)</label>
        <textarea
          name="commentaire_travailleur"
          rows={3}
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
      {state?.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700">
          ⚠️ {state.warning}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[11px] text-green-700">
          ✅ Demande envoyée avec succès.
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || nbJours === 0}
        className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white text-[12px] h-9"
      >
        {isPending ? 'Envoi en cours...' : 'Envoyer la demande'}
      </Button>
    </form>
  )
}
