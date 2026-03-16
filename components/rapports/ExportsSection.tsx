'use client'

import { useState } from 'react'
import type { ExportParams, PeriodeType } from '@/types/rapports'
import { labelPeriode } from '@/lib/rapports/periodes'
import {
  exportPointagesExcel, exportPointagesPdf,
  exportTravailleursExcel, exportTravailleursPdf,
  exportCongesExcel, exportCongesPdf,
  exportCalendrierExcel, exportCalendrierPdf,
  exportPotHeuresExcel, exportPotHeuresPdf,
} from '@/lib/rapports/exports'

type ExportDef = {
  key: string
  titre: string
  description: string
  icon: string
  excelAction: (params: ExportParams) => Promise<string>
  pdfAction: (params: ExportParams) => Promise<string>
  filePrefix: string
}

const EXPORTS: ExportDef[] = [
  {
    key: 'pointages', titre: 'Pointages mensuels', description: 'Grille récap (travailleurs × jours, statuts)',
    icon: '⏱', excelAction: exportPointagesExcel, pdfAction: exportPointagesPdf, filePrefix: 'pointages',
  },
  {
    key: 'travailleurs', titre: 'Liste travailleurs', description: 'Tableau complet des travailleurs actifs',
    icon: '👥', excelAction: exportTravailleursExcel, pdfAction: exportTravailleursPdf, filePrefix: 'travailleurs',
  },
  {
    key: 'conges', titre: 'Congés', description: 'Demandes avec statuts + soldes par travailleur',
    icon: '🌴', excelAction: exportCongesExcel, pdfAction: exportCongesPdf, filePrefix: 'conges',
  },
  {
    key: 'calendrier', titre: 'Calendrier présence', description: 'Grille mois (travailleurs × jours)',
    icon: '📅', excelAction: exportCalendrierExcel, pdfAction: exportCalendrierPdf, filePrefix: 'calendrier',
  },
  {
    key: 'pot-heures', titre: "Pot d'heures", description: 'Soldes par travailleur et service',
    icon: '⚡', excelAction: exportPotHeuresExcel, pdfAction: exportPotHeuresPdf, filePrefix: 'pot-heures',
  },
]

function downloadBase64(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportsSection({
  periodeType,
  periodeDate,
  serviceId,
  bureauId,
}: {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const params: ExportParams = { periodeType, periodeDate, serviceId, bureauId }

  async function handleExport(def: ExportDef, format: 'excel' | 'pdf') {
    const key = `${def.key}-${format}`
    setLoading(key)
    try {
      const action = format === 'excel' ? def.excelAction : def.pdfAction
      const base64 = await action(params)
      const ext = format === 'excel' ? 'xlsx' : 'pdf'
      const mime = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'
      // Nom de fichier lisible : ex "pointages_mars-2026.xlsx"
      const periodLabel = labelPeriode(periodeType, periodeDate).toLowerCase().replace(/\s+/g, '-')
      downloadBase64(base64, `${def.filePrefix}_${periodLabel}.${ext}`, mime)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setLoading(null)
    }
  }

  const btnBase = 'px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Exports</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {EXPORTS.map((def) => (
          <div key={def.key} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{def.icon}</span>
              <h3 className="text-sm font-semibold text-gray-800">{def.titre}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">{def.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport(def, 'excel')}
                disabled={loading !== null}
                className={`${btnBase} border-green-200 text-green-700 hover:bg-green-50`}
              >
                {loading === `${def.key}-excel` ? '⏳' : '📥'} Excel
              </button>
              <button
                onClick={() => handleExport(def, 'pdf')}
                disabled={loading !== null}
                className={`${btnBase} border-red-200 text-red-700 hover:bg-red-50`}
              >
                {loading === `${def.key}-pdf` ? '⏳' : '📥'} PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
