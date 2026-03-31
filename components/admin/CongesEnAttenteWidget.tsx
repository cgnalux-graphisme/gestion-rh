import Link from 'next/link'
import { Conge, Profile } from '@/types/database'
import { formatDateFr, labelTypeConge, formatNbJours, labelDemiJournee } from '@/lib/utils/dates'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conges: CongeWithProfile[]
}

export default function CongesEnAttenteWidget({ conges }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          🌴 Congés en attente
          {conges.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {conges.length}
            </span>
          )}
        </p>
        <Link
          href="/admin/conges"
          className="text-xs text-[#e53e3e] font-semibold hover:underline"
        >
          Voir tout →
        </Link>
      </div>

      {conges.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucune demande en attente.</p>
      ) : (
        <div className="space-y-2">
          {conges.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1a2332] truncate">
                  {c.profile.prenom} {c.profile.nom}
                </div>
                <div className="text-[11px] text-gray-400">
                  {labelTypeConge(c.type)} — {c.demi_journee
                    ? `${formatDateFr(c.date_debut)} (${labelDemiJournee(c.demi_journee)})`
                    : `${formatDateFr(c.date_debut)} → ${formatDateFr(c.date_fin)}`
                  } ({formatNbJours(c.nb_jours)}j)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
