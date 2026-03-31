'use client'

import { useState } from 'react'
import type { TravailleurCalendrier, JourCalendrier, IndicateursJour, IndicateurPointage } from '@/types/calendrier'
import ChangeStatutModal from '@/components/admin/ChangeStatutModal'
import React from 'react'
import { formatLocalDate } from '@/lib/utils/dates'

/* ─── Statut cell config (mirrored from StatutCell RSC) ─── */
type StatutJour = JourCalendrier['statut']

const CONFIG: Record<StatutJour, { bg: string; text: string; letter: string; tooltip?: string }> = {
  present:  { bg: 'bg-emerald-300', text: 'text-emerald-900', letter: 'P', tooltip: 'Présent' },
  en_cours: { bg: 'bg-emerald-100', text: 'text-emerald-700', letter: 'P', tooltip: 'En cours (arrivée pointée)' },
  absent:   { bg: 'bg-rose-300',   text: 'text-rose-900',   letter: 'A', tooltip: 'Absent' },
  conge:    { bg: 'bg-amber-300', text: 'text-amber-900', letter: 'C' },
  maladie:  { bg: 'bg-sky-300', text: 'text-sky-900', letter: 'M', tooltip: 'Maladie' },
  ferie:    { bg: 'bg-gray-700',  text: 'text-white',  letter: 'F' },
  greve:    { bg: 'bg-purple-300', text: 'text-purple-900', letter: 'G', tooltip: 'Grève' },
  weekend:  { bg: 'bg-gray-200',  text: 'text-gray-400',  letter: '' },
  vide:     { bg: 'bg-white',     text: 'text-gray-200',  letter: '', tooltip: 'Non renseigné' },
}

const INDICATEUR_COLORS: Record<IndicateurPointage, string> = {
  ok: 'bg-green-500',
  anomalie: 'bg-amber-500',
  manquant: 'bg-red-500',
  corrige: 'bg-blue-400',
}

const INDICATEUR_TOOLTIPS: Record<IndicateurPointage, string> = {
  ok: 'OK',
  anomalie: 'A verifier',
  manquant: 'Non pointe',
  corrige: 'Corrige',
}

const CHAMP_LABELS_SHORT = ['Arr', 'M\u2192', '\u2192M', 'Dep'] as const

function DotsIndicateurs({ indicateurs, small }: { indicateurs: IndicateursJour; small?: boolean }) {
  const champs = ['arrivee', 'midi_out', 'midi_in', 'depart'] as const
  const dotSize = small ? 'w-1 h-1' : 'w-1.5 h-1.5'
  return (
    <div className={`flex ${small ? 'gap-[2px]' : 'gap-[3px]'} justify-center`}>
      {champs.map((champ, i) => (
        <span
          key={champ}
          className={`${dotSize} rounded-full ${INDICATEUR_COLORS[indicateurs[champ]]}`}
          title={`${CHAMP_LABELS_SHORT[i]} : ${INDICATEUR_TOOLTIPS[indicateurs[champ]]}`}
        />
      ))}
    </div>
  )
}

