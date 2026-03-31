import LoginForm from '@/components/auth/LoginForm'
import Image from 'next/image'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string }
}) {
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
          <div className="text-lg font-semibold text-[#1a2332]">Portail RH</div>
        </div>

        {searchParams.reset === 'success' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Mot de passe réinitialisé avec succès. Connectez-vous.
          </div>
        )}
        {searchParams.error === 'compte_desactive' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Ce compte est désactivé. Contactez votre administrateur RH.
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  )
}
