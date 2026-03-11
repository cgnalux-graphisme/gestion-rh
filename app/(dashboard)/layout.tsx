import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('prenom, nom, is_admin_rh')
    .eq('id', user.id)
    .single()

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
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