function StatutCellClickable({
  statut,
  label,
  anomalie,
  indicateurs,
  size = 'md',
  onClick,
  clickable,
}: {
  statut: StatutJour
  label?: string
  anomalie?: boolean
  indicateurs?: IndicateursJour
  size?: 'sm' | 'md'
  onClick?: () => void
  clickable: boolean
}) {
  const cfg = CONFIG[statut] ?? CONFIG.vide
  const tooltip = anomalie
    ? `${label ?? cfg.tooltip ?? ''} — Pointage a verifier`.trim()
    : (label ?? cfg.tooltip)

  const isEnCours = statut === 'en_cours'
  const isSm = size === 'sm'

  // Tailles : sm = vue mois, md = vue semaine
  const outerSize = isSm ? 'w-7 h-7' : 'w-9 h-9'
  const fontSize = isSm ? 'text-[10px]' : 'text-xs'

  // Bordure : anomalie = amber ring, en_cours = dashed emerald, normal = subtle border
  const borderClass = anomalie
    ? 'ring-2 ring-amber-400 ring-offset-1'
    : isEnCours
      ? 'ring-2 ring-dashed ring-emerald-400 ring-offset-1'
      : 'border border-gray-200/60'

  const cell = (
    <div
      className={`${outerSize} ${cfg.bg} ${cfg.text} ${fontSize} ${borderClass} font-semibold rounded-lg flex flex-col items-center justify-center gap-0 relative ${
        clickable ? 'cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-150' : ''
      }`}
      title={tooltip}
    >
      <span className={indicateurs ? '-mt-0.5' : ''}>{cfg.letter}</span>
      {indicateurs && (
        <div className="absolute bottom-[2px]">
          <DotsIndicateurs indicateurs={indicateurs} small={isSm} />
        </div>
      )}
    </div>
  )

  if (clickable && onClick) {
    return <button onClick={onClick} type="button">{cell}</button>
  }
  return cell
}

/* ─── Status letter to DayStatus mapping for the modal ─── */
function statutToLetter(statut: StatutJour): string {
  return CONFIG[statut]?.letter || '?'
}

function isClickable(statut: StatutJour, dateStr: string): boolean {
  if (statut === 'weekend') return false
  const todayStr = formatLocalDate(new Date())
  // Allow clicks on past and today, not future (unless vide)
  return dateStr <= todayStr || statut === 'vide'
}

