'use client'

import { useState, useTransition } from 'react'
import { pointerAction, PointageType } from '@/lib/pointage/actions'
import { Pointage } from '@/types/database'
import { formatTimeBrussels } from '@/lib/utils/dates'

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return formatTimeBrussels(iso)
}

const STEPS: { type: PointageType; label: string }[] = [
  { type: 'arrivee', label: 'Arrivée' },
  { type: 'midi_out', label: 'Midi Out' },
  { type: 'midi_in', label: 'Midi In' },
  { type: 'depart', label: 'Départ' },
]

export default function PointageWidget({ pointage }: { pointage: Pointage | null }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const fields: (keyof Pointage)[] = ['arrivee', 'midi_out', 'midi_in', 'depart']
  const nextIndex = fields.findIndex((f) => !pointage?.[f])

  function handleClick(type: PointageType) {
    setError(null)
    startTransition(async () => {
      const result = await pointerAction(type)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        🕐 Pointage du jour
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map(({ type, label }, idx) => {
          const value = pointage?.[type as keyof Pointage] as string | null | undefined
          const isDone = Boolean(value)
          const isActive = !isDone && idx === nextIndex

          return (
            <button
              key={type}
              onClick={() => isActive && handleClick(type)}
              disabled={!isActive || isPending}
              className={[
                'flex flex-col items-center justify-center rounded-lg py-3 px-2 text-sm font-bold transition-all',
                isDone
                  ? 'bg-[#10b981] text-white cursor-default'
                  : isActive
                  ? 'bg-[#e53e3e] text-white hover:bg-[#c53030] cursor-pointer shadow-md'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed',
              ].join(' ')}
            >
              <span className="text-xs font-normal opacity-80">{label}</span>
              {isDone && (
                <span className="mt-0.5 text-sm font-black">{formatTime(value!)}</span>
              )}
              {!isDone && isActive && (
                <span className="mt-0.5 text-xs opacity-70">
                  {isPending ? '…' : 'Cliquer'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}
      {nextIndex === -1 && (
        <p className="mt-2 text-xs text-green-600 text-center">✓ Journée complète</p>
      )}
    </div>
  )
}
