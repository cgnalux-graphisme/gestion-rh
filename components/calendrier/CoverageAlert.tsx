import type { CoverageStatus } from '@/types/calendrier-bureau'

export default function CoverageAlert({ coverage }: { coverage: CoverageStatus[] }) {
  const alertes = coverage.filter(c => c.alerte)
  if (alertes.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5">
      {alertes.map(a => (
        <span
          key={a.service_id}
          className={`text-[9px] font-semibold px-1 rounded ${
            a.presents === 0
              ? 'bg-red-100 text-red-700'
              : 'bg-orange-100 text-orange-700'
          }`}
          title={`${a.service_nom} : ${a.presents}/${a.seuil} présent(s)`}
        >
          ⚠ {a.presents}/{a.seuil}
        </span>
      ))}
    </div>
  )
}
