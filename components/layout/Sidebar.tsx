'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const workerLinks = [
  { href: '/', icon: '🏠', label: 'Accueil' },
  { href: '/pointage', icon: '⏱', label: 'Pointage' },
  { href: '/conges', icon: '🌴', label: 'Congés' },
  { href: '/calendrier', icon: '📅', label: 'Calendrier' },
  { href: '/documents', icon: '📄', label: 'Documents' },
]

const adminLinks = [
  { href: '/', icon: '🏠', label: 'Accueil' },
  { href: '/admin/travailleurs', icon: '👥', label: 'Travailleurs' },
  { href: '/pointage', icon: '⏱', label: 'Pointage' },
  { href: '/admin/conges', icon: '🌴', label: 'Congés RH' },
  { href: '/admin/calendrier', icon: '📅', label: 'Calendrier' },
  { href: '/admin/rapports', icon: '📊', label: 'Rapports' },
]

interface Props {
  isAdmin: boolean
  initiales: string
  displayName: string
}

export default function Sidebar({ isAdmin, initiales, displayName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const pathname = usePathname()
  const links = isAdmin ? adminLinks : workerLinks

  return (
    <nav
      className={cn(
        'flex flex-col bg-[#1a2332] transition-all duration-200 flex-shrink-0',
        expanded ? 'w-44' : 'w-[52px]'
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="text-[#e53e3e] font-black text-center py-3 border-b border-white/10 flex-shrink-0 text-sm">
        {expanded ? 'ACCG' : 'CG'}
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-1 p-2 flex-1 overflow-hidden">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-all overflow-hidden',
                active
                  ? 'bg-[#e53e3e]/15 text-[#fc8181]'
                  : 'text-white/35 hover:bg-white/8 hover:text-white/70'
              )}
            >
              <span className="text-base flex-shrink-0">{link.icon}</span>
              {expanded && (
                <span className="font-semibold whitespace-nowrap text-xs">{link.label}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Profil + déconnexion */}
      <div className="p-2 border-t border-white/10 space-y-1">
        <Link
          href="/profil"
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2 transition-all overflow-hidden',
            pathname === '/profil' ? 'bg-white/10' : 'hover:bg-white/8'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
            {initiales}
          </div>
          {expanded && (
            <span className="text-white/70 text-xs truncate">{displayName}</span>
          )}
        </Link>

        {expanded && (
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left text-[10px] text-white/30 hover:text-white/60 px-2 py-1 transition-colors"
            >
              Déconnexion
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
