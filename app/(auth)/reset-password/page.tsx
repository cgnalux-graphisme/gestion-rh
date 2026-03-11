'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { resetPassword } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold">
      {pending ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
    </Button>
  )
}

function ResetForm() {
  const [state, action] = useFormState(resetPassword, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Adresse email</Label>
        <Input name="email" type="email" required className="h-9 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Code reçu par email</Label>
        <Input name="otp" type="text" required maxLength={6} placeholder="123456"
          className="h-9 text-sm text-center tracking-[0.5em] font-bold text-lg" />
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
      <div className="text-center">
        <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">← Retour à la connexion</Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#e53e3e] text-white font-black text-2xl rounded-lg px-4 py-1.5 mb-2">CG</div>
          <h1 className="text-sm font-semibold text-[#1a2332]">Nouveau mot de passe</h1>
          <p className="text-xs text-gray-400 mt-1">Saisissez le code reçu par email</p>
        </div>
        <ResetForm />
      </div>
    </div>
  )
}
