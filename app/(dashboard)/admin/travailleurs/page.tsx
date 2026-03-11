import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TravailleursTable from '@/components/admin/TravailleursTable'
import InviterDialog from '@/components/admin/InviterDialog'
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
          <h1 className="text-sm font-bold text-[#1a2332]">👥 Gestion des travailleurs</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {active.length} actif{active.length !== 1 ? 's' : ''} · {inactive.length} inactif
            {inactive.length !== 1 ? 's' : ''}
          </p>
        </div>
        <InviterDialog services={services} />
      </div>

      {active.length > 0 && (
        <section>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Travailleurs actifs
          </p>
          <TravailleursTable workers={active} />
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6">
            Inactifs
          </p>
          <TravailleursTable workers={inactive} />
        </section>
      )}

      {workers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Aucun travailleur enregistré.</p>
          <p className="text-xs mt-1">Utilisez le bouton ci-dessus pour inviter le premier.</p>
        </div>
      )}
    </div>
  )
}
