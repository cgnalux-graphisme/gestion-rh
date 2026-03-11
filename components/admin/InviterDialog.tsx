'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTravailleurAction } from '@/lib/auth/admin-actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Service } from '@/types/database'
import { useState, useEffect } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
    >
      {pending ? 'Envoi…' : "📧 Envoyer l'invitation"}
    </Button>
  )
}

export default function InviterDialog({ services }: { services: Service[] }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useFormState(createTravailleurAction, null)
  const [serviceId, setServiceId] = useState('')
  const [optionHoraire, setOptionHoraire] = useState('')

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      setServiceId('')
      setOptionHoraire('')
    }
  }, [state?.success])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs">
          + Inviter un travailleur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#1a2332]">
            Inviter un nouveau travailleur
          </DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Prénom *
              </Label>
              <Input name="prenom" required className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Nom *
              </Label>
              <Input name="nom" required className="text-xs h-8" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Email *
            </Label>
            <Input name="email" type="email" required className="text-xs h-8" />
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Service *
            </Label>
            <Select value={serviceId} onValueChange={setServiceId} required>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Choisir un service…" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="service_id" value={serviceId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Option horaire *
              </Label>
              <Select value={optionHoraire} onValueChange={setOptionHoraire} required>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Option…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A" className="text-xs">
                    A — 36,5h/sem
                  </SelectItem>
                  <SelectItem value="B" className="text-xs">
                    B — 34h/sem
                  </SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="option_horaire" value={optionHoraire} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Type de contrat
              </Label>
              <Input name="type_contrat" placeholder="CDI, CDD…" className="text-xs h-8" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Date d'entrée
            </Label>
            <Input name="date_entree" type="date" className="text-xs h-8" />
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
