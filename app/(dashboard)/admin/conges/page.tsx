import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllCongesAdmin } from '@/lib/conges/admin-actions'
import CongesTable from '@/components/admin/CongesTable'

export default async function AdminCongesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const conges = await getAllCongesAdmin()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">
        🌴 Gestion des congés
      </h1>
      <CongesTable initialConges={conges} />
    </div>
  )
}
