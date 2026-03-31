import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllDemandesHSAdmin } from '@/lib/heures-sup/admin-actions'
import DemandesHSTable from '@/components/admin/DemandesHSTable'

export default async function AdminHeuresSupPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')

  const demandes = await getAllDemandesHSAdmin()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-lg font-bold text-[#1a2332]">Heures supplémentaires</h1>
      <DemandesHSTable demandes={demandes} />
    </div>
  )
}
