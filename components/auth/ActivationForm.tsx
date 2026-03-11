'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { activateAccount } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold"
    >
      {pending ? 'Activation en cours…' : 'Activer mon compte'}
    </Button>
  )
}

export default function ActivationForm() {
  const [state, action] = useFormState(activateAccount, null)

  return (
    <form
      action={action}
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4"
    >
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Adresse email</Label>
        <Input name="email" type="email" required placeholder="marie.v@accg-nalux.be" className="h-9 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Code d'activation (6 chiffres)</Label>
        <Input
          name="otp"
          type="text"
          required
          maxLength={6}
          placeholder="123456"
          className="h-9 text-sm text-center tracking-[0.5em] font-bold text-lg"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Nouveau mot de passe</Label>
        <Input name="password" type="password" required placeholder="Min. 8 caractères" className="h-9 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Confirmer le mot de passe</Label>
        <Input name="confirm_password" type="password" required className="h-9 text-sm" />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  )
}
