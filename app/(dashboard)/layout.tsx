import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { getNotificationCounts } from '@/lib/notifications/counts'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, counts] = await Promise.all([
    supabase
      .from('profiles')
      .select('prenom, nom, is_admin_rh')
      .eq('id', user.id)
      .single(),
    getNotificationCounts(),
  ])

  const profile = profileRes.data

  const initiales = profile
    ? `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()
    : '??'
  const displayName = profile ? `${profile.prenom} ${profile.nom}` : ''

  return (
    <div className="flex h-screen bg-[#f0f2f8] overflow-hidden">
      <Sidebar
        isAdmin={profile?.is_admin_rh ?? false}
        initiales={initiales}
        displayName={displayName}
        counts={counts}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
