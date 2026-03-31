'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold text-base h-11"
    >
      {pending ? 'Connexion en cours…' : 'Se connecter'}
    </Button>
  )
}

export default function LoginForm() {
  const [state, action] = useFormState(signIn, null)

  return (
    <form
      action={action}
      className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold text-gray-600">
          Adresse email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="marie.v@accg-nalux.be"
          className="h-11 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold text-gray-600">
          Mot de passe
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          className="h-11 text-base"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{state.error}</p>
      )}

      <SubmitButton />

      <div className="text-center pt-1">
        <Link
          href="/forgot-password"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Mot de passe oublié ?
        </Link>
      </div>
    </form>
  )
}
