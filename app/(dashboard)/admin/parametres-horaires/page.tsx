import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getParametresOptions } from '@/lib/admin/parametres-actions'
import ParametresHorairesForm from '@/components/admin/ParametresHorairesForm'

export default async function ParametresHorairesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')

  const options = await getParametresOptions()

  return (
    <div className="max-w-4xl mx-auto pb-8">
      <div className="p-4">
        <h1 className="text-lg font-bold text-[#1a2332] mb-1">⚙️ Paramètres horaires</h1>
        <p className="text-sm text-gray-500 mb-6">
          Configurez les horaires de travail, congés et pot d&apos;heures pour chaque option (A et B).
        </p>
        <ParametresHorairesForm options={options} />
      </div>
    </div>
  )
}
