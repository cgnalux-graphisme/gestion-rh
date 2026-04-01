'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateDayStatusAction, correctPointageAction, getPointageDetail } from '@/lib/pointage/admin-actions'
import type { PointageDetail, PointageAlerte, UpdateDayStatusOptions } from '@/lib/pointage/admin-actions'
import { traiterCorrectionAction } from '@/lib/pointage/correction-actions'
import type { TraiterCorrectionOptions } from '@/lib/pointage/correction-actions'
import type { CorrectionPointage } from '@/types/database'
import { assignTempBureauAction, removeTempBureauAction } from '@/lib/calendrier/bureau-actions'

type StatusOption = 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | 'G'

const STATUS_OPTIONS: { value: StatusOption; label: string; emoji: string; bg: string }[] = [
  { value: 'P', label: 'Présent', emoji: '✅', bg: 'bg-green-500 hover:bg-green-600 text-white' },
  { value: 'C', label: 'Congé', emoji: '🌴', bg: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { value: 'M', label: 'Maladie', emoji: '🏥', bg: 'bg-red-500 hover:bg-red-600 text-white' },
  { value: 'R', label: 'Récupération', emoji: '📌', bg: 'bg-violet-500 hover:bg-violet-600 text-white' },
  { value: 'G', label: 'Grève', emoji: '✊', bg: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
  { value: 'F', label: 'Férié', emoji: '🎉', bg: 'bg-gray-500 hover:bg-gray-600 text-white' },
  { value: 'A', label: 'Absent', emoji: '🚫', bg: 'bg-orange-500 hover:bg-orange-600 text-white' },
]

const CHAMP_LABELS: Record<string, string> = {
  arrivee: 'Arrivée',
  midi_out: 'Midi ➜',
  midi_in: '➜ Midi',
  depart: 'Départ',
}

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  date: string
  workerName: string
  currentStatus?: string
  bureaux?: { id: string; nom: string; code: string }[]
  currentTempBureau?: string | null
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// ─── Accordion section for a pointage field ───

type PointageSection = {
  champ: 'arrivee' | 'midi' | 'depart'
  label: string
  heureReelle: string | null
  heureAttendue: string | null
  alerte: PointageAlerte | null
  correction: CorrectionPointage | null
  isCorrige: boolean
}

function PointageAccordion({
  section,
  isPending,
  onApproveCorrection,
  onDeduireCorrection,
}: {
  section: PointageSection
  isPending: boolean
  onApproveCorrection: (correctionId: string, heure: string) => void
  onDeduireCorrection: (correctionId: string, minutes: number) => void
}) {
  const hasIssue = !!section.alerte || !!section.correction
  const [isOpen, setIsOpen] = useState(hasIssue)
  const [deductionMinutes, setDeductionMinutes] = useState('')
  const [refuseComment, setRefuseComment] = useState('')

  // Initialize deduction with calculated delta
  useEffect(() => {
    if (section.alerte) {
      setDeductionMinutes(String(Math.abs(section.alerte.deltaMinutes)))
    }
  }, [section.alerte])

  const statusColor = section.isCorrige
    ? 'border-blue-400/40 bg-blue-400/5'
    : hasIssue
    ? 'border-amber-500/40 bg-amber-500/5'
    : 'border-green-500/30 bg-green-500/5'

  const headerIcon = section.isCorrige
    ? <span className="text-blue-500 text-[11px]">✓ corrigé</span>
    : hasIssue
    ? <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-bold">
        {section.alerte ? `${section.alerte.deltaMinutes > 0 ? '+' : ''}${section.alerte.deltaMinutes} min` : '!'}
      </span>
    : <span className="text-green-600 text-[11px]">✓</span>

  return (
    <div className={`border rounded-lg overflow-hidden ${statusColor}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${isOpen ? 'text-amber-600' : 'text-green-600'}`}>
            {isOpen ? '▼' : '▶'}
          </span>
          <span className="text-[11px] font-semibold text-gray-800">{section.label}</span>
          {section.heureReelle ? (
            <span className={`text-[11px] font-mono ${section.alerte ? 'text-red-600' : 'text-gray-600'}`}>
              {section.heureReelle}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 italic">non pointé</span>
          )}
          {section.heureAttendue && (
            <span className="text-[10px] text-gray-400">→ attendu {section.heureAttendue}</span>
          )}
        </div>
        {headerIcon}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
          {/* Correction request from worker */}
          {section.correction && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 space-y-2">
              <div className="text-[10px] text-amber-800">
                <span className="font-semibold">Correction demandée :</span>{' '}
                <span className="font-mono font-bold">{section.correction.heure_proposee}</span>
              </div>
              <div className="text-[10px] text-gray-600 italic">
                Motif : &laquo;{section.correction.motif}&raquo;
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-1.5">
                {section.heureAttendue && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onApproveCorrection(section.correction!.id, section.heureAttendue!)}
                    className="text-[10px] h-6 bg-green-600 hover:bg-green-700 text-white"
                  >
                    Corriger à {section.heureAttendue}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onApproveCorrection(section.correction!.id, section.correction!.heure_proposee)}
                  className="text-[10px] h-6 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Accepter {section.correction.heure_proposee}
                </Button>
              </div>

              {/* Deduction separator */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="flex-1 border-t border-gray-200" />
                <span>ou déduire du pot</span>
                <span className="flex-1 border-t border-gray-200" />
              </div>

              {/* Deduction block */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={deductionMinutes}
                  onChange={(e) => setDeductionMinutes(e.target.value)}
                  className="w-16 border border-gray-200 rounded px-2 py-1 text-[11px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[10px] text-gray-500">min</span>
                <input
                  type="text"
                  value={refuseComment}
                  onChange={(e) => setRefuseComment(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || !deductionMinutes || parseInt(deductionMinutes) <= 0}
                  onClick={() => onDeduireCorrection(section.correction!.id, parseInt(deductionMinutes))}
                  className="text-[10px] h-6 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Déduire
                </Button>
              </div>
            </div>
          )}

          {/* Alert without correction request */}
          {section.alerte && !section.correction && (
            <div className="text-[10px] text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
              {section.alerte.type === 'retard' ? 'Retard' : 'Avance'} de {Math.abs(section.alerte.deltaMinutes)} min
              <span className="text-gray-400 ml-1">
                (attendu {section.alerte.attendu}, réel {section.alerte.reel})
              </span>
            </div>
          )}

          {/* No issue */}
          {!hasIssue && !section.isCorrige && section.heureReelle && (
            <p className="text-[10px] text-green-600">Pointage conforme à l&apos;horaire.</p>
          )}
          {!section.heureReelle && !section.correction && (
            <p className="text-[10px] text-red-500 italic">Pointage manquant pour ce champ.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───

export default function ChangeStatutModal({
  open,
  onClose,
  userId,
  date,
  workerName,
  currentStatus,
  bureaux,
  currentTempBureau,
}: Props) {
  const [commentaire, setCommentaire] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [detail, setDetail] = useState<PointageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showManualCorrection, setShowManualCorrection] = useState(false)
  const [corrArrivee, setCorrArrivee] = useState('')
  const [corrMidiOut, setCorrMidiOut] = useState('')
  const [corrMidiIn, setCorrMidiIn] = useState('')
  const [corrDepart, setCorrDepart] = useState('')
  const [corrJustification, setCorrJustification] = useState('')

  const [pendingStatus, setPendingStatus] = useState<StatusOption | null>(null)
  const [certificatRecu, setCertificatRecu] = useState(false)
  const [recupMode, setRecupMode] = useState<'journee' | 'partiel'>('journee')
  const [recupHeures, setRecupHeures] = useState('2')
  const [recupMinutes, setRecupMinutes] = useState('0')
  const [tempBureauId, setTempBureauId] = useState('')

  useEffect(() => {
    if (open && userId && date) {
      setLoading(true)
      setDetail(null)
      setShowManualCorrection(false)
      setPendingStatus(null)
      getPointageDetail(userId, date)
        .then((d) => {
          setDetail(d)
          setCorrArrivee(d.pointage.arrivee ?? '')
          setCorrMidiOut(d.pointage.midi_out ?? '')
          setCorrMidiIn(d.pointage.midi_in ?? '')
          setCorrDepart(d.pointage.depart ?? '')
        })
        .catch((err) => {
          console.error('[ChangeStatutModal] getPointageDetail failed:', err)
          setError('Erreur lors du chargement du pointage')
        })
        .finally(() => setLoading(false))
    }
  }, [open, userId, date])

  function handleClose() {
    setCommentaire('')
    setError(null)
    setShowManualCorrection(false)
    setCorrJustification('')
    setPendingStatus(null)
    setCertificatRecu(false)
    setRecupMode('journee')
    setRecupHeures('2')
    setRecupMinutes('0')
    onClose()
  }

  function handleStatusClick(status: StatusOption) {
    if (status === 'M' || status === 'R') {
      setPendingStatus(status)
      setError(null)
      return
    }
    applyStatus(status)
  }

  function applyStatus(status: StatusOption, opts?: UpdateDayStatusOptions) {
    setError(null)
    startTransition(async () => {
      const res = await updateDayStatusAction(userId, date, status, commentaire || undefined, opts)
      if (res?.error) {
        setError(res.error)
        return
      }
      handleClose()
    })
  }

  function handleConfirmMaladie() {
    applyStatus('M', { certificatRecu })
  }

  function handleConfirmRecup() {
    const totalMin = recupMode === 'partiel'
      ? parseInt(recupHeures || '0') * 60 + parseInt(recupMinutes || '0')
      : undefined
    if (recupMode === 'partiel' && (!totalMin || totalMin <= 0)) {
      setError('Indiquez un nombre d\'heures/minutes valide.')
      return
    }
    applyStatus('R', { recupMinutes: totalMin })
  }

  function handleCorrectPointage() {
    if (!corrJustification.trim()) {
      setError('Une justification est requise pour corriger le pointage.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await correctPointageAction(
        userId, date, corrArrivee, corrMidiOut, corrMidiIn, corrDepart
      )
      if (res?.error) {
        setError(res.error)
        return
      }
      await updateDayStatusAction(userId, date, 'P', `Pointage corrigé : ${corrJustification}`)
      handleClose()
    })
  }

  function handleApproveCorrection(correctionId: string, heure: string) {
    setError(null)
    startTransition(async () => {
      const opts: TraiterCorrectionOptions = { heureAppliquee: heure }
      const res = await traiterCorrectionAction(correctionId, 'approuve', undefined, opts)
      if (res?.error) {
        setError(res.error)
        return
      }
      handleClose()
    })
  }

  function handleDeduireCorrection(correctionId: string, minutes: number) {
    setError(null)
    startTransition(async () => {
      const opts: TraiterCorrectionOptions = { minutesDeduites: minutes }
      const res = await traiterCorrectionAction(correctionId, 'refuse', `Déduction de ${minutes} min du pot d'heures`, opts)
      if (res?.error) {
        setError(res.error)
        return
      }
      handleClose()
    })
  }

  // Build accordion sections from detail
  function buildSections(): PointageSection[] {
    if (!detail) return []

    const corrections = detail.corrections ?? []
    const corrMap = new Map<string, CorrectionPointage>()
    for (const c of corrections) corrMap.set(c.champ, c)

    const alerteMap = new Map<string, PointageAlerte>()
    for (const a of detail.alertes) alerteMap.set(a.champ, a)

    const corr = detail.correctionsAppliquees ?? {}

    const sections: PointageSection[] = [
      {
        champ: 'arrivee',
        label: 'Arrivée',
        heureReelle: detail.pointage.arrivee,
        heureAttendue: detail.horairesAttendus?.ouverture ?? null,
        alerte: alerteMap.get('arrivee') ?? null,
        correction: corrMap.get('arrivee') ?? null,
        isCorrige: !!corr['arrivee'],
      },
      {
        champ: 'midi',
        label: 'Pause midi',
        heureReelle: detail.pointage.midi_out && detail.pointage.midi_in
          ? `${detail.pointage.midi_out} → ${detail.pointage.midi_in}`
          : detail.pointage.midi_out ?? detail.pointage.midi_in ?? null,
        heureAttendue: detail.horairesAttendus ? `${detail.horairesAttendus.pause_midi} min` : null,
        alerte: alerteMap.get('midi_in') ?? alerteMap.get('midi_out') ?? null,
        correction: corrMap.get('midi_out') ?? corrMap.get('midi_in') ?? null,
        isCorrige: !!corr['midi_out'] || !!corr['midi_in'],
      },
      {
        champ: 'depart',
        label: 'Départ',
        heureReelle: detail.pointage.depart,
        heureAttendue: detail.horairesAttendus?.fermeture ?? null,
        alerte: alerteMap.get('depart') ?? null,
        correction: corrMap.get('depart') ?? null,
        isCorrige: !!corr['depart'],
      },
    ]

    return sections
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const sections = buildSections()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Modifier le statut</DialogTitle>
          <p className="text-[10px] text-gray-500">
            {workerName} &mdash; {dateLabel}
          </p>
          {currentStatus && (
            <p className="text-[10px] text-gray-400">
              Statut actuel : <span className="font-bold">{currentStatus}</span>
            </p>
          )}
        </DialogHeader>

        {/* ─── Accordion Pointage Sections ─── */}
        {loading && (
          <div className="text-[10px] text-gray-400 animate-pulse py-2">Chargement du pointage...</div>
        )}

        {detail && !loading && (
          <div className="space-y-1.5">
            {sections.map((section) => (
              <PointageAccordion
                key={section.champ}
                section={section}
                isPending={isPending}
                onApproveCorrection={handleApproveCorrection}
                onDeduireCorrection={handleDeduireCorrection}
              />
            ))}

            {/* Manual correction toggle */}
            <button
              type="button"
              onClick={() => setShowManualCorrection(!showManualCorrection)}
              className="text-[10px] text-[#1a2332] underline underline-offset-2 hover:text-[#e53e3e] transition-colors"
            >
              {showManualCorrection ? 'Masquer la correction manuelle' : 'Corriger le pointage manuellement'}
            </button>

            {showManualCorrection && (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ['Arrivée', corrArrivee, setCorrArrivee],
                    ['Midi ➜', corrMidiOut, setCorrMidiOut],
                    ['➜ Midi', corrMidiIn, setCorrMidiIn],
                    ['Départ', corrDepart, setCorrDepart],
                  ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                    <div key={label}>
                      <label className="block text-[9px] text-gray-400 font-medium mb-0.5">{label}</label>
                      <input
                        type="time"
                        value={val}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-[#1a2332]"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 font-medium mb-0.5">
                    Justification (obligatoire)
                  </label>
                  <textarea
                    value={corrJustification}
                    onChange={(e) => setCorrJustification(e.target.value)}
                    placeholder="Raison de la correction..."
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs resize-none h-12 focus:outline-none focus:ring-1 focus:ring-[#1a2332]"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || !corrJustification.trim()}
                  onClick={handleCorrectPointage}
                  className="text-[11px] h-7 bg-[#1a2332] hover:bg-[#2d3f55] text-white"
                >
                  {isPending ? 'Correction...' : 'Appliquer la correction'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── Formulaire spécial Maladie ─── */}
        {pendingStatus === 'M' && (
          <div className="border border-red-200 bg-red-50/50 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-bold text-red-700">🏥 Maladie — Certificat médical</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={certificatRecu}
                onChange={(e) => setCertificatRecu(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-[11px] text-gray-700">Certificat médical reçu</span>
            </label>
            {!certificatRecu && (
              <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                Le travailleur devra fournir un certificat médical. Un rappel sera noté.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleConfirmMaladie}
                className="text-[11px] h-7 bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? 'Enregistrement...' : 'Confirmer Maladie'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7"
                onClick={() => setPendingStatus(null)}
              >
                Retour
              </Button>
            </div>
          </div>
        )}

        {/* ─── Formulaire spécial Récupération ─── */}
        {pendingStatus === 'R' && (
          <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-bold text-violet-700">📌 Récupération — Déduction du pot d&apos;heures</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recupMode"
                  checked={recupMode === 'journee'}
                  onChange={() => setRecupMode('journee')}
                  className="text-violet-600 focus:ring-violet-500"
                />
                <span className="text-[11px] text-gray-700">Journée complète</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recupMode"
                  checked={recupMode === 'partiel'}
                  onChange={() => setRecupMode('partiel')}
                  className="text-violet-600 focus:ring-violet-500"
                />
                <span className="text-[11px] text-gray-700">Récupération partielle</span>
              </label>
            </div>
            {recupMode === 'partiel' && (
              <div className="flex items-center gap-2 pl-5">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={recupHeures}
                  onChange={(e) => setRecupHeures(e.target.value)}
                  className="w-14 border border-gray-200 rounded px-2 py-1 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <span className="text-[11px] text-gray-500">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={15}
                  value={recupMinutes}
                  onChange={(e) => setRecupMinutes(e.target.value)}
                  className="w-14 border border-gray-200 rounded px-2 py-1 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <span className="text-[11px] text-gray-500">min</span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleConfirmRecup}
                className="text-[11px] h-7 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isPending ? 'Enregistrement...' : 'Confirmer Récupération'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7"
                onClick={() => setPendingStatus(null)}
              >
                Retour
              </Button>
            </div>
          </div>
        )}

        {/* ─── Section Statut (masquée si formulaire spécial affiché) ─── */}
        {error && (
          <p className="text-[10px] text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        {!pendingStatus && (
          <>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusClick(opt.value)}
                  disabled={isPending}
                  className={[
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all',
                    opt.bg,
                    isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span className="text-sm">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-gray-500 font-medium">
                Commentaire (optionnel)
              </label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Raison du changement..."
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs resize-none h-16 focus:outline-none focus:ring-1 focus:ring-[#1a2332]"
              />
            </div>
          </>
        )}

        {/* ─── Affectation temporaire de bureau ─── */}
        {bureaux && bureaux.length > 0 && !pendingStatus && (
          <div className="border-t pt-3 mt-1">
            <p className="text-[10px] font-semibold text-gray-500 mb-2">Affectation temporaire de bureau</p>
            {currentTempBureau ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-700">
                  ↔ Actuellement affecté temporairement
                </span>
                <button
                  onClick={async () => {
                    const res = await removeTempBureauAction(userId, date)
                    if (res.error) setError(res.error)
                    else handleClose()
                  }}
                  className="text-[10px] text-red-600 hover:text-red-800 underline"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={tempBureauId}
                  onChange={e => setTempBureauId(e.target.value)}
                  className="text-[10px] border rounded px-2 py-1"
                >
                  <option value="">Choisir un bureau...</option>
                  {bureaux.map(b => (
                    <option key={b.id} value={b.id}>{b.nom}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (!tempBureauId) return
                    const res = await assignTempBureauAction(userId, date, tempBureauId)
                    if (res.error) setError(res.error)
                    else handleClose()
                  }}
                  disabled={!tempBureauId}
                  className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 disabled:opacity-50"
                >
                  Affecter
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleClose}
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
