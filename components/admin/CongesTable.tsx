'use client'

import { useState } from 'react'
import { Conge, Profile } from '@/types/database'
import { formatDateFr, labelTypeConge, labelStatutConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'
import CongeApprovalDrawer from '@/components/admin/CongeApprovalDrawer'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

interface Props {
  initialConges: CongeWithProfile[]
}

export default function CongesTable({ initialConges }: Props) {
  const [conges, setConges] = useState(initialConges)
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterMois, setFilterMois] = useState<string>('')
  const [selectedConge, setSelectedConge] = useState<CongeWithProfile | null>(null)

  function reloadPage() {
    // Server revalidation via revalidatePath dans l'action — on reload la page
    window.location.reload()
  }

  const filtered = conges.filter((c) => {
    if (filterStatut !== 'tous' && c.statut !== filterStatut) return false
    if (filterMois && !c.date_debut.startsWith(filterMois)) return false
    return true
  })

  // Options de mois (de toutes les demandes)
  const moisOptions = Array.from(new Set(conges.map((c) => c.date_debut.slice(0, 7)))).sort().reverse()

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex gap-3 items-center flex-wrap">
        <div>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#1a2332]"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="approuve">Approuvés</option>
            <option value="refuse">Refusés</option>
          </select>
        </div>
        {moisOptions.length > 0 && (
          <div>
            <select
              value={filterMois}
              onChange={(e) => setFilterMois(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#1a2332]"
            >
              <option value="">Tous les mois</option>
              {moisOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <span className="text-[10px] text-gray-400">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs italic">Aucune demande</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#1a2332] text-white">
                <th className="text-left px-3 py-2 font-semibold">Travailleur</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Période</th>
                <th className="text-center px-3 py-2 font-semibold">Jours</th>
                <th className="text-center px-3 py-2 font-semibold">Statut</th>
                <th className="text-center px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => c.statut === 'en_attente' && setSelectedConge(c)}
                >
                  <td className="px-3 py-2 font-semibold text-[#1a2332]">
                    {c.profile.prenom} {c.profile.nom}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{labelTypeConge(c.type)}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {c.demi_journee
                      ? <>{formatDateFr(c.date_debut)} ({labelDemiJournee(c.demi_journee)})</>
                      : <>{formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}</>
                    }
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-[#1a2332]">{formatNbJours(c.nb_jours)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                      {labelStatutConge(c.statut)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.statut === 'en_attente' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedConge(c) }}
                        className="text-[10px] text-[#e53e3e] font-semibold hover:underline"
                      >
                        Traiter
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer approbation enrichi */}
      {selectedConge && (
        <CongeApprovalDrawer
          conge={selectedConge}
          open={true}
          onClose={() => setSelectedConge(null)}
          onDone={reloadPage}
        />
      )}
    </div>
  )
}
