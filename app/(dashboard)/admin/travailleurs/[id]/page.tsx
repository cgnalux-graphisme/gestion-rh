import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Profile, Service, UserBureauSchedule, Bureau } from '@/types/database'
import ProfileHeader from '@/components/profile/ProfileHeader'
import TravailleurEditForm from '@/components/admin/TravailleurEditForm'
import BureauScheduleEditor from '@/components/admin/BureauScheduleEditor'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deactivateTravailleurAction } from '@/lib/auth/admin-actions'

async function DeactivateButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  if (!isActive) {
    return (
      <span className="text-[9px] px-3 py-1.5 rounded-md bg-gray-100 text-gray-400 font-medium">
        Compte désactivé
      </span>
    )
  }
  async function doDeactivate() {
    'use server'
    await deactivateTravailleurAction(userId)
    redirect('/admin/travailleurs')
  }
  return (
    <form action={doDeactivate}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
      >
        Désactiver ce travailleur
      </Button>
    </form>
  )
}

export default async function TravailleurFichePage({
  params,
}: {
  params: { id: string }
}) {
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

  const [profileRes, schedulesRes, bureauxRes, servicesRes] = await Promise.all([
    supabase.from('profiles').select('*, service:services(*)').eq('id', params.id).single(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', params.id)
      .order('jour'),
    supabase.from('bureaux').select('*').order('nom'),
    supabase.from('services').select('*').order('nom'),
  ])

  if (profileRes.error || !profileRes.data) redirect('/admin/travailleurs')

  const profile = profileRes.data as Profile & { service: Service | null }
  const schedules = (schedulesRes.data ?? []) as UserBureauSchedule[]
  const bureaux = (bureauxRes.data ?? []) as Bureau[]
  const services = (servicesRes.data ?? []) as Service[]

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <div className="flex items-center gap-2">
          <Link href="/admin/travailleurs">
            <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 h-7 px-2">
              ← Retour
            </Button>
          </Link>
          <span className="text-[9px] text-gray-400">
            / {profile.prenom} {profile.nom}
          </span>
        </div>
        <DeactivateButton userId={profile.id} isActive={profile.is_active} />
      </div>

      <ProfileHeader profile={profile} service={profile.service ?? null} />

      <div className="p-4 space-y-4">
        <TravailleurEditForm profile={profile} services={services} />
        <BureauScheduleEditor
          userId={profile.id}
          bureaux={bureaux}
          schedules={schedules}
        />
      </div>
    </div>
  )
}
