'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { forgotPassword } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import Image from 'next/image'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold text-base h-11">
      {pending ? 'Envoi en cours...' : 'Recevoir le code'}
    </Button>
  )
}

function ForgotPasswordForm() {
  const [state, action] = useFormState(forgotPassword, null)

  if (state?.success) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center space-y-4">
        <div className="text-4xl">📧</div>
        <p className="text-base font-semibold text-[#1a2332]">Email envoyé</p>
        <p className="text-sm text-gray-500">
          Si cet email est associé à un compte, vous recevrez un code valable 10 minutes.
        </p>
        <Link href="/reset-password" className="block">
          <Button className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-bold text-base h-11">
            Saisir le code →
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-600">Adresse email</Label>
        <Input name="email" type="email" required placeholder="marie.v@accg-nalux.be" className="h-11 text-base" />
      </div>
      <SubmitButton />
      <div className="text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">← Retour à la connexion</Link>
      </div>
    </form>
  )
}

export default function ForgotPasswordPage() {
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
          <h1 className="text-lg font-semibold text-[#1a2332]">Mot de passe oublié</h1>
          <p className="text-sm text-gray-400 mt-1">Nous vous enverrons un code de réinitialisation</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
