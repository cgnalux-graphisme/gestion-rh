import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('prenom, is_admin_rh')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-[#1a2332]">
        Bonjour, {profile?.prenom} 👋
      </h1>
      <p className="text-sm text-gray-400 mt-1">
        {profile?.is_admin_rh ? 'Vue Admin RH — Tableau de bord' : 'Votre portail personnel'}
      </p>
      <div className="mt-6 p-5 bg-white rounded-xl border border-gray-200 text-sm text-gray-500 max-w-md">
        <p className="font-semibold text-[#1a2332] mb-1">🚧 Module 1 actif</p>
        <p>
          Les modules Pointage, Congés et Calendrier seront disponibles dans les
          prochaines versions.
        </p>
      </div>
    </div>
  )
}
