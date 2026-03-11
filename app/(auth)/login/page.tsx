import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#e53e3e] text-white font-black text-2xl rounded-lg px-4 py-1.5 mb-2">
            CG
          </div>
          <div className="text-sm font-semibold text-[#1a2332]">Portail RH</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Centrale Générale FGTB Namur-Luxembourg
          </div>
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
