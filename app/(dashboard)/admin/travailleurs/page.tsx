import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviterDialog from '@/components/admin/InviterDialog'
import TravailleursPageClient from '@/components/admin/TravailleursPageClient'
import { Profile, Service } from '@/types/database'

export default async function TravailleursAdminPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const [workersRes, servicesRes] = await Promise.all([
    supabase.from('profiles').select('*, service:services(*)').order('nom'),
    supabase.from('services').select('*').order('nom'),
  ])

  const workers = (workersRes.data ?? []) as (Profile & { service?: Service })[]
  const services = (servicesRes.data ?? []) as Service[]

  const active = workers.filter((w) => w.is_active)
  const inactive = workers.filter((w) => !w.is_active)

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[#1a2332]">Gestion des travailleurs</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {active.length} actif{active.length !== 1 ? 's' : ''} · {inactive.length} inactif
            {inactive.length !== 1 ? 's' : ''}
          </p>
        </div>
        <InviterDialog services={services} />
      </div>

      <TravailleursPageClient active={active} inactive={inactive} />

      {workers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Aucun travailleur enregistré.</p>
          <p className="text-xs mt-1">Utilisez le bouton ci-dessus pour inviter le premier.</p>
        </div>
      )}
    </div>
  )
}
