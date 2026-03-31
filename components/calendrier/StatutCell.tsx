import type { StatutJour, IndicateursJour, IndicateurPointage } from '@/types/calendrier'

const CONFIG: Record<StatutJour, { bg: string; text: string; letter: string; tooltip?: string }> = {
  present: { bg: 'bg-emerald-300', text: 'text-emerald-900', letter: 'P', tooltip: 'Présent' },
  en_cours: { bg: 'bg-emerald-100', text: 'text-emerald-700', letter: 'P', tooltip: 'En cours (arrivée pointée)' },
  absent: { bg: 'bg-rose-300', text: 'text-rose-900', letter: 'A', tooltip: 'Absent' },
  conge: { bg: 'bg-amber-300', text: 'text-amber-900', letter: 'C' },
  maladie: { bg: 'bg-sky-300', text: 'text-sky-900', letter: 'M', tooltip: 'Maladie' },
  ferie: { bg: 'bg-gray-700', text: 'text-white', letter: 'F' },
  greve: { bg: 'bg-purple-300', text: 'text-purple-900', letter: 'G', tooltip: 'Grève' },
  weekend: { bg: 'bg-gray-200', text: 'text-gray-400', letter: '' },
  vide: { bg: 'bg-white', text: 'text-gray-200', letter: '', tooltip: 'Non renseigné' },
}

const INDICATEUR_COLORS: Record<IndicateurPointage, string> = {
  ok: 'bg-green-500',
  anomalie: 'bg-amber-500',
  manquant: 'bg-red-500',
  corrige: 'bg-blue-400',
}

const INDICATEUR_TOOLTIPS: Record<IndicateurPointage, string> = {
  ok: 'OK',
  anomalie: 'À vérifier',
  manquant: 'Non pointé',
  corrige: 'Corrigé',
}

const CHAMP_LABELS: Record<string, string> = {
  arrivee: 'Arrivée',
  midi_out: 'Midi ➜',
  midi_in: '➜ Midi',
  depart: 'Départ',
}

type Props = {
  statut: StatutJour
  label?: string
  size?: 'sm' | 'md'
  indicateurs?: IndicateursJour
}

function Barrettes({ indicateurs }: { indicateurs: IndicateursJour }) {
  const champs = ['arrivee', 'midi_out', 'midi_in', 'depart'] as const
  return (
    <div className="flex gap-[1px] justify-center mb-0.5">
      {champs.map((champ) => {
        const ind = indicateurs[champ]
        return (
          <span
            key={champ}
            className={`w-[13px] h-[5px] rounded-[2px] ${INDICATEUR_COLORS[ind]}`}
            title={`${CHAMP_LABELS[champ]} : ${INDICATEUR_TOOLTIPS[ind]}`}
          />
        )
      })}
    </div>
  )
}

export default function StatutCell({ statut, label, size = 'md', indicateurs }: Props) {
  const cfg = CONFIG[statut]
  const tooltip = label ?? cfg.tooltip

  const sizeClass = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-xs'

  return (
    <div className="flex flex-col items-center">
      {indicateurs && <Barrettes indicateurs={indicateurs} />}
      <div
        className={`${sizeClass} ${cfg.bg} ${cfg.text} font-medium rounded flex items-center justify-center flex-shrink-0`}
        title={tooltip}
      >
        {cfg.letter}
      </div>
    </div>
  )
}
