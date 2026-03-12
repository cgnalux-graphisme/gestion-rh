'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateDayStatusAction, correctPointageAction } from '@/lib/pointage/admin-actions'

type Mode = 'choice' | 'absence' | 'conge' | 'correction'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  date: string
  workerName: string
}

export default function PointageManquantModal({
  open,
  onClose,
  userId,
  date,
  workerName,
}: Props) {
  const [mode, setMode] = useState<Mode>('choice')
  const [congeType, setCongeType] = useState<'C' | 'M' | 'R'>('C')
  const [arrivee, setArrivee] = useState('09:00')
  const [midiOut, setMidiOut] = useState('12:30')
  const [midiIn, setMidiIn] = useState('13:30')
  const [depart, setDepart] = useState('17:30')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setMode('choice')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleAbsent() {
    setError(null)
    startTransition(async () => {
      const res = await updateDayStatusAction(userId, date, 'A', 'Absent non justifié')
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  function handleConge() {
    setError(null)
    startTransition(async () => {
      const res = await updateDayStatusAction(userId, date, congeType)
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  function handleCorrection() {
    setError(null)
    startTransition(async () => {
      const res = await correctPointageAction(userId, date, arrivee, midiOut, midiIn, depart)
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Pointage manquant</DialogTitle>
          <p className="text-[10px] text-gray-500">{workerName} — {dateLabel}</p>
        </DialogHeader>

        {error && (
          <p className="text-[10px] text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        {mode === 'choice' && (
          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('absence')}
            >
              🚫 Absent non justifié
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('conge')}
            >
              🌴 Congé / Maladie / Autre
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('correction')}
            >
              ✏️ Correction manuelle
            </Button>
          </div>
        )}

        {mode === 'absence' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-600">Marquer comme absent non justifié (A) ?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>
                Retour
              </Button>
              <Button
                size="sm"
                className="bg-[#e53e3e] text-white text-xs hover:bg-[#c53030]"
                onClick={handleAbsent}
                disabled={isPending}
              >
                {isPending ? '…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'conge' && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-600">Type</p>
              <div className="flex gap-2">
                {(['C', 'M', 'R'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCongeType(t)}
                    className={[
                      'flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors',
                      congeType === t
                        ? 'bg-[#1a2332] text-white border-[#1a2332]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                    ].join(' ')}
                  >
                    {t === 'C' ? '🌴 Congé' : t === 'M' ? '🏥 Maladie' : '📌 Autre'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>
                Retour
              </Button>
              <Button
                size="sm"
                className="bg-[#1a2332] text-white text-xs"
                onClick={handleConge}
                disabled={isPending}
              >
                {isPending ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'correction' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Arrivée', value: arrivee, set: setArrivee },
                { label: 'Midi Out', value: midiOut, set: setMidiOut },
                { label: 'Midi In', value: midiIn, set: setMidiIn },
                { label: 'Départ', value: depart, set: setDepart },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-[10px] text-gray-500">{label}</label>
                  <input
                    type="time"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>
                Retour
              </Button>
              <Button
                size="sm"
                className="bg-[#1a2332] text-white text-xs"
                onClick={handleCorrection}
                disabled={isPending}
              >
                {isPending ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
