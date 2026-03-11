'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { forgotPassword } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold">
      {pending ? 'Envoi en cours…' : 'Recevoir le code'}
    </Button>
  )
}

function ForgotPasswordForm() {
  const [state, action] = useFormState(forgotPassword, null)

  if (state?.success) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center space-y-4">
        <div className="text-4xl">📧</div>
        <p className="text-sm font-semibold text-[#1a2332]">Email envoyé</p>
        <p className="text-xs text-gray-500">
          Si cet email est associé à un compte, vous recevrez un code valable 10 minutes.
        </p>
        <Link href="/reset-password" className="block">
          <Button className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold">
            Saisir le code →
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Adresse email</Label>
        <Input name="email" type="email" required placeholder="marie.v@accg-nalux.be" className="h-9 text-sm" />
      </div>
      <SubmitButton />
      <div className="text-center">
        <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">← Retour à la connexion</Link>
      </div>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#e53e3e] text-white font-black text-2xl rounded-lg px-4 py-1.5 mb-2">CG</div>
          <h1 className="text-sm font-semibold text-[#1a2332]">Mot de passe oublié</h1>
          <p className="text-xs text-gray-400 mt-1">Nous vous enverrons un code de réinitialisation</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
