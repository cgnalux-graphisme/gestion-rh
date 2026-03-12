'use client'

import { useFormState } from 'react-dom'
import { SoldeConges } from '@/types/database'
import { updateSoldesCongesAction } from '@/lib/conges/admin-actions'
import { Button } from '@/components/ui/button'

interface Props {
  userId: string
  soldes: SoldeConges | null
  annee: number
}

export default function SoldesCongesAdminSection({ userId, soldes, annee }: Props) {
  const [state, formAction] = useFormState(updateSoldesCongesAction, null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        🌴 Soldes congés {annee}
      </h3>

      {soldes && (
        <div className="grid grid-cols-2 gap-3 mb-3 text-[11px] text-gray-500">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="font-semibold text-[#1a2332]">Congés annuels</div>
            <div>{soldes.conges_annuels_pris}/{soldes.conges_annuels_total} jours pris</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="font-semibold text-[#1a2332]">Repos compensatoires</div>
            <div>{soldes.repos_comp_pris}/{soldes.repos_comp_total} jours pris</div>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="annee" value={annee} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Total congés annuels
            </label>
            <input
              type="number"
              name="conges_annuels_total"
              min={0}
              max={365}
              defaultValue={soldes?.conges_annuels_total ?? 0}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Total repos comp.
            </label>
            <input
              type="number"
              name="repos_comp_total"
              min={0}
              max={365}
              defaultValue={soldes?.repos_comp_total ?? 0}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
          </div>
        </div>

        {state?.error && (
          <div className="text-[11px] text-red-500">{state.error}</div>
        )}
        {state?.success && (
          <div className="text-[11px] text-green-600">✅ Soldes mis à jour</div>
        )}

        <Button type="submit" size="sm" className="text-[11px] h-8 bg-[#1a2332] hover:bg-[#2d3f55] text-white">
          Sauvegarder les soldes
        </Button>
      </form>
    </div>
  )
}
