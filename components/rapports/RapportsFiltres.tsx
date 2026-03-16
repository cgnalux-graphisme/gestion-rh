'use client'

import { useRouter, usePathname } from 'next/navigation'
import { labelPeriode, navigatePeriode, periodeDateAujourdhui } from '@/lib/rapports/periodes'
import type { PeriodeType } from '@/types/rapports'

type Props = {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}

export default function RapportsFiltres({
  periodeType,
  periodeDate,
  serviceId,
  bureauId,
  services,
  bureaux,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { periode: periodeType, date: periodeDate, service: serviceId, bureau: bureauId, ...updates }
    if (merged.periode) params.set('periode', merged.periode)
    if (merged.date) params.set('date', merged.date)
    if (merged.service) params.set('service', merged.service)
    if (merged.bureau) params.set('bureau', merged.bureau)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handlePrev() {
    navigate({ date: navigatePeriode(periodeType, periodeDate, 'prev') })
  }

  function handleNext() {
    navigate({ date: navigatePeriode(periodeType, periodeDate, 'next') })
  }

  function handleAujourdhui() {
    navigate({ date: periodeDateAujourdhui(periodeType) })
  }

  function handlePeriodeTypeChange(newType: string) {
    navigate({ periode: newType, date: periodeDateAujourdhui(newType as PeriodeType) })
  }

  const btnBase = 'px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600'
  const selectBase = 'text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#e53e3e]/30'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {/* Navigation période */}
      <div className="flex items-center gap-1">
        <button onClick={handlePrev} className={btnBase} title="Période précédente">←</button>
        <span className="text-sm font-medium text-gray-700 px-2 min-w-[180px] text-center">
          {labelPeriode(periodeType, periodeDate)}
        </span>
        <button onClick={handleNext} className={btnBase} title="Période suivante">→</button>
        <button onClick={handleAujourdhui} className={`${btnBase} ml-1`}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Type de période */}
        <div className="flex rounded border border-gray-200 overflow-hidden">
          {(['mois', 'trimestre', 'annee'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handlePeriodeTypeChange(t)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                periodeType === t
                  ? 'bg-[#1a2332] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'annee' ? 'Année' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <select
          className={selectBase}
          value={serviceId ?? ''}
          onChange={(e) => navigate({ service: e.target.value || undefined })}
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>

        <select
          className={selectBase}
          value={bureauId ?? ''}
          onChange={(e) => navigate({ bureau: e.target.value || undefined })}
        >
          <option value="">Tous les bureaux</option>
          {bureaux.map((b) => (
            <option key={b.id} value={b.id}>{b.nom}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
