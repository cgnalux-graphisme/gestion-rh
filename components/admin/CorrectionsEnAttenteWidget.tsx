'use client'

import { useState } from 'react'
import { CorrectionPointage } from '@/types/database'
import { traiterCorrectionAction } from '@/lib/pointage/correction-actions'
import { formatDateFr } from '@/lib/utils/dates'
import { useRouter } from 'next/navigation'

const CHAMP_LABEL: Record<string, string> = {
  arrivee: 'Arrivée',
  midi_out: 'Midi Out',
  midi_in: 'Midi In',
  depart: 'Départ',
}

interface Props {
  corrections: CorrectionPointage[]
}

export default function CorrectionsEnAttenteWidget({ corrections }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [refuseId, setRefuseId] = useState<string | null>(null)
  const [refuseComment, setRefuseComment] = useState('')
  const router = useRouter()

  if (corrections.length === 0) return null

  async function handleApprove(id: string) {
    setLoading(id)
    const result = await traiterCorrectionAction(id, 'approuve')
    if (result.error) {
      setErrors((prev) => ({ ...prev, [id]: result.error! }))
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  async function handleRefuse(id: string) {
    if (!refuseComment.trim()) return
    setLoading(id)
    const result = await traiterCorrectionAction(id, 'refuse', refuseComment)
    if (result.error) {
      setErrors((prev) => ({ ...prev, [id]: result.error! }))
    } else {
      setRefuseId(null)
      setRefuseComment('')
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
        <span className="text-[12px] font-bold text-amber-800">
          ✏️ Corrections de pointage en attente
        </span>
        <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
          {corrections.length}
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {corrections.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[#1a2332]">
                  {c.profile?.prenom} {c.profile?.nom}
                </div>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  {formatDateFr(c.date)} — <strong>{CHAMP_LABEL[c.champ]}</strong> → <strong>{c.heure_proposee}</strong>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 italic">
                  « {c.motif} »
                </div>
                {errors[c.id] && (
                  <div className="text-[10px] text-red-600 mt-1">{errors[c.id]}</div>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {refuseId === c.id ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={refuseComment}
                      onChange={(e) => setRefuseComment(e.target.value)}
                      placeholder="Motif du refus..."
                      className="text-[10px] border border-gray-200 rounded px-2 py-1 w-40"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRefuse(c.id)}
                        disabled={loading === c.id || !refuseComment.trim()}
                        className="text-[9px] font-semibold px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => { setRefuseId(null); setRefuseComment('') }}
                        className="text-[9px] px-2 py-1 text-gray-500 hover:text-gray-700"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(c.id)}
                      disabled={loading === c.id}
                      className="text-[10px] font-semibold px-2.5 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {loading === c.id ? '...' : '✓ Valider'}
                    </button>
                    <button
                      onClick={() => setRefuseId(c.id)}
                      disabled={loading === c.id}
                      className="text-[10px] font-semibold px-2.5 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      ✕ Refuser
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
