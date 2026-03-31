'use client'

import { useState, useEffect, useTransition } from 'react'
import { AuditLog, AuditCategory } from '@/types/database'
import { getHistoriqueTravailleur, getStatsTravailleur, StatsAnnee } from '@/lib/audit/actions'

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  conges: 'Congés',
  pointage: 'Pointage',
  heures_sup: 'Heures sup.',
  regime: 'Régime',
  profil: 'Profil',
  admin: 'Admin',
  pot_heures: 'Pot heures',
}

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  conges: 'bg-blue-100 text-blue-700 border-blue-200',
  pointage: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  heures_sup: 'bg-orange-100 text-orange-700 border-orange-200',
  regime: 'bg-purple-100 text-purple-700 border-purple-200',
  profil: 'bg-gray-100 text-gray-700 border-gray-200',
  admin: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pot_heures: 'bg-pink-100 text-pink-700 border-pink-200',
}

const CATEGORY_DOTS: Record<AuditCategory, string> = {
  conges: 'bg-blue-500',
  pointage: 'bg-emerald-500',
  heures_sup: 'bg-orange-500',
  regime: 'bg-purple-500',
  profil: 'bg-gray-500',
  admin: 'bg-yellow-500',
  pot_heures: 'bg-pink-500',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatsPanel({ stats }: { stats: StatsAnnee[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 italic py-4">
        Aucune donnée de présence disponible.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div key={s.annee} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#1a2332]">{s.annee}</span>
            <span
              className={`text-xs font-black ${
                s.taux_presence >= 90
                  ? 'text-green-600'
                  : s.taux_presence >= 75
                  ? 'text-orange-600'
                  : 'text-red-600'
              }`}
            >
              {s.taux_presence}% présence
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                s.taux_presence >= 90
                  ? 'bg-green-500'
                  : s.taux_presence >= 75
                  ? 'bg-orange-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(s.taux_presence, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[9px] text-gray-400 uppercase">Congés</div>
              <div className="text-xs font-bold text-blue-600">{s.jours_conge}j</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 uppercase">Maladie</div>
              <div className="text-xs font-bold text-red-600">{s.jours_maladie}j</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 uppercase">Récup</div>
              <div className="text-xs font-bold text-orange-600">{s.jours_recup}j</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-400 uppercase">Total abs.</div>
              <div className="text-xs font-bold text-gray-700">{s.total_absences}j</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HistoriqueSection({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<StatsAnnee[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<AuditCategory | ''>('')
  const [page, setPage] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'timeline' | 'stats'>('timeline')
  const PAGE_SIZE = 30

  useEffect(() => {
    startTransition(async () => {
      const [histResult, statsResult] = await Promise.all([
        getHistoriqueTravailleur(userId, {
          category: filter || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        getStatsTravailleur(userId),
      ])
      setLogs(histResult.logs)
      setTotal(histResult.total)
      setStats(statsResult)
    })
  }, [userId, filter, page])

  function handleFilterChange(cat: AuditCategory | '') {
    setFilter(cat)
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const categories: AuditCategory[] = [
    'conges',
    'pointage',
    'heures_sup',
    'pot_heures',
    'regime',
    'admin',
    'profil',
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">
          Historique & Statistiques
        </span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
          {total} événement{total > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('timeline')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            tab === 'timeline'
              ? 'text-[#1a2332] border-b-2 border-[#e53e3e]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Historique
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            tab === 'stats'
              ? 'text-[#1a2332] border-b-2 border-[#e53e3e]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Stats par année
        </button>
      </div>

      <div className="p-4">
        {tab === 'stats' ? (
          <StatsPanel stats={stats} />
        ) : (
          <>
            {/* Category filters */}
            <div className="flex gap-1 flex-wrap mb-4">
              <button
                onClick={() => handleFilterChange('')}
                className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                  filter === ''
                    ? 'bg-[#1a2332] text-white border-[#1a2332]'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Tout
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleFilterChange(cat)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                    filter === cat
                      ? CATEGORY_COLORS[cat]
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className={`space-y-0 ${isPending ? 'opacity-50' : ''}`}>
              {logs.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic py-4">
                  Aucun événement enregistré.
                </p>
              ) : (
                logs.map((log, i) => (
                  <div key={log.id} className="flex gap-3">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center w-3 flex-shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          CATEGORY_DOTS[log.category as AuditCategory] ?? 'bg-gray-400'
                        }`}
                      />
                      {i < logs.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 my-0.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[#1a2332] leading-snug">
                            {log.description}
                          </p>
                          {log.commentaire && (
                            <p className="text-[10px] text-gray-500 italic mt-0.5">
                              &ldquo;{log.commentaire}&rdquo;
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border flex-shrink-0 ${
                            CATEGORY_COLORS[log.category as AuditCategory] ?? 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {CATEGORY_LABELS[log.category as AuditCategory] ?? log.category}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">
                        {formatDate(log.created_at)}
                        {log.actor && (
                          <span>
                            {' '}
                            &middot; par {log.actor.prenom} {log.actor.nom}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isPending}
                  className="text-[10px] text-gray-500 hover:text-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &larr; Précédent
                </button>
                <span className="text-[9px] text-gray-400">
                  Page {page + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isPending}
                  className="text-[10px] text-gray-500 hover:text-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Suivant &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
