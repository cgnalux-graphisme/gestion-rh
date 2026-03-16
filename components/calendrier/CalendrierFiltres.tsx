'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { CalendrierFiltresProps } from '@/types/calendrier'

// Toutes les opérations sur les dates ISO utilisent UTC pour éviter les décalages timezone.

function isoToUtc(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function utcToIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

/** Retourne le lundi (ISO UTC) de la semaine contenant dateIso. */
function getLundiSemaine(dateIso: string): string {
  const [y, m, d] = isoToUtc(dateIso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=dim
  const diff = dow === 0 ? -6 : 1 - dow
  return utcToIso(y, m, d + diff)
}

function formatPeriodeLabel(vue: 'semaine' | 'mois', date: string): string {
  // Utiliser les composants ISO directement pour éviter les décalages timezone
  const [y, m, d] = isoToUtc(date)
  if (vue === 'mois') {
    const dt = new Date(Date.UTC(y, m - 1, 1))
    return dt.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  // Vue semaine : du lundi au dimanche
  const lundiDt = new Date(Date.UTC(y, m - 1, d))
  const dimancheDt = new Date(Date.UTC(y, m - 1, d + 6))
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'UTC' }
  const lundiStr = lundiDt.toLocaleDateString('fr-BE', opts)
  const dimancheStr = dimancheDt.toLocaleDateString('fr-BE', { ...opts, year: 'numeric' })
  return `Semaine du ${lundiStr} au ${dimancheStr}`
}

export default function CalendrierFiltres({
  vue,
  date,
  serviceId,
  bureauId,
  services,
  bureaux,
}: CalendrierFiltresProps) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { vue, date, serviceId, bureauId, ...updates }
    if (merged.vue) params.set('vue', merged.vue)
    if (merged.date) params.set('date', merged.date)
    if (merged.serviceId) params.set('service', merged.serviceId)
    if (merged.bureauId) params.set('bureau', merged.bureauId)
    router.push(`${pathname}?${params.toString()}`)
  }

  function navigatePrev() {
    // date est toujours le lundi de la semaine (normalisé par la page)
    if (vue === 'semaine') {
      const [y, m, d] = isoToUtc(date)
      navigate({ date: utcToIso(y, m, d - 7) })
    } else {
      const [y, m] = isoToUtc(date)
      const prev = new Date(Date.UTC(y, m - 2, 1)) // m-2 car mois 0-indexé
      navigate({ date: `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  function navigateNext() {
    if (vue === 'semaine') {
      const [y, m, d] = isoToUtc(date)
      navigate({ date: utcToIso(y, m, d + 7) })
    } else {
      const [y, m] = isoToUtc(date)
      const next = new Date(Date.UTC(y, m, 1)) // m car mois 0-indexé → mois suivant
      navigate({ date: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  function navigateAujourdhui() {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const d = today.getDate()
    const todayIso = utcToIso(y, m, d)
    if (vue === 'semaine') {
      navigate({ date: getLundiSemaine(todayIso) })
    } else {
      navigate({ date: `${y}-${String(m).padStart(2, '0')}-01` })
    }
  }

  function switchVue(newVue: 'semaine' | 'mois') {
    const [y, m, d] = isoToUtc(date)
    let newDate: string
    if (newVue === 'mois') {
      // Lundi → 1er du mois contenant ce lundi (tout en UTC)
      newDate = `${y}-${String(m).padStart(2, '0')}-01`
    } else {
      // 1er du mois → lundi de la semaine contenant le 1er
      newDate = getLundiSemaine(utcToIso(y, m, d))
    }
    navigate({ vue: newVue, date: newDate })
  }

  const btnBase = 'px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600'
  const selectBase = 'text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#e53e3e]/30'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Navigation période */}
      <div className="flex items-center gap-1">
        <button onClick={navigatePrev} className={btnBase} title="Période précédente">←</button>
        <span className="text-sm font-medium text-gray-700 px-2 min-w-[220px] text-center">
          {formatPeriodeLabel(vue, date)}
        </span>
        <button onClick={navigateNext} className={btnBase} title="Période suivante">→</button>
        <button onClick={navigateAujourdhui} className={`${btnBase} ml-1`}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 ml-auto">
        <select
          className={selectBase}
          value={serviceId ?? ''}
          onChange={(e) => navigate({ serviceId: e.target.value || undefined })}
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>

        <select
          className={selectBase}
          value={bureauId ?? ''}
          onChange={(e) => navigate({ bureauId: e.target.value || undefined })}
        >
          <option value="">Tous les bureaux</option>
          {bureaux.map((b) => (
            <option key={b.id} value={b.id}>{b.nom}</option>
          ))}
        </select>

        {/* Switch vue */}
        <div className="flex rounded border border-gray-200 overflow-hidden">
          {(['semaine', 'mois'] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchVue(v)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                vue === v
                  ? 'bg-[#1a2332] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
