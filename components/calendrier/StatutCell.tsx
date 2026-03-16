import type { StatutJour } from '@/types/calendrier'

const CONFIG: Record<StatutJour, { bg: string; text: string; letter: string; tooltip?: string }> = {
  present: { bg: 'bg-green-100', text: 'text-green-800', letter: 'P', tooltip: 'Présent' },
  absent: { bg: 'bg-red-100', text: 'text-red-800', letter: 'A', tooltip: 'Absent' },
  conge: { bg: 'bg-orange-100', text: 'text-orange-800', letter: 'C' },
  ferie: { bg: 'bg-blue-100', text: 'text-blue-800', letter: 'F' },
  weekend: { bg: 'bg-gray-100', text: 'text-gray-300', letter: '' },
  vide: { bg: 'bg-white', text: 'text-gray-200', letter: '', tooltip: 'Non renseigné' },
}

type Props = {
  statut: StatutJour
  label?: string
  size?: 'sm' | 'md'
}

export default function StatutCell({ statut, label, size = 'md' }: Props) {
  const cfg = CONFIG[statut]
  const tooltip = label ?? cfg.tooltip

  const sizeClass = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-xs'

  return (
    <div
      className={`${sizeClass} ${cfg.bg} ${cfg.text} font-medium rounded flex items-center justify-center flex-shrink-0`}
      title={tooltip}
    >
      {cfg.letter}
    </div>
  )
}
