import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllBureauxAdmin } from '@/lib/admin/bureaux-actions'
import BureauHorairesForm from '@/components/admin/BureauHorairesForm'

export default async function OuverturesBureauxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')

  const bureaux = await getAllBureauxAdmin()

  return (
    <div className="max-w-4xl mx-auto pb-8">
      <div className="p-4">
        <h1 className="text-lg font-bold text-[#1a2332] mb-1">🏢 Ouvertures bureaux</h1>
        <p className="text-sm text-gray-500 mb-6">
          Configurez les horaires d&apos;ouverture de chaque bureau (affichés sur le profil des travailleurs).
        </p>
        <BureauHorairesForm bureaux={bureaux} />
      </div>
    </div>
  )
}
