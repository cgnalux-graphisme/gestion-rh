import ActivationForm from '@/components/auth/ActivationForm'
import Image from 'next/image'

export default function ActivationPage() {
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
          <h1 className="text-lg font-semibold text-[#1a2332]">Activer mon compte</h1>
          <p className="text-sm text-gray-400 mt-1">
            Saisissez votre email et le code à 6 chiffres reçu par email
          </p>
        </div>
        <ActivationForm />
      </div>
    </div>
  )
}
