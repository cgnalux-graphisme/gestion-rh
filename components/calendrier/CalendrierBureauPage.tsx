'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { CalendrierBureauData } from '@/types/calendrier-bureau'
import type { HorairesBureauHebdo, HorairesBureauJour } from '@/types/database'
import BureauPresenceGrid from './BureauPresenceGrid'
import PermanentsSection from './PermanentsSection'
import { formatLocalDate } from '@/lib/utils/dates'

type Props = {
  allData: CalendrierBureauData[]
  vue: 'semaine' | 'mois'
  dateDebut: string
}

function getHorairesAujourdhui(horaires: HorairesBureauHebdo): HorairesBureauJour | null {
  const dow = new Date().getDay()
  if (dow === 0 || dow === 6) return null
  return horaires[String(dow) as '1' | '2' | '3' | '4' | '5']
}

function getLundiSemaine(d: Date): string {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const lundi = new Date(d)
  lundi.setDate(d.getDate() + diff)
  return formatLocalDate(lundi)
}

function getPremierDuMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function CalendrierBureauPage({ allData, vue, dateDebut }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    router.push(`/calendrier?${sp.toString()}`)
  }

  function navigatePrev() {
    const d = new Date(dateDebut + 'T12:00:00')
    if (vue === 'semaine') {
      d.setDate(d.getDate() - 7)
      navigate({ date: formatLocalDate(d) })
    } else {
      d.setMonth(d.getMonth() - 1)
      navigate({ date: getPremierDuMois(d) })
    }
  }

  function navigateNext() {
    const d = new Date(dateDebut + 'T12:00:00')
    if (vue === 'semaine') {
      d.setDate(d.getDate() + 7)
      navigate({ date: formatLocalDate(d) })
    } else {
      d.setMonth(d.getMonth() + 1)
      navigate({ date: getPremierDuMois(d) })
    }
  }

  function navigateAujourdhui() {
    const today = new Date()
    const date = vue === 'semaine' ? getLundiSemaine(today) : getPremierDuMois(today)
    navigate({ date })
  }

  function switchVue(newVue: 'semaine' | 'mois') {
    const d = new Date(dateDebut + 'T12:00:00')
    const date = newVue === 'semaine' ? getLundiSemaine(d) : getPremierDuMois(d)
    navigate({ vue: newVue, date })
  }

  // Format date range label
  const dateDebutObj = new Date(dateDebut + 'T12:00:00')
  const dateLabel = vue === 'semaine'
    ? `Semaine du ${dateDebutObj.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : dateDebutObj.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })

  // Permanents are shared across bureaux — take from first dataset
  const permanents = allData[0]?.permanents ?? []

  return (
    <div>
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
          >
            ←
          </button>
          <span className="text-xs font-semibold text-gray-700 min-w-[200px] text-center">
            {dateLabel}
          </span>
          <button
            onClick={navigateNext}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm"
          >
            →
          </button>
          <button
            onClick={navigateAujourdhui}
            className="text-[10px] text-gray-500 hover:text-gray-700 underline ml-2"
          >
            Aujourd&apos;hui
          </button>
        </div>
        <div className="flex gap-1">
          {(['semaine', 'mois'] as const).map(v => (
            <button
              key={v}
              onClick={() => switchVue(v)}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                vue === v
                  ? 'bg-[#e53e3e] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {v === 'semaine' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>
      </div>

      {/* All bureaux sections */}
      <div className="space-y-8">
        {allData.map(data => {
          const horairesAuj = getHorairesAujourdhui(data.bureau.horaires)
          return (
            <section key={data.bureau.id}>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xs font-bold text-[#1a2332]">
                  {data.bureau.nom}
                </h2>
                {horairesAuj && (
                  <span className="text-[10px] text-gray-400">
                    {horairesAuj.matin_debut} — {horairesAuj.matin_fin} / {horairesAuj.aprem_debut} — {horairesAuj.aprem_fin}
                  </span>
                )}
              </div>
              <BureauPresenceGrid
                travailleurs={data.travailleurs}
                jours={data.jours}
              />
            </section>
          )
        })}
      </div>

      {/* Permanents section (shared, shown once at bottom) */}
      <PermanentsSection permanents={permanents} />
    </div>
  )
}
