'use client'

import { useState } from 'react'
import TravailleursTable from '@/components/admin/TravailleursTable'
import { Profile, Service } from '@/types/database'

type Worker = Profile & { service?: Service }

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function filterWorkers(workers: Worker[], query: string): Worker[] {
  if (!query.trim()) return workers
  const q = normalize(query)
  return workers.filter((w) => {
    const full = normalize(`${w.prenom} ${w.nom} ${w.email} ${w.service?.nom ?? ''}`)
    return full.includes(q)
  })
}

export default function TravailleursPageClient({
  active,
  inactive,
}: {
  active: Worker[]
  inactive: Worker[]
}) {
  const [search, setSearch] = useState('')
  const [archivesOpen, setArchivesOpen] = useState(false)

  const filteredActive = filterWorkers(active, search)
  const filteredInactive = filterWorkers(inactive, search)

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom, email, service…"
          className="w-full h-9 pl-8 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a2332]/20 focus:border-[#1a2332] placeholder:text-gray-300"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Travailleurs actifs */}
      <section>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Travailleurs actifs
          {search && (
            <span className="ml-2 text-gray-300 normal-case font-normal">
              {filteredActive.length} résultat{filteredActive.length !== 1 ? 's' : ''}
            </span>
          )}
        </p>
        <TravailleursTable workers={filteredActive} />
      </section>

      {/* Archives (accordéon) */}
      {inactive.length > 0 && (
        <section>
          <button
            onClick={() => setArchivesOpen(!archivesOpen)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <span
              className={`text-[10px] text-gray-400 transition-transform ${
                archivesOpen ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-500 transition-colors">
              Archives
            </span>
            <span className="text-[9px] text-gray-300 font-normal">
              {inactive.length} inactif{inactive.length !== 1 ? 's' : ''}
              {search && filteredInactive.length !== inactive.length && (
                <span className="ml-1">
                  · {filteredInactive.length} résultat{filteredInactive.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span className="flex-1 border-t border-gray-100 ml-2" />
          </button>

          {archivesOpen && (
            <div className="mt-2">
              <TravailleursTable workers={filteredInactive} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
