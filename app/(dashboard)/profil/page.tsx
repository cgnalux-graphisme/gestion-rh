import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import CoordonneesSection from '@/components/profile/CoordonneesSection'
import DonneesRHSection from '@/components/profile/DonneesRHSection'
import AffectationSection from '@/components/profile/AffectationSection'
import { Profile, Service, UserBureauSchedule } from '@/types/database'

export default async function ProfilPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileRes, schedulesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, service:services(*)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .order('jour'),
  ])

  if (profileRes.error || !profileRes.data) redirect('/login')

  const profile = profileRes.data as Profile & { service: Service | null }
  const schedules = (schedulesRes.data ?? []) as UserBureauSchedule[]

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <ProfileHeader profile={profile} service={profile.service ?? null} />
      <div className="p-4 space-y-4">
        <CoordonneesSection profile={profile} />
        <DonneesRHSection profile={profile} service={profile.service ?? null} />
        <AffectationSection schedules={schedules} />
      </div>
    </div>
  )
}
