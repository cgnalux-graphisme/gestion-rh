'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'
import { NotificationCounts } from '@/lib/notifications/counts'

interface Props {
  isAdmin: boolean
  initiales: string
  displayName: string
  counts: NotificationCounts
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="bg-[#e53e3e] text-white text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 flex-shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function Sidebar({ isAdmin, initiales, displayName, counts }: Props) {
  const pathname = usePathname()

  // Worker: total unread decisions from RH + pending reassignations
  const workerTotal = counts.decisionsConges + counts.decisionsHS + counts.decisionsCorrections + counts.reassignationsEnAttente
  // Admin: total pending requests to handle
  const adminTotal = counts.congesATraiter + counts.hsATraiter + counts.correctionsATraiter
  const accueilBadge = workerTotal

  const commonLinks = [
    { href: '/', icon: '🏠', label: 'Accueil', badge: accueilBadge },
    { href: '/pointage', icon: '⏱', label: 'Historique pointage', badge: counts.decisionsCorrections },
    { href: '/conges', icon: '📋', label: 'Congés | Absences', badge: 0 },
    { href: '/calendrier', icon: '📅', label: 'Calendrier', badge: 0 },
  ]

  const adminOnlyLinks = [
    { href: '/admin/travailleurs', icon: '👥', label: 'Travailleurs', badge: 0 },
    { href: '/admin/conges', icon: '🌴', label: 'Congés RH', badge: counts.congesATraiter },
    { href: '/admin/heures-sup', icon: '⏱', label: 'Heures Sup RH', badge: counts.hsATraiter },
    { href: '/admin/calendrier', icon: '📅', label: 'Calendrier RH', badge: counts.correctionsATraiter },
    { href: '/admin/ouvertures-bureaux', icon: '🏢', label: 'Ouvertures bureaux', badge: 0 },
    { href: '/admin/parametres-horaires', icon: '⚙️', label: 'Paramètres horaires', badge: 0 },
    { href: '/admin/rapports', icon: '📊', label: 'Rapports', badge: 0 },
  ]

  function renderLink(link: { href: string; icon: string; label: string; badge: number }) {
    const active =
      pathname === link.href ||
      (link.href !== '/' && pathname.startsWith(link.href))
    return (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
          active
            ? 'bg-[#e53e3e]/15 text-[#fc8181]'
            : 'text-white/35 hover:bg-white/8 hover:text-white/70'
        )}
      >
        <span className="text-base flex-shrink-0">{link.icon}</span>
        <span className="font-semibold whitespace-nowrap text-sm flex-1">{link.label}</span>
        <Badge count={link.badge} />
      </Link>
    )
  }

  return (
    <nav className="flex flex-col bg-[#1a2332] w-60 flex-shrink-0">
      {/* Logo */}
      <div className="text-[#e53e3e] font-black text-center py-3 border-b border-white/10 flex-shrink-0 text-base">
        ACCG
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-0.5 p-2 flex-1 justify-evenly overflow-hidden">
        {commonLinks.map(renderLink)}

        {isAdmin && (
          <>
            <div className="border-t border-white/10 my-1" />
            {adminOnlyLinks.map(renderLink)}
          </>
        )}
      </div>

      {/* Profil + déconnexion */}
      <div className="p-2 border-t border-white/10 space-y-0.5 flex-shrink-0">
        <Link
          href="/profil"
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2 transition-all',
            pathname === '/profil' ? 'bg-white/10' : 'hover:bg-white/8'
          )}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
            {initiales}
          </div>
          <span className="text-white/70 text-sm truncate">{displayName}</span>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left text-xs text-white/30 hover:text-white/60 px-3 py-1.5 transition-colors"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </nav>
  )
}
