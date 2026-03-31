'use client'

import { useState, useMemo } from 'react'
import { MouvementPotHeures } from '@/lib/heures-sup/actions'

const TYPE_COLORS: Record<MouvementPotHeures['type'], string> = {
  hs_approuvee: '#22c55e',
  recup_prise: '#f59e0b',
  deduction_correction: '#ef4444',
  correction_admin: '#3b82f6',
  solde_initial: '#94a3b8',
}

function formatMinutesLabel(mins: number): string {
  const sign = mins < 0 ? '-' : ''
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (abs === 0) return '0h'
  if (h === 0) return `${sign}${m}min`
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h${String(m).padStart(2, '0')}`
}

interface Props {
  mouvements: MouvementPotHeures[]
}

export default function PotHeuresChart({ mouvements }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const { points, minY, maxY, width, height, padX, padY } = useMemo(() => {
    if (mouvements.length === 0) return { points: [], minY: 0, maxY: 0, width: 600, height: 200, padX: 50, padY: 30 }

    const w = 600
    const h = 200
    const px = 50
    const py = 30

    const soldes = mouvements.map((m) => m.solde_apres)
    const min = Math.min(0, ...soldes)
    const max = Math.max(0, ...soldes)
    const range = max - min || 1

    const pts = mouvements.map((m, i) => ({
      x: px + (i / Math.max(1, mouvements.length - 1)) * (w - 2 * px),
      y: py + (1 - (m.solde_apres - min) / range) * (h - 2 * py),
      mouvement: m,
    }))

    return { points: pts, minY: min, maxY: max, width: w, height: h, padX: px, padY: py }
  }, [mouvements])

  if (mouvements.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] text-gray-400 italic">
        Aucun mouvement cette année
      </div>
    )
  }

  // Y-axis labels
  const range = maxY - minY || 1
  const yLabels = [maxY, Math.round((maxY + minY) / 2), minY]
  const zeroY = padY + (1 - (0 - minY) / range) * (height - 2 * padY)

  // Path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="hidden sm:block">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {yLabels.map((val, i) => {
          const y = padY + (1 - (val - minY) / range) * (height - 2 * padY)
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padX - 6} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="9">
                {formatMinutesLabel(val)}
              </text>
            </g>
          )
        })}

        {/* Zero line */}
        {minY < 0 && (
          <line
            x1={padX} y1={zeroY} x2={width - padX} y2={zeroY}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2"
          />
        )}

        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`}
          fill="url(#areaGradient)"
          opacity="0.15"
        />
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 3}
            fill={TYPE_COLORS[p.mouvement.type]}
            stroke="white"
            strokeWidth="1.5"
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* X-axis date labels (first, middle, last) */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((idx) => (
            <text
              key={idx}
              x={points[idx].x}
              y={height - 5}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="8"
            >
              {points[idx].mouvement.date.slice(5).replace('-', '/')}
            </text>
          ))}

        {/* Tooltip */}
        {hoveredIdx !== null && (
          <g>
            <rect
              x={Math.min(points[hoveredIdx].x - 80, width - 170)}
              y={Math.max(5, points[hoveredIdx].y - 52)}
              width="160"
              height="44"
              rx="6"
              fill="#1a2332"
              opacity="0.95"
            />
            <text
              x={Math.min(points[hoveredIdx].x - 80, width - 170) + 8}
              y={Math.max(5, points[hoveredIdx].y - 52) + 16}
              className="fill-white"
              fontSize="9"
              fontWeight="600"
            >
              {points[hoveredIdx].mouvement.date.split('-').reverse().join('/')}
              {' — '}
              {points[hoveredIdx].mouvement.delta_minutes >= 0 ? '+' : ''}
              {formatMinutesLabel(points[hoveredIdx].mouvement.delta_minutes)}
            </text>
            <text
              x={Math.min(points[hoveredIdx].x - 80, width - 170) + 8}
              y={Math.max(5, points[hoveredIdx].y - 52) + 30}
              className="fill-gray-300"
              fontSize="8"
            >
              {points[hoveredIdx].mouvement.description.slice(0, 40)}
            </text>
            <text
              x={Math.min(points[hoveredIdx].x - 80, width - 170) + 152}
              y={Math.max(5, points[hoveredIdx].y - 52) + 16}
              textAnchor="end"
              className="fill-emerald-400"
              fontSize="9"
              fontWeight="700"
            >
              {formatMinutesLabel(points[hoveredIdx].mouvement.solde_apres)}
            </text>
          </g>
        )}
      </svg>

      {/* Mobile fallback message */}
      <div className="sm:hidden text-center py-4 text-[10px] text-gray-400 italic">
        Graphique visible sur écran plus large
      </div>
    </div>
  )
}
