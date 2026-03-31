'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { resetPassword } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import Image from 'next/image'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold text-base h-11">
      {pending ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
    </Button>
  )
}

function ResetForm() {
  const [state, action] = useFormState(resetPassword, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-600">Adresse email</Label>
        <Input name="email" type="email" required className="h-11 text-base" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-600">Code reçu par email</Label>
        <Input name="otp" type="text" required maxLength={6} placeholder="123456"
          className="h-11 text-base text-center tracking-[0.5em] font-bold text-lg" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-600">Nouveau mot de passe</Label>
        <Input name="password" type="password" required placeholder="Min. 8 caractères" className="h-11 text-base" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-600">Confirmer le mot de passe</Label>
        <Input name="confirm_password" type="password" required className="h-11 text-base" />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{state.error}</p>
      )}
      <SubmitButton />
      <div className="text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">← Retour à la connexion</Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <Image
            src="/Logo CG Nalux.png"
            alt="Centrale Générale FGTB Namur-Luxembourg"
            width={400}
            height={80}
            className="mx-auto mb-3"
            priority
          />
          <h1 className="text-lg font-semibold text-[#1a2332]">Nouveau mot de passe</h1>
          <p className="text-sm text-gray-400 mt-1">Saisissez le code reçu par email</p>
        </div>
        <ResetForm />
      </div>
    </div>
  )
}
