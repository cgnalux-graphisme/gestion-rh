'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { correcterPotHeuresAction } from '@/lib/auth/admin-actions'
import { PotHeures } from '@/types/database'
import { formatMinutes } from '@/lib/horaires/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      variant="outline"
      className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
    >
      {pending ? 'Correction…' : '✏️ Appliquer la correction'}
    </Button>
  )
}

export default function PotHeuresAdminSection({
  userId,
  potHeures,
}: {
  userId: string
  potHeures: PotHeures | null
}) {
  const [state, action] = useFormState(correcterPotHeuresAction, null)
  const annee = new Date().getFullYear()
  const solde = potHeures?.solde_minutes ?? 0
  const isPositif = solde >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">⏱ Pot d&apos;heures {annee}</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          ★ Admin
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Solde actuel */}
        <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Solde actuel
            </div>
            <div
              className={`text-xl font-black ${
                solde === 0 ? 'text-gray-400' : isPositif ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositif && solde !== 0 ? '+' : ''}
              {formatMinutes(solde)}
            </div>
          </div>
          <div className="text-[9px] text-gray-400">
            {potHeures
              ? `Mis à jour le ${new Date(potHeures.updated_at).toLocaleDateString('fr-BE')}`
              : 'Aucun pointage complet cette année'}
          </div>
        </div>

        {/* Formulaire correction */}
        <form action={action} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="annee" value={annee} />

          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            Correction manuelle
          </div>

          <div className="space-y-1 max-w-xs">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Delta (minutes)
            </Label>
            <Input
              name="delta_minutes"
              type="number"
              placeholder="ex: 30 ou -60"
              className="text-xs h-8"
              required
            />
            <p className="text-[9px] text-gray-400">
              Positif = ajouter, négatif = soustraire
            </p>
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
          )}
          {state?.success && (
            <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
              ✓ Correction appliquée avec succès.
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
