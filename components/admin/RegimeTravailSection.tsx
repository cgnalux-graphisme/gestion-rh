'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  RegimeTravail,
  RegimeType,
  RegimeFraction,
} from '@/types/database'
import {
  REGIME_TYPE_LABELS,
  REGIME_FRACTION_LABELS,
  FRACTIONS_PAR_REGIME,
  POURCENTAGE_PAR_FRACTION,
  JOURS_PAR_FRACTION,
  JOURS_SEMAINE_LABELS,
} from '@/types/database'
import {
  createRegimeAction,
  updateRegimeAction,
  deleteRegimeAction,
} from '@/lib/regime/actions'
import { formatLocalDate } from '@/lib/utils/dates'

/* ─── Helpers ─── */
function formatDate(d: string | null): string {
  if (!d) return 'En cours'
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function needsJourOff(fraction: RegimeFraction): boolean {
  return fraction === 'quatre_cinquieme' || fraction === 'neuf_dixieme' || fraction === 'un_dixieme' || fraction === 'trois_quart'
}

function needsHeuresPerso(fraction: RegimeFraction): boolean {
  return fraction === 'personnalise'
}

/**
 * Durées légales maximales en mois par type de régime + fraction (droit belge).
 * null = pas de durée légale fixe (jusqu'à la pension, décision médicale, contrat...).
 * Sources : ONEM, SPF Emploi.
 */
type DureeKey = `${RegimeType}:${RegimeFraction}`
const DUREES_LEGALES_MOIS: Partial<Record<DureeKey, { mois: number; info: string }>> = {
  // Congé parental
  'conge_parental:suspension_complete': { mois: 4, info: '4 mois max (suspension complète)' },
  'conge_parental:mi_temps': { mois: 8, info: '8 mois max (mi-temps)' },
  'conge_parental:quatre_cinquieme': { mois: 20, info: '20 mois max (4/5)' },
  'conge_parental:neuf_dixieme': { mois: 40, info: '40 mois max (1/10 réduction)' },
  'conge_parental:un_dixieme': { mois: 40, info: '40 mois max (1/10 réduction)' },
  // Crédit-temps avec motif (soins enfant <8 ans = 51 mois max)
  'credit_temps_motif:suspension_complete': { mois: 51, info: '51 mois max (soins enfant) ou 36 mois (formation)' },
  'credit_temps_motif:mi_temps': { mois: 51, info: '51 mois max (soins enfant) ou 36 mois (formation)' },
  'credit_temps_motif:quatre_cinquieme': { mois: 51, info: '51 mois max (soins enfant) ou 36 mois (formation)' },
  // Congé assistance médicale
  'conge_assistance_medicale:suspension_complete': { mois: 12, info: '12 mois max par patient' },
  'conge_assistance_medicale:mi_temps': { mois: 24, info: '24 mois max par patient' },
  'conge_assistance_medicale:quatre_cinquieme': { mois: 24, info: '24 mois max par patient' },
  'conge_assistance_medicale:neuf_dixieme': { mois: 24, info: '24 mois max par patient' },
  // Congé soins palliatifs (1 mois + 2 prolongations d'1 mois)
  'conge_soins_palliatifs:suspension_complete': { mois: 3, info: '3 mois max (1 + 1 + 1)' },
  'conge_soins_palliatifs:mi_temps': { mois: 3, info: '3 mois max (1 + 1 + 1)' },
  'conge_soins_palliatifs:quatre_cinquieme': { mois: 3, info: '3 mois max (1 + 1 + 1)' },
  'conge_soins_palliatifs:neuf_dixieme': { mois: 3, info: '3 mois max (1 + 1 + 1)' },
  // Congé aidant proche (max carrière)
  'conge_aidant_proche:suspension_complete': { mois: 6, info: '6 mois max sur la carrière' },
  'conge_aidant_proche:mi_temps': { mois: 12, info: '12 mois max sur la carrière' },
  'conge_aidant_proche:quatre_cinquieme': { mois: 12, info: '12 mois max sur la carrière' },
  'conge_aidant_proche:neuf_dixieme': { mois: 12, info: '12 mois max sur la carrière' },
}

function getDateFinTheorique(typeRegime: RegimeType, fraction: RegimeFraction, dateDebut: string): { dateFin: string; info: string } | null {
  const key: DureeKey = `${typeRegime}:${fraction}`
  const duree = DUREES_LEGALES_MOIS[key]
  if (!duree || !dateDebut) return null

  const d = new Date(dateDebut + 'T12:00:00')
  d.setMonth(d.getMonth() + duree.mois)
  d.setDate(d.getDate() - 1) // dernier jour inclus
  const dateFin = formatLocalDate(d)
  return { dateFin, info: duree.info }
}

/* ─── Form state ─── */
type FormState = {
  typeRegime: RegimeType
  fraction: RegimeFraction
  pourcentage: number
  joursParSemaine: number
  jourOff: number | null
  heuresParJour: number | null
  dateDebut: string
  dateFin: string
  commentaire: string
}

const DEFAULT_FORM: FormState = {
  typeRegime: 'temps_plein',
  fraction: 'temps_plein',
  pourcentage: 100,
  joursParSemaine: 5,
  jourOff: null,
  heuresParJour: null,
  dateDebut: formatLocalDate(new Date()),
  dateFin: '',
  commentaire: '',
}

function regimeToForm(r: RegimeTravail): FormState {
  return {
    typeRegime: r.type_regime,
    fraction: r.fraction,
    pourcentage: r.pourcentage_travail,
    joursParSemaine: r.jours_par_semaine,
    jourOff: r.jour_off,
    heuresParJour: r.heures_par_jour,
    dateDebut: r.date_debut,
    dateFin: r.date_fin ?? '',
    commentaire: r.commentaire ?? '',
  }
}

/* ─── Main component ─── */
interface Props {
  userId: string
  regimes: RegimeTravail[]
}

export default function RegimeTravailSection({ userId, regimes }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const regimeActif = regimes.find(
    (r) => !r.date_fin || r.date_fin >= formatLocalDate(new Date())
  )

  function openNew() {
    setForm(DEFAULT_FORM)
    setEditId(null)
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function openEdit(r: RegimeTravail) {
    setForm(regimeToForm(r))
    setEditId(r.id)
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function handleTypeChange(newType: RegimeType) {
    const fractions = FRACTIONS_PAR_REGIME[newType]
    const newFraction = fractions[0]
    setForm({
      ...form,
      typeRegime: newType,
      fraction: newFraction,
      pourcentage: POURCENTAGE_PAR_FRACTION[newFraction],
      joursParSemaine: JOURS_PAR_FRACTION[newFraction],
      jourOff: needsJourOff(newFraction) ? (form.jourOff ?? 3) : null,
      heuresParJour: needsHeuresPerso(newFraction) ? (form.heuresParJour ?? 3.65) : null,
    })
  }

  function handleFractionChange(newFraction: RegimeFraction) {
    setForm({
      ...form,
      fraction: newFraction,
      pourcentage: newFraction === 'personnalise' ? form.pourcentage : POURCENTAGE_PAR_FRACTION[newFraction],
      joursParSemaine: newFraction === 'personnalise' ? form.joursParSemaine : JOURS_PAR_FRACTION[newFraction],
      jourOff: needsJourOff(newFraction) ? (form.jourOff ?? 3) : null,
      heuresParJour: needsHeuresPerso(newFraction) ? (form.heuresParJour ?? 3.65) : null,
    })
  }

  function handleSave() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      let res: { error?: string }
      if (editId) {
        res = await updateRegimeAction(
          editId,
          userId,
          form.typeRegime,
          form.fraction,
          form.pourcentage,
          form.joursParSemaine,
          form.dateDebut,
          form.dateFin || null,
          form.jourOff,
          form.heuresParJour,
          form.commentaire || null
        )
      } else {
        res = await createRegimeAction(
          userId,
          form.typeRegime,
          form.fraction,
          form.pourcentage,
          form.joursParSemaine,
          form.dateDebut,
          form.dateFin || null,
          form.jourOff,
          form.heuresParJour,
          form.commentaire || null
        )
      }
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(editId ? 'Régime mis à jour.' : 'Nouveau régime enregistré.')
        setShowForm(false)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteRegimeAction(id, userId)
      if (res.error) setError(res.error)
      setConfirmDelete(null)
    })
  }

  const availableFractions = FRACTIONS_PAR_REGIME[form.typeRegime] ?? []

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">
          📋 Régime de travail
        </span>
        <Button
          size="sm"
          className="text-[10px] h-7 bg-[#1a2332] hover:bg-[#2d3a4d] text-white"
          onClick={openNew}
        >
          + Nouveau régime
        </Button>
      </div>

      {/* Régime actif */}
      <div className="px-4 py-3">
        {regimeActif ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-900">
                {REGIME_TYPE_LABELS[regimeActif.type_regime]}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">
                {REGIME_FRACTION_LABELS[regimeActif.fraction]}
                {' — '}
                {regimeActif.pourcentage_travail}% &middot; {regimeActif.jours_par_semaine}j/sem
                {regimeActif.jour_off && (
                  <> &middot; Jour off : {JOURS_SEMAINE_LABELS[regimeActif.jour_off]}</>
                )}
                {regimeActif.heures_par_jour && (
                  <> &middot; {regimeActif.heures_par_jour}h/jour</>
                )}
              </div>
              <div className="text-[9px] text-blue-500 mt-0.5">
                Depuis le {formatDate(regimeActif.date_debut)}
                {regimeActif.date_fin ? ` jusqu'au ${formatDate(regimeActif.date_fin)}` : ' (en cours)'}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7"
              onClick={() => openEdit(regimeActif)}
            >
              Modifier
            </Button>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-gray-400 italic">
            Aucun régime actif &mdash; temps plein par défaut
          </div>
        )}

        {/* Historique */}
        {regimes.length > (regimeActif ? 1 : 0) && (
          <div className="mt-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Historique des régimes
            </p>
            <div className="space-y-1">
              {regimes
                .filter((r) => r.id !== regimeActif?.id)
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-[10px]"
                  >
                    <div>
                      <span className="font-semibold text-gray-700">
                        {REGIME_TYPE_LABELS[r.type_regime]}
                      </span>
                      <span className="text-gray-400 ml-2">
                        {REGIME_FRACTION_LABELS[r.fraction]} &middot; {r.pourcentage_travail}%
                      </span>
                      <span className="text-gray-400 ml-2">
                        {formatDate(r.date_debut)} → {formatDate(r.date_fin)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="text-[9px] text-blue-600 hover:underline"
                        onClick={() => openEdit(r)}
                      >
                        Modifier
                      </button>
                      <button
                        className="text-[9px] text-red-500 hover:underline"
                        onClick={() => setConfirmDelete(r.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md mt-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md mt-2">{success}</p>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <Dialog open={true} onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-gray-600">Supprimer définitivement ce régime de l&apos;historique ?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmDelete(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-red-500 text-white text-xs hover:bg-red-600"
                onClick={() => handleDelete(confirmDelete)}
                disabled={isPending}
              >
                {isPending ? '...' : 'Supprimer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form modal */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editId ? 'Modifier le régime' : 'Nouveau régime de travail'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Type de régime */}
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Type de régime
              </Label>
              <Select
                value={form.typeRegime}
                onValueChange={(v) => handleTypeChange(v as RegimeType)}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REGIME_TYPE_LABELS) as RegimeType[]).map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {REGIME_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fraction */}
            {availableFractions.length > 1 && (
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Fraction de travail
                </Label>
                <Select
                  value={form.fraction}
                  onValueChange={(v) => handleFractionChange(v as RegimeFraction)}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFractions.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {REGIME_FRACTION_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pourcentage (editable) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  % travail effectif
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.pourcentage}
                  onChange={(e) => setForm({ ...form, pourcentage: Number(e.target.value) })}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Jours / semaine
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={form.joursParSemaine}
                  onChange={(e) => setForm({ ...form, joursParSemaine: Number(e.target.value) })}
                  className="text-xs h-8"
                />
              </div>
            </div>

            {/* Jour off (pour 4/5, 9/10) */}
            {needsJourOff(form.fraction) && (
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Jour de repos (off)
                </Label>
                <Select
                  value={String(form.jourOff ?? 3)}
                  onValueChange={(v) => setForm({ ...form, jourOff: Number(v) })}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((j) => (
                      <SelectItem key={j} value={String(j)} className="text-xs">
                        {JOURS_SEMAINE_LABELS[j]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Heures par jour (pour mi-temps médical personnalisé) */}
            {needsHeuresPerso(form.fraction) && (
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Heures prestées par jour
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  step={0.25}
                  value={form.heuresParJour ?? ''}
                  onChange={(e) => setForm({ ...form, heuresParJour: e.target.value ? Number(e.target.value) : null })}
                  className="text-xs h-8"
                  placeholder="Ex: 3.5"
                />
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Date de début
                </Label>
                <Input
                  type="date"
                  value={form.dateDebut}
                  onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Date de fin
                </Label>
                <Input
                  type="date"
                  value={form.dateFin}
                  onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
                  className="text-xs h-8"
                  placeholder="Laisser vide si en cours"
                />
                <p className="text-[8px] text-gray-400">Vide = en cours</p>
              </div>
            </div>

            {/* Commentaire */}
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Commentaire
              </Label>
              <textarea
                value={form.commentaire}
                onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs resize-none h-14 focus:outline-none focus:ring-1 focus:ring-[#1a2332]"
                placeholder="Notes, justification..."
              />
            </div>

            {/* Date fin théorique (info légale) */}
            {(() => {
              const theo = getDateFinTheorique(form.typeRegime, form.fraction, form.dateDebut)
              if (!theo) return null
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-800">
                  <p className="font-bold mb-0.5">Date de fin théorique (droit belge)</p>
                  <p>
                    {new Date(theo.dateFin + 'T12:00:00').toLocaleDateString('fr-BE', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  <p className="text-blue-600 mt-0.5">{theo.info}</p>
                  {!form.dateFin && (
                    <button
                      type="button"
                      className="mt-1 text-[9px] font-semibold text-blue-700 underline hover:text-blue-900"
                      onClick={() => setForm({ ...form, dateFin: theo.dateFin })}
                    >
                      Appliquer cette date de fin
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Résumé visuel */}
            <div className="bg-gray-50 rounded-lg p-3 text-[10px] text-gray-600">
              <p className="font-bold text-gray-700 mb-1">Résumé :</p>
              <p>
                {REGIME_TYPE_LABELS[form.typeRegime]} &mdash;{' '}
                {form.pourcentage}% de prestations &mdash;{' '}
                {form.joursParSemaine} jours/semaine
              </p>
              {form.jourOff && (
                <p>Jour off : {JOURS_SEMAINE_LABELS[form.jourOff]}</p>
              )}
              {form.heuresParJour && (
                <p>Heures/jour : {form.heuresParJour}h</p>
              )}
              <p>
                Du {form.dateDebut || '?'}{' '}
                {form.dateFin ? `au ${form.dateFin}` : "(pas de date de fin — en cours)"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
                onClick={handleSave}
                disabled={isPending || !form.dateDebut}
              >
                {isPending ? '...' : editId ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
