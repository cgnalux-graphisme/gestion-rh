'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateTravailleurAction } from '@/lib/auth/admin-actions'
import { Profile, Service } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState, useEffect, useRef } from 'react'

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
  placeholder,
  className = '',
}: {
  name: string
  label: string
  defaultValue?: string | null
  type?: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</Label>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="text-xs h-8"
      />
    </div>
  )
}

function SaveBar() {
  const { pending } = useFormStatus()
  return (
    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-4 py-3 flex justify-end gap-2">
      <Button type="reset" variant="outline" size="sm" className="text-xs">
        Annuler
      </Button>
      <Button
        type="submit"
        disabled={pending}
        size="sm"
        className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
      >
        {pending ? 'Enregistrement…' : '💾 Enregistrer'}
      </Button>
    </div>
  )
}

export default function TravailleurEditForm({
  profile,
  services,
}: {
  profile: Profile
  services: Service[]
}) {
  const [state, action] = useFormState(updateTravailleurAction, null)
  const [serviceId, setServiceId] = useState(profile.service_id ?? '')
  const [showSuccess, setShowSuccess] = useState(false)
  const prevSuccess = useRef(state?.success)

  useEffect(() => {
    if (state?.success && !prevSuccess.current) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
    prevSuccess.current = state?.success
  }, [state?.success])
  const serviceMap = new Map(services.map((s) => [s.id, s.nom]))

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">✏️ Données du travailleur</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          ★ Admin
        </span>
      </div>

      <div className="p-4 space-y-3">
        <input type="hidden" name="user_id" value={profile.id} />

        <div className="grid grid-cols-2 gap-3">
          <Field name="prenom" label="Prénom" defaultValue={profile.prenom} />
          <Field name="nom" label="Nom" defaultValue={profile.nom} />
        </div>

        <Field name="email" label="Email" type="email" defaultValue={profile.email} />
        <Field
          name="telephone"
          label="Téléphone"
          defaultValue={profile.telephone}
          placeholder="+32 498 00 00 00"
        />
        <Field
          name="contact_urgence"
          label="Contact d'urgence"
          defaultValue={profile.contact_urgence}
          placeholder="Prénom — 0477 00 00 00"
        />

        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-1">
          Données RH
        </div>

        <div className="space-y-1">
          <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            Service
          </Label>
          <Select value={serviceId} onValueChange={(v) => setServiceId(v ?? '')}>
            <SelectTrigger className="text-xs h-8">
              <span className="flex flex-1 text-left truncate">
                {serviceId ? serviceMap.get(serviceId) ?? serviceId : <span className="text-gray-400">Service…</span>}
              </span>
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
          <Field name="type_contrat" label="Type de contrat" defaultValue={profile.type_contrat} placeholder="CDI, CDD…" />
          <Field name="date_entree" label="Date d'entrée" type="date" defaultValue={profile.date_entree} />
        </div>

        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-1">
          Adresse de domicile
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field name="rue" label="Rue / Avenue" defaultValue={profile.rue} className="col-span-2" />
          <Field name="numero" label="N°" defaultValue={profile.numero} />
          <Field name="boite" label="Boîte" defaultValue={profile.boite} placeholder="Optionnel" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field name="code_postal" label="Code postal" defaultValue={profile.code_postal} />
          <Field name="commune" label="Commune" defaultValue={profile.commune} className="col-span-2" />
        </div>
        <Field name="pays" label="Pays" defaultValue={profile.pays ?? 'Belgique'} />

        {state?.error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
        )}
        {showSuccess && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
            ✓ Données enregistrées avec succès.
          </p>
        )}
      </div>

      <SaveBar />
    </form>
  )
}
