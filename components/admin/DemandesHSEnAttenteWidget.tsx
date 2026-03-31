import Link from 'next/link'
import { DemandeHeuresSup, Profile } from '@/types/database'
import { formatDateFr } from '@/lib/utils/dates'
import { formatMinutes } from '@/lib/horaires/utils'

type DemandeHSWithProfile = DemandeHeuresSup & {
  profile: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

interface Props {
  demandes: DemandeHSWithProfile[]
}

export default function DemandesHSEnAttenteWidget({ demandes }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          ⏱ Heures sup. en attente
          {demandes.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {demandes.length}
            </span>
          )}
        </p>
        <Link
          href="/admin/heures-sup"
          className="text-[10px] text-[#e53e3e] font-semibold hover:underline"
        >
          Voir tout →
        </Link>
      </div>

      {demandes.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">Aucune demande en attente.</p>
      ) : (
        <div className="space-y-2">
          {demandes.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#1a2332] truncate">
                  {d.profile.prenom} {d.profile.nom}
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatDateFr(d.date)} — {formatMinutes(d.nb_minutes)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
