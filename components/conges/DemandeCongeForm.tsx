'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { demanderCongeAction } from '@/lib/conges/actions'
import { calcJoursOuvrables } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

const TYPE_OPTIONS = [
  { value: 'conge_annuel', label: 'Congé annuel' },
  { value: 'repos_comp', label: 'Repos compensatoire' },
  { value: 'recuperation', label: 'Récupération (heures sup.)' },
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
  const [demiJournee, setDemiJournee] = useState<'' | 'matin' | 'apres_midi'>('')

  const isRecup = type === 'recuperation'
  const isSingleDay = dateDebut && dateFin && dateDebut === dateFin

  const nbJoursComplets = isRecup
    ? (dateDebut ? 1 : 0)
    : (dateDebut && dateFin && dateFin >= dateDebut ? calcJoursOuvrables(dateDebut, dateFin) : 0)

  // Demi-journée uniquement si jour unique et pas récup
  const nbJours = (!isRecup && isSingleDay && demiJournee) ? 0.5 : nbJoursComplets

  // Réinitialiser + notifier parent si succès
  if (state?.success && onSuccess) {
    onSuccess()
  }

  return (
    <form
      action={formAction}
      className="space-y-4"
    >
      {/* Type */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type de congé *</label>
        <select
          name="type"
          value={type}
          onChange={(e) => { setType(e.target.value); setDateFin(''); setDemiJournee('') }}
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#1a2332] focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
          required
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Dates */}
      {isRecup ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date *</label>
            <input
              type="date"
              name="date_debut"
              value={dateDebut}
              onChange={(e) => { setDateDebut(e.target.value); setDateFin(e.target.value) }}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
            {/* date_fin = date_debut pour récup */}
            <input type="hidden" name="date_fin" value={dateDebut} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Durée à récupérer *</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  name="recup_heures"
                  min="0"
                  max="8"
                  defaultValue="0"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">h</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  name="recup_minutes"
                  min="0"
                  max="59"
                  step="15"
                  defaultValue="0"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">min</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date de début *</label>
            <input
              type="date"
              name="date_debut"
              value={dateDebut}
              onChange={(e) => { setDateDebut(e.target.value); setDemiJournee('') }}
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
              onChange={(e) => { setDateFin(e.target.value); setDemiJournee('') }}
              min={dateDebut}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
          </div>
        </div>
      )}

      {/* Demi-journée (uniquement si jour unique et pas récup) */}
      {!isRecup && isSingleDay && nbJoursComplets === 1 && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Durée</label>
          <div className="flex gap-2">
            {[
              { value: '', label: 'Journée complète' },
              { value: 'matin', label: 'Matin (½ journée)' },
              { value: 'apres_midi', label: 'Après-midi (½ journée)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDemiJournee(opt.value as '' | 'matin' | 'apres_midi')}
                className={`flex-1 text-[11px] py-1.5 px-2 rounded-lg border transition-colors ${
                  demiJournee === opt.value
                    ? 'bg-[#e53e3e] text-white border-[#e53e3e]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="demi_journee" value={demiJournee} />
        </div>
      )}

      {/* Nb jours calculé */}
      {nbJours > 0 && !isRecup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] text-blue-700 font-semibold">
          {nbJours === 0.5
            ? `📅 ½ journée (${demiJournee === 'matin' ? 'matin' : 'après-midi'})`
            : `📅 ${nbJours} jour${nbJours > 1 ? 's' : ''} ouvrable${nbJours > 1 ? 's' : ''}`}
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
