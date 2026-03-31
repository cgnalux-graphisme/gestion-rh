'use client'

import { useFormState } from 'react-dom'
import { updateParametresOptionAction } from '@/lib/admin/parametres-actions'
import { ParametresOption } from '@/types/database'
import { useState, useEffect, useRef } from 'react'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export default function ParametresHorairesForm({
  options,
}: {
  options: ParametresOption[]
}) {
  const [selectedOption, setSelectedOption] = useState<'A' | 'B'>('A')
  const [state, formAction] = useFormState(updateParametresOptionAction, {})
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

  const param = options.find((o) => o.option_horaire === selectedOption)

  return (
    <div className="space-y-6">
      {/* Tabs Option A / B */}
      <div className="flex gap-2">
        {(['A', 'B'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setSelectedOption(opt)}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              selectedOption === opt
                ? 'bg-[#1a2332] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Option {opt} — {opt === 'A' ? '36,5h/sem' : '34h/sem'}
          </button>
        ))}
      </div>

      {param && (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="id" value={param.id} />

          {showSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
              ✓ Paramètres mis à jour
            </div>
          )}
          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
              {state.error}
            </div>
          )}

          {/* Paramètres généraux */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-bold text-[#1a2332] mb-3">⚙️ Paramètres généraux</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Heures / semaine
                </label>
                <input
                  type="number"
                  name="heures_semaine"
                  defaultValue={param.heures_semaine}
                  step={0.5}
                  min={0}
                  max={50}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Pot d&apos;heures initial annuel (min)
                </label>
                <input
                  type="number"
                  name="pot_heures_initial"
                  defaultValue={param.pot_heures_initial}
                  min={0}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Congés annuels (VA) par défaut
                </label>
                <input
                  type="number"
                  name="conges_annuels_defaut"
                  defaultValue={param.conges_annuels_defaut}
                  min={0}
                  max={50}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Repos compensatoires (RC) par défaut
                </label>
                <input
                  type="number"
                  name="repos_comp_defaut"
                  defaultValue={param.repos_comp_defaut}
                  min={0}
                  max={50}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Horaires de travail normaux */}
          <div>
            <h3 className="text-sm font-bold text-[#1a2332] mb-3">📅 Horaires de travail (sept. – juin)</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div>Jour</div>
                <div>Début</div>
                <div>Fin</div>
                <div>Pause midi (min)</div>
              </div>
              {[1, 2, 3, 4, 5].map((j) => {
                const h = param.horaires?.[String(j) as keyof typeof param.horaires]
                return (
                  <div key={j} className="grid grid-cols-4 gap-2 items-center">
                    <div className="text-xs font-medium text-gray-600">{JOURS[j - 1]}</div>
                    <input
                      type="time"
                      name={`horaire_${j}_debut`}
                      defaultValue={h?.debut ?? '08:00'}
                      className="border rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      type="time"
                      name={`horaire_${j}_fin`}
                      defaultValue={h?.fin ?? '16:30'}
                      className="border rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      name={`horaire_${j}_pause`}
                      defaultValue={h?.pause_midi ?? 60}
                      min={0}
                      max={120}
                      className="border rounded px-2 py-1.5 text-xs w-20"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Horaires été */}
          <div>
            <h3 className="text-sm font-bold text-[#1a2332] mb-3">☀️ Horaires de travail été (juillet – août)</h3>
            <div className="bg-yellow-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-gray-400 uppercase">
                <div>Jour</div>
                <div>Début</div>
                <div>Fin</div>
                <div>Pause midi (min)</div>
              </div>
              {[1, 2, 3, 4, 5].map((j) => {
                const h = param.horaires_ete?.[String(j) as keyof typeof param.horaires_ete]
                return (
                  <div key={j} className="grid grid-cols-4 gap-2 items-center">
                    <div className="text-xs font-medium text-gray-600">{JOURS[j - 1]}</div>
                    <input
                      type="time"
                      name={`horaire_ete_${j}_debut`}
                      defaultValue={h?.debut ?? '08:00'}
                      className="border rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      type="time"
                      name={`horaire_ete_${j}_fin`}
                      defaultValue={h?.fin ?? '14:00'}
                      className="border rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      name={`horaire_ete_${j}_pause`}
                      defaultValue={h?.pause_midi ?? 0}
                      min={0}
                      max={120}
                      className="border rounded px-2 py-1.5 text-xs w-20"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            className="bg-[#1a2332] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#243044] transition-colors"
          >
            Enregistrer Option {selectedOption}
          </button>
        </form>
      )}
    </div>
  )
}
