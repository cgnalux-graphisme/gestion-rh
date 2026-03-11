import ActivationForm from '@/components/auth/ActivationForm'

export default function ActivationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#e53e3e] text-white font-black text-2xl rounded-lg px-4 py-1.5 mb-2">
            CG
          </div>
          <h1 className="text-sm font-semibold text-[#1a2332]">Activer mon compte</h1>
          <p className="text-xs text-gray-400 mt-1">
            Saisissez votre email et le code à 6 chiffres reçu par email
          </p>
        </div>
        <ActivationForm />
      </div>
    </div>
  )
}
