import Link from 'next/link'
import { Conge } from '@/types/database'
import { formatDateFr, labelTypeConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'

interface Props {
  congesEnAttente: Conge[]
}

export default function CongesWidget({ congesEnAttente }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Mes congés
          {congesEnAttente.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {congesEnAttente.length} en attente
            </span>
          )}
        </p>
        <Link
          href="/conges?nouveau=1"
          className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#e53e3e] hover:bg-[#c53030] px-3 py-1.5 rounded-lg transition-colors"
        >
          + Nouvelle demande
        </Link>
      </div>

      {congesEnAttente.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucune demande en cours.</p>
      ) : (
        <div className="space-y-2">
          {congesEnAttente.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1a2332]">
                  {labelTypeConge(c.type)}
                </div>
                <div className="text-[11px] text-gray-400">
                  {c.demi_journee
                    ? `${formatDateFr(c.date_debut)} (${labelDemiJournee(c.demi_journee)})`
                    : `${formatDateFr(c.date_debut)}${c.date_fin !== c.date_debut ? ` → ${formatDateFr(c.date_fin)}` : ''}`
                  }
                  {' '}({formatNbJours(c.nb_jours)}j)
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                En attente
              </span>
            </div>
          ))}
          {congesEnAttente.length > 3 && (
            <Link
              href="/conges"
              className="block text-center text-[10px] text-[#e53e3e] font-semibold hover:underline pt-1"
            >
              Voir les {congesEnAttente.length} demandes
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
