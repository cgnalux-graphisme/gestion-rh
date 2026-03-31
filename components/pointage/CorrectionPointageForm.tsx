'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useFormState } from 'react-dom'
import { demanderCorrectionPointageAction } from '@/lib/pointage/correction-actions'
import { Button } from '@/components/ui/button'
import { CorrectionPointage } from '@/types/database'
import { formatDateFr, formatLocalDate } from '@/lib/utils/dates'

const CHAMP_OPTIONS = [
  { value: 'arrivee', label: 'Arrivée' },
  { value: 'midi_out', label: 'Midi Out' },
  { value: 'midi_in', label: 'Midi In' },
  { value: 'depart', label: 'Départ' },
]

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
}

interface Props {
  corrections: CorrectionPointage[]
  onSuccess?: () => void
}

export default function CorrectionPointageForm({ corrections, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction] = useFormState(demanderCorrectionPointageAction, null)
  const [isPending, startTransition] = useTransition()
  const [showSuccess, setShowSuccess] = useState(false)
  const prevSuccess = useRef(state?.success)

  useEffect(() => {
    if (state?.success && !prevSuccess.current) {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        setShowSuccess(false)
        setIsOpen(false)
        onSuccess?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
    prevSuccess.current = state?.success
  }, [state?.success, onSuccess])

  const today = formatLocalDate(new Date())

  return (
    <div className="space-y-4">
      {/* Bouton toggle */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-[12px] font-bold text-[#1a2332] flex items-center gap-2">
            ✏️ Signaler une erreur de pointage
          </span>
          <span className="text-[11px] text-gray-400">
            {isOpen ? '✕' : '+'}
          </span>
        </button>

        {isOpen && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-4">
            <form action={formAction} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    name="date"
                    max={today}
                    required
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type de pointage *</label>
                  <select
                    name="champ"
                    required
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                  >
                    {CHAMP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Heure réelle *</label>
                  <input
                    type="time"
                    name="heure_proposee"
                    required
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Motif / Explication *
                </label>
                <textarea
                  name="motif"
                  required
                  rows={2}
                  placeholder="Ex: J'ai oublié de pointer à mon arrivée à 8h00, je m'en suis rappelé à 11h..."
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
                />
              </div>

              {state?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600">
                  {state.error}
                </div>
              )}
              {showSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[11px] text-green-700">
                  ✅ Demande de correction envoyée.
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white text-[12px] h-9"
              >
                {isPending ? 'Envoi...' : 'Envoyer la demande de correction'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Liste des demandes de correction récentes */}
      {corrections.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Mes demandes de correction
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {corrections.map((c) => (
              <div key={c.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-[#1a2332]">
                      {formatDateFr(c.date)} — {CHAMP_OPTIONS.find(o => o.value === c.champ)?.label}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                      {STATUT_LABEL[c.statut]}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Heure proposée : <strong>{c.heure_proposee}</strong> — {c.motif}
                  </div>
                  {c.statut === 'approuve' && c.heure_corrigee && (
                    <div className="text-[10px] text-green-600 mt-1">
                      ✓ Corrigé à <strong>{c.heure_corrigee}</strong>
                    </div>
                  )}
                  {c.statut === 'refuse' && c.minutes_deduites != null && c.minutes_deduites > 0 && (
                    <div className="text-[10px] text-red-600 mt-1">
                      ✗ Refusé — <strong>{c.minutes_deduites} min</strong> déduites du pot d&apos;heures
                    </div>
                  )}
                  {c.commentaire_admin && (
                    <div className="text-[10px] text-gray-400 mt-1 italic">
                      Note admin : {c.commentaire_admin}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
