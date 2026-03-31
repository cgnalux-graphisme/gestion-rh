'use client'

import { useFormState } from 'react-dom'
import { updateBureauHorairesAction } from '@/lib/admin/bureaux-actions'
import { Bureau } from '@/types/database'
import { useState, useEffect, useRef } from 'react'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export default function BureauHorairesForm({ bureaux }: { bureaux: Bureau[] }) {
  const [selectedId, setSelectedId] = useState(bureaux[0]?.id ?? '')
  const [state, formAction] = useFormState(updateBureauHorairesAction, {})
  const [showSuccess, setShowSuccess] = useState(false)
  const prevSuccess = useRef(state.success)

  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
    prevSuccess.current = state.success
  }, [state.success])

  const bureau = bureaux.find((b) => b.id === selectedId)

  return (
    <div className="space-y-6">
      {/* Sélection du bureau */}
      <div className="flex gap-2">
        {bureaux.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedId(b.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              selectedId === b.id
                ? 'bg-[#1a2332] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {b.nom}
          </button>
        ))}
      </div>

      {bureau && (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="bureau_id" value={bureau.id} />

          {showSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
              ✓ Horaires mis à jour
            </div>
          )}
          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
              {state.error}
            </div>
          )}

          {/* Horaires normaux */}
          <div>
            <h3 className="text-sm font-bold text-[#1a2332] mb-3">📅 Horaires normaux (sept. – juin)</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div></div>
                <div className="text-center">Matin</div>
                <div className="text-center">Après-midi</div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div>Jour</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Début</div>
                  <div>Fin</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Début</div>
                  <div>Fin</div>
                </div>
              </div>
              {[1, 2, 3, 4, 5].map((j) => {
                const h = bureau.horaires_normaux?.[String(j) as keyof typeof bureau.horaires_normaux]
                return (
                  <div key={j} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                    <div className="text-xs font-medium text-gray-600">{JOURS[j - 1]}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        name={`normal_${j}_matin_debut`}
                        defaultValue={h?.matin_debut ?? '08:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        type="time"
                        name={`normal_${j}_matin_fin`}
                        defaultValue={h?.matin_fin ?? '12:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        name={`normal_${j}_aprem_debut`}
                        defaultValue={h?.aprem_debut ?? '13:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        type="time"
                        name={`normal_${j}_aprem_fin`}
                        defaultValue={h?.aprem_fin ?? '17:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Horaires été */}
          <div>
            <h3 className="text-sm font-bold text-[#1a2332] mb-3">☀️ Horaires été (juillet – août)</h3>
            <div className="bg-yellow-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div></div>
                <div className="text-center">Matin</div>
                <div className="text-center">Après-midi</div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div>Jour</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Début</div>
                  <div>Fin</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Début</div>
                  <div>Fin</div>
                </div>
              </div>
              {[1, 2, 3, 4, 5].map((j) => {
                const h = bureau.horaires_ete?.[String(j) as keyof typeof bureau.horaires_ete]
                return (
                  <div key={j} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                    <div className="text-xs font-medium text-gray-600">{JOURS[j - 1]}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        name={`ete_${j}_matin_debut`}
                        defaultValue={h?.matin_debut ?? '08:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        type="time"
                        name={`ete_${j}_matin_fin`}
                        defaultValue={h?.matin_fin ?? '12:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        name={`ete_${j}_aprem_debut`}
                        defaultValue={h?.aprem_debut ?? '13:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        type="time"
                        name={`ete_${j}_aprem_fin`}
                        defaultValue={h?.aprem_fin ?? '16:00'}
                        className="border rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            className="bg-[#1a2332] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#243044] transition-colors"
          >
            Enregistrer les horaires de {bureau.nom}
          </button>
        </form>
      )}
    </div>
  )
}