/* ─── Shared header formatters ─── */
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatColHeader(dateISO: string): string {
  const [, , day] = dateISO.split('-').map(Number)
  const d = new Date(dateISO + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const jour = JOURS_COURTS[dow === 0 ? 6 : dow - 1]
  return `${jour} ${day}`
}

function nomAbrege(prenom: string, nom: string): string {
  return `${prenom[0]}. ${nom}`
}

/* ─── Bureau sort order ─── */
const BUREAU_ORDER = ['Namur', 'Libramont', 'Marche', 'Arlon']

function bureauSortKey(bureau: string): number {
  const idx = BUREAU_ORDER.indexOf(bureau)
  return idx >= 0 ? idx : BUREAU_ORDER.length
}

type BureauServiceGroup = {
  bureau: string
  service: string
  workers: TravailleurCalendrier[]
}

function groupByBureauService(travailleurs: TravailleurCalendrier[]): BureauServiceGroup[] {
  const groupMap = new Map<string, BureauServiceGroup>()
  for (const t of travailleurs) {
    const key = `${t.bureau}|||${t.service}`
    if (!groupMap.has(key)) {
      groupMap.set(key, { bureau: t.bureau, service: t.service, workers: [] })
    }
    groupMap.get(key)!.workers.push(t)
  }
  return Array.from(groupMap.values()).sort((a, b) => {
    const bCmp = bureauSortKey(a.bureau) - bureauSortKey(b.bureau)
    if (bCmp !== 0) return bCmp
    return a.service.localeCompare(b.service)
  })
}

/* ═══════════════════════════════════════════════════════════
   Vue Semaine — Admin interactive
   ═══════════════════════════════════════════════════════════ */
function SemaineView({
  travailleurs,
  dateDebut,
  onCellClick,
  pendingCorrections,
}: {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string
  onCellClick: (userId: string, date: string, workerName: string, currentStatus: string) => void
  pendingCorrections: Set<string>
}) {
  const dates: string[] = []
  const [y, m, d] = dateDebut.split('-').map(Number)
  for (let i = 0; i < 7; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i))
    dates.push(formatLocalDate(dt))
  }

  const groups = groupByBureauService(travailleurs)
  let lastBureau = ''

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[140px]">
              Travailleur
            </th>
            {dates.map((date) => (
              <th key={date} className="px-2 py-2 text-center font-medium text-gray-500 min-w-[52px]">
                {formatColHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const showBureauHeader = group.bureau !== lastBureau
            lastBureau = group.bureau
            return (
              <React.Fragment key={`${group.bureau}|||${group.service}`}>
                {showBureauHeader && (
                  <tr>
                    <td
                      colSpan={8}
                      className="sticky left-0 bg-[#1a2332] px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wide"
                    >
                      {group.bureau || 'Sans bureau'}
                    </td>
                  </tr>
                )}
                <tr>
                  <td
                    colSpan={8}
                    className="sticky left-0 bg-gray-50 px-3 pl-6 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {group.service}
                  </td>
                </tr>
                {group.workers.map((t) => {
                  const hasAnyPending = t.jours.some((j) => pendingCorrections.has(`${t.id}:${j.date}`))
                  return (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="sticky left-0 bg-white z-10 px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {hasAnyPending && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Correction(s) en attente" />
                          )}
                          {t.prenom} {t.nom}
                        </span>
                      </td>
                      {t.jours.map((jour) => {
                        const canClick = isClickable(jour.statut, jour.date)
                        const hasPending = pendingCorrections.has(`${t.id}:${jour.date}`)
                        return (
                          <td key={jour.date} className={`px-2 py-2 text-center ${hasPending ? 'bg-amber-50' : ''}`}>
                            <StatutCellClickable
                              statut={jour.statut}
                              label={jour.label}
                              anomalie={jour.anomalie}
                              indicateurs={jour.indicateurs}
                              size="md"
                              clickable={canClick}
                              onClick={canClick ? () => onCellClick(t.id, jour.date, `${t.prenom} ${t.nom}`, statutToLetter(jour.statut)) : undefined}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
          {travailleurs.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                Aucun travailleur trouvé pour ces filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Vue Mois — Admin interactive
   ═══════════════════════════════════════════════════════════ */
function MoisView({
  travailleurs,
  dateDebut,
  onCellClick,
  pendingCorrections,
}: {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string
  onCellClick: (userId: string, date: string, workerName: string, currentStatus: string) => void
  pendingCorrections: Set<string>
}) {
  const [year, month] = dateDebut.split('-').map(Number)
  const nbJours = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dates: string[] = []
  for (let d = 1; d <= nbJours; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const groups = groupByBureauService(travailleurs)
  let lastBureau = ''

  return (
    <>
      <p className="md:hidden text-sm text-gray-500 p-4">
        La vue mensuelle n&apos;est pas disponible sur mobile. Utilisez la vue semaine.
      </p>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[120px]">
                Travailleur
              </th>
              {dates.map((date) => (
                <th key={date} className="px-0 py-1.5 text-center font-medium text-gray-400 min-w-[32px]">
                  {parseInt(date.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const showBureauHeader = group.bureau !== lastBureau
              lastBureau = group.bureau
              return (
                <React.Fragment key={`${group.bureau}|||${group.service}`}>
                  {showBureauHeader && (
                    <tr>
                      <td
                        colSpan={dates.length + 1}
                        className="sticky left-0 bg-[#1a2332] px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide"
                      >
                        {group.bureau || 'Sans bureau'}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      className="sticky left-0 bg-gray-50 px-3 pl-6 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {group.service}
                    </td>
                  </tr>
                  {group.workers.map((t) => {
                    const hasAnyPending = t.jours.some((j) => pendingCorrections.has(`${t.id}:${j.date}`))
                    return (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="sticky left-0 bg-white z-10 px-3 py-1 text-xs text-gray-700 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            {hasAnyPending && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Correction(s) en attente" />
                            )}
                            {nomAbrege(t.prenom, t.nom)}
                          </span>
                        </td>
                        {t.jours.map((jour) => {
                          const canClick = isClickable(jour.statut, jour.date)
                          const hasPending = pendingCorrections.has(`${t.id}:${jour.date}`)
                          return (
                            <td key={jour.date} className={`px-0 py-1 text-center ${hasPending ? 'bg-amber-50' : ''}`}>
                              <StatutCellClickable
                                statut={jour.statut}
                                label={jour.label}
                                anomalie={jour.anomalie}
                                indicateurs={jour.indicateurs}
                                size="sm"
                                clickable={canClick}
                                onClick={canClick ? () => onCellClick(t.id, jour.date, `${t.prenom} ${t.nom}`, statutToLetter(jour.statut)) : undefined}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            })}
            {travailleurs.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} className="text-center py-8 text-gray-400">
                  Aucun travailleur trouvé pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─── Légende ─── */
function Legende() {
  const SKIP_KEYS = new Set(['en_cours'])
  const items = Object.entries(CONFIG)
    .filter(([key]) => !SKIP_KEYS.has(key))
    .map(([key, cfg]) => ({
      bg: cfg.bg,
      text: cfg.text,
      letter: cfg.letter,
      label: cfg.tooltip ?? key.charAt(0).toUpperCase() + key.slice(1),
    }))

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 text-[10px] px-3 py-2 space-y-1.5 mb-4">
      {/* Ligne 1 : Statuts */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Statuts</span>
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className={`w-5 h-5 ${item.bg} ${item.text} font-semibold rounded-lg flex items-center justify-center text-[9px] border border-gray-200/60`}>
              {item.letter || ''}
            </div>
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-emerald-300 text-emerald-900 font-semibold rounded-lg flex items-center justify-center text-[9px] ring-2 ring-amber-400 ring-offset-1">
            P
          </div>
          <span className="text-gray-600">Anomalie pointage</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-emerald-100 text-emerald-700 font-semibold rounded-lg flex items-center justify-center text-[9px] ring-2 ring-dashed ring-emerald-400 ring-offset-1">
            P
          </div>
          <span className="text-gray-600">En cours</span>
        </div>
      </div>
      {/* Ligne 2 : Indicateurs pointage (dots) */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-1.5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Pointages</span>
        <span className="text-gray-400 mr-1">4 points = Arr / Midi&#x2192; / &#x2192;Midi / Dep</span>
        {[
          { color: 'bg-green-500', label: 'OK' },
          { color: 'bg-amber-500', label: 'Ecart' },
          { color: 'bg-red-500', label: 'Manquant' },
          { color: 'bg-blue-400', label: 'Corrige' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-gray-600">Correction en attente</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main Wrapper — manages state + modal
   ═══════════════════════════════════════════════════════════ */
type ModalState = {
  userId: string
  date: string
  workerName: string
  currentStatus: string
} | null

export default function CalendrierAdminWrapper({
  vue,
  travailleurs,
  dateDebut,
  bureaux,
  pendingCorrections,
}: {
  vue: 'semaine' | 'mois'
  travailleurs: TravailleurCalendrier[]
  dateDebut: string
  bureaux?: { id: string; nom: string; code: string }[]
  pendingCorrections?: string[]
}) {
  const [modal, setModal] = useState<ModalState>(null)
  const pendingSet = new Set(pendingCorrections ?? [])

  function handleCellClick(userId: string, date: string, workerName: string, currentStatus: string) {
    setModal({ userId, date, workerName, currentStatus })
  }

  return (
    <>
      <Legende />
      {vue === 'semaine' ? (
        <SemaineView travailleurs={travailleurs} dateDebut={dateDebut} onCellClick={handleCellClick} pendingCorrections={pendingSet} />
      ) : (
        <MoisView travailleurs={travailleurs} dateDebut={dateDebut} onCellClick={handleCellClick} pendingCorrections={pendingSet} />
      )}

      {modal && (
        <ChangeStatutModal
          open={true}
          onClose={() => setModal(null)}
          userId={modal.userId}
          date={modal.date}
          workerName={modal.workerName}
          currentStatus={modal.currentStatus}
          bureaux={bureaux}
        />
      )}
    </>
  )
}
