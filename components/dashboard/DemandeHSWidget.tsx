'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { demanderHeuresSupAction } from '@/lib/heures-sup/actions'
import { formatLocalDate } from '@/lib/utils/dates'

export default function DemandeHSWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, action] = useFormState(demanderHeuresSupAction, null)
  const [isPending, startTransition] = useTransition()

  const today = formatLocalDate(new Date())

  if (state?.success && isOpen) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          ⏱ Heures supplémentaires
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm font-semibold text-green-700">Demande envoyée avec succès</p>
          <p className="text-xs text-green-600 mt-1">L&apos;admin RH la traitera prochainement.</p>
          <button
            onClick={() => {
              setIsOpen(false)
            }}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          ⏱ Heures supplémentaires
        </p>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold text-[#e53e3e] hover:text-[#c53030] transition-colors"
        >
          {isOpen ? 'Annuler' : '+ Nouvelle demande'}
        </button>
      </div>

      {!isOpen && (
        <p className="text-xs text-gray-400 italic">
          Signalez ici vos heures supplémentaires effectuées.
        </p>
      )}

      {isOpen && (
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                required
                className="w-full h-10 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Durée</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      name="heures"
                      min="0"
                      max="12"
                      defaultValue="0"
                      className="w-full h-10 text-sm border border-gray-200 rounded-lg px-3 pr-7 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">h</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      name="minutes"
                      min="0"
                      max="59"
                      step="15"
                      defaultValue="0"
                      className="w-full h-10 text-sm border border-gray-200 rounded-lg px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Motif <span className="text-red-400">*</span>
            </label>
            <textarea
              name="commentaire"
              required
              rows={2}
              placeholder="Ex: Réunion exceptionnelle avec le client, permanence téléphonique..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e] resize-none"
            />
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-10 bg-[#e53e3e] hover:bg-[#c53030] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? 'Envoi en cours...' : 'Envoyer la demande'}
          </button>
        </form>
      )}
    </div>
  )
}
