'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { demanderHeuresSupAction } from '@/lib/heures-sup/actions'
import { formatLocalDate, formatDateFr } from '@/lib/utils/dates'
import { formatMinutes } from '@/lib/horaires/utils'
import { DemandeHeuresSup, Profile } from '@/types/database'
import Link from 'next/link'

type DemandeHSWithProfile = DemandeHeuresSup & {
  profile: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

interface Props {
  isAdmin: boolean
  demandesAdmin: DemandeHSWithProfile[]
}

export default function HeuresSupWidget({ isAdmin, demandesAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, action] = useFormState(demanderHeuresSupAction, null)
  const [isPending, startTransition] = useTransition()

  const today = formatLocalDate(new Date())

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Heures supplémentaires
          {isAdmin && demandesAdmin.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {demandesAdmin.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={isOpen
            ? "text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            : "inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#e53e3e] hover:bg-[#c53030] px-3 py-1.5 rounded-lg transition-colors"
          }
        >
          {isOpen ? 'Annuler' : '+ Nouvelle demande'}
        </button>
      </div>

      {/* Success message */}
      {state?.success && isOpen && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs font-semibold text-green-700">Demande envoyée avec succes</p>
          <p className="text-[10px] text-green-600 mt-0.5">L&apos;admin RH la traitera prochainement.</p>
          <button
            onClick={() => setIsOpen(false)}
            className="mt-2 text-[10px] text-gray-500 hover:text-gray-700 underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Worker form */}
      {isOpen && !state?.success && (
        <form action={action} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={today}
                max={today}
                required
                className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Durée</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    name="heures"
                    min="0"
                    max="12"
                    defaultValue="0"
                    className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 pr-6 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">h</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    name="minutes"
                    min="0"
                    max="59"
                    step="15"
                    defaultValue="0"
                    className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e]"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">min</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">
              Motif <span className="text-red-400">*</span>
            </label>
            <textarea
              name="commentaire"
              required
              rows={2}
              placeholder="Ex: Réunion exceptionnelle, permanence téléphonique..."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30 focus:border-[#e53e3e] resize-none"
            />
          </div>

          {state?.error && (
            <p className="text-[10px] text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-9 bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>
      )}

      {/* Placeholder when form closed and no admin data */}
      {!isOpen && !isAdmin && (
        <p className="text-xs text-gray-400 italic">
          Signalez ici vos heures supplémentaires effectuées.
        </p>
      )}

      {/* Admin pending list */}
      {isAdmin && demandesAdmin.length > 0 && !isOpen && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">
              En attente de validation
            </p>
            <Link
              href="/admin/heures-sup"
              className="text-[10px] text-[#e53e3e] font-semibold hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-2">
            {demandesAdmin.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#1a2332] truncate">
                    {d.profile.prenom} {d.profile.nom}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {formatDateFr(d.date)} — {formatMinutes(d.nb_minutes)}
                  </div>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                  En attente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && demandesAdmin.length === 0 && !isOpen && (
        <p className="text-xs text-gray-400 italic">
          Aucune demande d&apos;heures sup en attente.
        </p>
      )}
    </div>
  )
}
