import type { StatutSimple } from '@/types/calendrier-bureau'

type Permanent = {
  id: string
  prenom: string
  nom: string
  statut_aujourdhui: StatutSimple
}

const STATUT_LABEL: Record<StatutSimple, string> = {
  P: 'Présent',
  C: 'Congé',
  M: 'Maladie',
  F: 'Férié',
  '-': 'Weekend',
  '': 'Inconnu',
}

const STATUT_COLOR: Record<StatutSimple, string> = {
  P: 'bg-green-100 text-green-800',
  C: 'bg-blue-100 text-blue-800',
  M: 'bg-orange-100 text-orange-800',
  F: 'bg-purple-100 text-purple-800',
  '-': 'bg-gray-100 text-gray-500',
  '': 'bg-gray-50 text-gray-400',
}

export default function PermanentsSection({ permanents }: { permanents: Permanent[] }) {
  if (permanents.length === 0) return null

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-xs font-bold text-[#1a2332] mb-3">Permanents syndicaux</h3>
      <div className="flex flex-wrap gap-2">
        {permanents.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
          >
            <span className="text-xs font-medium text-gray-700">
              {p.prenom} {p.nom}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUT_COLOR[p.statut_aujourdhui]}`}>
              {STATUT_LABEL[p.statut_aujourdhui]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
