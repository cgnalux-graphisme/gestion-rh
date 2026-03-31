'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Conge, Profile } from '@/types/database'
import { traiterCongeAction, getSignedUrlAdminAction, creerReassignation } from '@/lib/conges/admin-actions'
import {
  getCongeContext,
  type CongeContext,
  type WorkerSoldes,
  type DayCoverage,
  type DayAvailability,
  type SoldeAlert,
} from '@/lib/conges/context-actions'
import { formatDateFr, labelTypeConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conge: CongeWithProfile
  open: boolean
  onClose: () => void
  onDone: () => void
}

// ─── Alert styling helpers ───

const ALERT_COLORS: Record<SoldeAlert, string> = {
  ok: 'bg-green-100 text-green-700',
  warning: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
}

const ALERT_LABELS: Record<SoldeAlert, string> = {
  ok: 'OK',
  warning: 'Attention',
  danger: 'Insuffisant',
}

const STATUS_EMOJI: Record<string, string> = {
  present: '✅',
  conge: '🏖️',
  maladie: '🤒',
  absent: '❌',
  demandeur: '👤',
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  conge: 'En congé',
  maladie: 'Maladie',
  absent: 'Absent',
  demandeur: 'Demandeur',
}

// ─── Zone: Résumé demande ───

function ZoneResume({ conge, onViewCert }: {
  conge: CongeWithProfile
  onViewCert: () => void
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-[12px]">
      <div className="flex justify-between">
        <span className="text-gray-500">Travailleur</span>
        <span className="font-semibold text-[#1a2332]">{conge.profile.prenom} {conge.profile.nom}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Type</span>
        <span className="font-semibold">{labelTypeConge(conge.type)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Période</span>
        <span className="font-semibold">
          {conge.demi_journee
            ? <>{formatDateFr(conge.date_debut)} ({labelDemiJournee(conge.demi_journee)})</>
            : <>{formatDateFr(conge.date_debut)} → {formatDateFr(conge.date_fin)}</>
          }
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Durée</span>
        <span className="font-semibold">{formatNbJours(conge.nb_jours)} jour{conge.nb_jours > 1 ? 's' : ''}</span>
      </div>
      {conge.commentaire_travailleur && (
        <div className="bg-blue-50 rounded p-2 text-[11px] text-blue-700 mt-2">
          <strong>Note :</strong> {conge.commentaire_travailleur}
        </div>
      )}
      {conge.piece_jointe_url && (
        <button
          onClick={onViewCert}
          className="text-[11px] text-[#e53e3e] font-semibold hover:underline mt-1"
        >
          📎 Voir le certificat
        </button>
      )}
    </div>
  )
}

// ─── Zone: Soldes ───

function ZoneSoldes({ soldes }: { soldes: WorkerSoldes }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold text-[#1a2332] uppercase tracking-wide">
        Soldes du travailleur
      </h3>
      <div className="bg-gray-50 rounded-lg p-3 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{soldes.label.split(':')[0]}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ALERT_COLORS[soldes.alert]}`}>
            {ALERT_LABELS[soldes.alert]}
          </span>
        </div>
        <div className="mt-1.5 text-[11px]">
          <span className="text-gray-500">Actuel :</span>{' '}
          <span className="font-semibold">
            {soldes.soldeActuel} {soldes.unite === 'minutes' ? 'min' : 'j'}
          </span>
          <span className="mx-1.5 text-gray-300">→</span>
          <span className="text-gray-500">Après :</span>{' '}
          <span className={`font-bold ${soldes.apresApprobation < 0 ? 'text-red-600' : soldes.apresApprobation === 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {soldes.apresApprobation} {soldes.unite === 'minutes' ? 'min' : 'j'}
          </span>
        </div>
        {soldes.alert === 'danger' && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-[10px] text-red-600">
            ⚠ Le solde sera négatif après approbation
          </div>
        )}
        {soldes.alert === 'warning' && (
          <div className="mt-2 bg-orange-50 border border-orange-200 rounded p-2 text-[10px] text-orange-600">
            ⚠ Le solde sera épuisé après approbation
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Zone: Couverture ───

function ZoneCouverture({ coverage }: { coverage: DayCoverage[] }) {
  if (coverage.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[#1a2332] uppercase tracking-wide">
          Couverture bureau
        </h3>
        <div className="text-[11px] text-gray-400 italic">
          Aucune affectation bureau trouvée pour ce travailleur
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold text-[#1a2332] uppercase tracking-wide">
        Couverture bureau
      </h3>
      <div className="space-y-2">
        {coverage.map((day) => {
          const ratioColor = day.ratio > 0.5
            ? 'text-green-600'
            : day.ratio === 0.5
              ? 'text-orange-600'
              : 'text-red-600'
          const bgColor = day.alert ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'

          return (
            <div key={day.date} className={`rounded-lg border p-2.5 ${bgColor}`}>
              <div className="flex items-center justify-between text-[11px]">
                <div>
                  <span className="font-semibold text-[#1a2332]">{formatDateFr(day.date)}</span>
                  <span className="text-gray-400 ml-1.5">— {day.bureauNom}</span>
                </div>
                <span className={`font-bold ${ratioColor}`}>
                  {day.presentCount}/{day.totalCount} présents
                </span>
              </div>
              {day.alert && day.presentCount === 0 && (
                <div className="text-[10px] text-red-600 font-semibold mt-1">
                  ⚠ Bureau non couvert
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {day.workers.map((w) => (
                  <span
                    key={w.userId}
                    className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      w.status === 'present' ? 'bg-green-100 text-green-700' :
                      w.status === 'demandeur' ? 'bg-blue-100 text-blue-700' :
                      w.status === 'conge' ? 'bg-amber-100 text-amber-700' :
                      w.status === 'maladie' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-200 text-gray-600'
                    }`}
                    title={STATUS_LABELS[w.status]}
                  >
                    {STATUS_EMOJI[w.status]} {w.prenom} {w.nom}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Zone: Réaffectation ───

function ZoneReassignation({
  availability,
  reassignationsExistantes,
  congeId,
  onReassignationCreated,
}: {
  availability: DayAvailability[]
  reassignationsExistantes: CongeContext['reassignationsExistantes']
  congeId: string
  onReassignationCreated: () => void
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter to only show days with alert (availability is already filtered server-side)
  const daysWithOptions = availability.filter(d => d.availableWorkers.length > 0)
  const hasExisting = reassignationsExistantes.length > 0

  if (daysWithOptions.length === 0 && !hasExisting) {
    return null
  }

  async function handleReassign(travailleurId: string, bureauId: string, date: string) {
    const key = `${travailleurId}:${date}`
    setPending(key)
    setError(null)
    const result = await creerReassignation(congeId, travailleurId, bureauId, date)
    setPending(null)
    if (result.error) {
      setError(result.error)
    } else {
      onReassignationCreated()
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold text-[#1a2332] uppercase tracking-wide">
        Réaffectation
      </h3>

      {/* Existing reassignations */}
      {hasExisting && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 font-semibold">Réaffectations en cours :</span>
          {reassignationsExistantes.map((r) => {
            const profile = (r as Record<string, unknown>).profile as { prenom: string; nom: string } | null
            const bureau = (r as Record<string, unknown>).bureau as { nom: string } | null
            const statusStyle = r.statut === 'accepte'
              ? 'bg-green-100 text-green-700'
              : r.statut === 'refuse'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'

            return (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded p-2 text-[11px]">
                <div>
                  <span className="font-semibold">{profile?.prenom} {profile?.nom}</span>
                  <span className="text-gray-400 mx-1">→</span>
                  <span className="text-gray-600">{bureau?.nom}</span>
                  <span className="text-gray-400 ml-1">le {formatDateFr(r.date)}</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusStyle}`}>
                  {r.statut === 'en_attente' ? 'En attente' : r.statut === 'accepte' ? 'Accepté' : 'Refusé'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Available workers per day */}
      {daysWithOptions.map((day) => (
        <div key={day.date} className="bg-orange-50 border border-orange-200 rounded-lg p-2.5">
          <div className="text-[11px] font-semibold text-orange-700 mb-1.5">
            {formatDateFr(day.date)} — {day.bureauNom}
          </div>
          <div className="space-y-1">
            {day.availableWorkers.map((w) => {
              const key = `${w.userId}:${day.date}`
              const alreadyReassigned = reassignationsExistantes.some(
                r => r.travailleur_id === w.userId && r.date === day.date
              )

              return (
                <div key={w.userId} className="flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-medium">{w.prenom} {w.nom}</span>
                    <span className="text-[10px] text-gray-400 ml-1">({w.bureauActuel})</span>
                  </div>
                  {alreadyReassigned ? (
                    <span className="text-[9px] text-gray-400 italic">Déjà réaffecté</span>
                  ) : (
                    <button
                      onClick={() => handleReassign(w.userId, day.bureauId, day.date)}
                      disabled={pending === key}
                      className="text-[10px] bg-[#e53e3e] text-white px-2 py-0.5 rounded-full font-semibold hover:bg-[#c53030] disabled:opacity-50 transition-colors"
                    >
                      {pending === key ? '...' : 'Réaffecter'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-[10px] text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}

// ─── Main Drawer ───

export default function CongeApprovalDrawer({ conge, open, onClose, onDone }: Props) {
  const [context, setContext] = useState<CongeContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [contextError, setContextError] = useState<string | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load context when opened
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setContextError(null)
    getCongeContext(conge.id).then((result) => {
      if (result.error) {
        setContextError(result.error)
      } else if (result.data) {
        setContext(result.data)
      }
      setLoading(false)
    })
  }, [open, conge.id])

  async function handleViewCert() {
    if (!conge.piece_jointe_url) return
    const url = await getSignedUrlAdminAction(conge.piece_jointe_url)
    if (url) window.open(url, '_blank')
  }

  function handleDecision(decision: 'approuve' | 'refuse') {
    setError(null)
    startTransition(async () => {
      const result = await traiterCongeAction(conge.id, decision, commentaire || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        onDone()
        onClose()
      }
    })
  }

  function refreshContext() {
    getCongeContext(conge.id).then((result) => {
      if (result.data) setContext(result.data)
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <SheetTitle className="text-sm font-bold text-[#1a2332]">
            Traiter la demande de congé
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Zone 1: Request summary */}
          <ZoneResume conge={conge} onViewCert={handleViewCert} />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-[#e53e3e]" />
              <span className="ml-2 text-[11px] text-gray-400">Chargement du contexte...</span>
            </div>
          ) : contextError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[11px] text-red-600">
              {contextError}
            </div>
          ) : context ? (
            <>
              {/* Zone 2: Soldes */}
              <ZoneSoldes soldes={context.soldes} />

              {/* Zone 3: Coverage */}
              <ZoneCouverture coverage={context.coverage} />

              {/* Zone 4: Reassignment */}
              <ZoneReassignation
                availability={context.availability}
                reassignationsExistantes={context.reassignationsExistantes}
                congeId={conge.id}
                onReassignationCreated={refreshContext}
              />
            </>
          ) : null}
        </div>

        {/* Sticky footer: decision */}
        <div className="border-t border-gray-200 bg-white px-5 py-3 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Commentaire admin (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Motif de refus, remarque..."
              className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-[10px] text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => handleDecision('approuve')}
              disabled={isPending || loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[11px] h-8"
            >
              ✅ Approuver
            </Button>
            <Button
              onClick={() => handleDecision('refuse')}
              disabled={isPending || loading}
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-[11px] h-8"
            >
              ❌ Refuser
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
