'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateCoordonneesAction } from '@/lib/auth/profile-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Profile } from '@/types/database'
import { useRef, useState, useEffect } from 'react'

function SaveBar() {
  const { pending } = useFormStatus()
  return (
    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-4 py-3 flex items-center justify-between">
      <span className="text-[10px] text-gray-400">
        Les champs surlignés en vert sont modifiables par vous
      </span>
      <div className="flex gap-2">
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
    </div>
  )
}

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
      <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </Label>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="border-[#a7f3d0] bg-[#f0fff4] focus:ring-green-300 text-xs h-8"
      />
    </div>
  )
}

export default function CoordonneesSection({ profile }: { profile: Profile }) {
  const [state, action] = useFormState(updateCoordonneesAction, null)
  const [showSuccess, setShowSuccess] = useState(false)
  const prevSuccessRef = useRef(state?.success)

  useEffect(() => {
    if (state?.success && !prevSuccessRef.current) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
    prevSuccessRef.current = state?.success
  }, [state?.success])

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">✏️ Mes coordonnées</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
          Modifiable
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field name="prenom" label="Prénom" defaultValue={profile.prenom} />
          <Field name="nom" label="Nom" defaultValue={profile.nom} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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

        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-1">
          Sécurité du compte
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="new_password"
            label="Nouveau mot de passe"
            type="password"
            placeholder="Laisser vide pour ne pas changer"
          />
          <Field
            name="confirm_password"
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
        )}
        {showSuccess && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
            ✓ Coordonnées enregistrées avec succès.
          </p>
        )}
      </div>

      <SaveBar />
    </form>
  )
}
