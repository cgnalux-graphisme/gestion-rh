'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateOptionHoraireAction } from '@/lib/auth/admin-actions'
import { Profile } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApresDeadlineChangementOption } from '@/lib/horaires/utils'
import { useState } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
    >
      {pending ? 'Enregistrement…' : "💾 Enregistrer l'option"}
    </Button>
  )
}

export default function OptionHoraireAdminSection({ profile }: { profile: Profile }) {
  const [state, action] = useFormState(updateOptionHoraireAction, null)
  const [option, setOption] = useState(profile.option_horaire ?? '')
  const apresDeadline = isApresDeadlineChangementOption()
  const anneeProchaine = new Date().getFullYear() + 1

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🕐 Option horaire</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          ★ Admin
        </span>
      </div>

      <div className="p-4 space-y-3">
        {apresDeadline && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-[10px] text-orange-700 font-semibold">
              ⚠️ Après le 15 décembre, le changement sera appliqué à partir du 1er janvier{' '}
              {anneeProchaine}. L&apos;option actuelle reste en vigueur jusqu&apos;à cette date.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Option actuelle
            </div>
            <div className="text-xs font-semibold text-[#1a2332]">
              {profile.option_horaire
                ? `Option ${profile.option_horaire} (${
                    profile.option_horaire === 'A' ? '36,5h/sem' : '34h/sem'
                  })`
                : '—'}
            </div>
          </div>
          {profile.option_horaire_prochaine && (
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Planifié {anneeProchaine}
              </div>
              <div className="text-xs font-semibold text-orange-600">
                Option {profile.option_horaire_prochaine}
              </div>
            </div>
          )}
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="user_id" value={profile.id} />

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              {apresDeadline
                ? `Nouvelle option (à partir du 1er jan. ${anneeProchaine})`
                : "Modifier l'option"}
            </Label>
            <Select value={option} onValueChange={(v) => setOption(v ?? '')}>
              <SelectTrigger className="text-xs h-8 max-w-xs">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A" className="text-xs">
                  A — 36,5h/sem (7h18/jour)
                </SelectItem>
                <SelectItem value="B" className="text-xs">
                  B — 34h/sem (6h48/jour)
                </SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="option_horaire" value={option} />
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
          )}
          {state?.warning && (
            <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md">
              ⚠️ {state.warning}
            </p>
          )}
          {state?.success && !state.warning && (
            <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
              ✓ Option horaire mise à jour.
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
