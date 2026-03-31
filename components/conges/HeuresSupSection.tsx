'use client'

import { useState, useEffect } from 'react'
import { DemandeHeuresSup } from '@/types/database'
import { MouvementPotHeures, getMesDemandesHSAction, getMouvementsPotHeuresAction } from '@/lib/heures-sup/actions'
import { formatDateFr } from '@/lib/utils/dates'
import { formatMinutes } from '@/lib/horaires/utils'
import PotHeuresChart from './PotHeuresChart'
import JournalMouvements from './JournalMouvements'

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvée',
  refuse: 'Refusée',
}

interface Props {
  initialAnnee?: number
}

export default function HeuresSupSection({ initialAnnee }: Props) {
  const currentYear = new Date().getFullYear()
  const [annee, setAnnee] = useState(initialAnnee ?? currentYear)
  const [demandes, setDemandes] = useState<DemandeHeuresSup[]>([])
  const [mouvements, setMouvements] = useState<MouvementPotHeures[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getMesDemandesHSAction(), getMouvementsPotHeuresAction(annee)]).then(
      ([d, m]) => {
        setDemandes(d)
        setMouvements(m)
        setLoading(false)
      }
    )
  }, [annee])

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const demandesAnnee = demandes.filter((d) => d.date.startsWith(String(annee)))

  if (loading) {
    return <div className="text-center py-6 text-[11px] text-gray-400">Chargement...</div>
  }

  return (
    <div className="space-y-5">
      {/* Filtre année */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500">
          {demandesAnnee.length} demande{demandesAnnee.length !== 1 ? 's' : ''} HS en {annee}
        </span>
        <select
          value={annee}
          onChange={(e) => setAnnee(parseInt(e.target.value))}
          className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Demandes HS */}
      {demandesAnnee.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Demandes d&apos;heures supplémentaires
          </h4>
          <div className="divide-y divide-gray-50 rounded-lg border border-gray-100 overflow-hidden">
            {demandesAnnee.map((d) => (
              <div key={d.id} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-white">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[#1a2332]">
                      {formatMinutes(d.nb_minutes)}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      le {formatDateFr(d.date)}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[d.statut]}`}>
                      {STATUT_LABEL[d.statut]}
                    </span>
                  </div>
                  {d.commentaire_travailleur && (
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {d.commentaire_travailleur}
                    </div>
                  )}
                  {d.commentaire_admin && (
                    <div className="text-[10px] text-gray-500 mt-0.5 italic">
                      Admin : {d.commentaire_admin}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphique */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Évolution du pot d&apos;heures
        </h4>
        <PotHeuresChart mouvements={mouvements} />
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3">
        {[
          { color: 'bg-emerald-400', label: 'HS approuvées' },
          { color: 'bg-amber-400', label: 'Récup prises' },
          { color: 'bg-red-400', label: 'Déductions' },
          { color: 'bg-blue-400', label: 'Corrections admin' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-[10px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Journal des mouvements */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Journal des mouvements
        </h4>
        <JournalMouvements mouvements={mouvements} />
      </div>
    </div>
  )
}
