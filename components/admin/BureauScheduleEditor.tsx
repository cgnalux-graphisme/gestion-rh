'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { setBureauScheduleAction } from '@/lib/auth/admin-actions'
import { Bureau, UserBureauSchedule } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'

const JOURS = [
  { jour: 1 as const, label: 'Lundi' },
  { jour: 2 as const, label: 'Mardi' },
  { jour: 3 as const, label: 'Mercredi' },
  { jour: 4 as const, label: 'Jeudi' },
  { jour: 5 as const, label: 'Vendredi' },
]

const NONE = '__none__'

function SaveBtn() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
    >
      {pending ? 'Enregistrement…' : '💾 Enregistrer'}
    </Button>
  )
}

export default function BureauScheduleEditor({
  userId,
  bureaux,
  schedules,
}: {
  userId: string
  bureaux: Bureau[]
  schedules: UserBureauSchedule[]
}) {
  const [state, action] = useFormState(setBureauScheduleAction, null)

  const initial: Record<number, string> = {}
  for (const j of [1, 2, 3, 4, 5]) {
    initial[j] = schedules.find((s) => s.jour === j)?.bureau_id ?? ''
  }
  const [selections, setSelections] = useState(initial)

  function handleChange(jour: number, val: string) {
    setSelections((prev) => ({ ...prev, [jour]: val === NONE ? '' : val }))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">📍 Affectation par bureau</span>
      </div>
      <form action={action} className="p-4 space-y-2.5">
        <input type="hidden" name="user_id" value={userId} />

        {JOURS.map(({ jour, label }) => (
          <div key={jour} className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider w-16 flex-shrink-0">
              {label}
            </span>
            <div className="flex-1">
              <Select
                value={selections[jour] || NONE}
                onValueChange={(v) => handleChange(jour, v ?? '')}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-xs text-gray-400 italic">
                    Sur la route
                  </SelectItem>
                  {bureaux.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name={`jour_${jour}`} value={selections[jour]} />
            </div>
          </div>
        ))}

        {state?.error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
            ✓ Affectation mise à jour.
          </p>
        )}

        <div className="flex justify-end pt-1">
          <SaveBtn />
        </div>
      </form>
    </div>
  )
}
