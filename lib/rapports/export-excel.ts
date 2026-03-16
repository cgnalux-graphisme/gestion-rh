import ExcelJS from 'exceljs'

type ExcelExportInput = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
  sheetName?: string
  // Feuille supplémentaire optionnelle (ex : soldes congés)
  extraSheet?: {
    name: string
    headers: string[]
    rows: string[][]
  }
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A2332' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 10,
}

function applySheet(sheet: ExcelJS.Worksheet, headers: string[], rows: string[][]) {
  // En-têtes
  const headerRow = sheet.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Données
  for (const row of rows) {
    sheet.addRow(row)
  }

  // Auto-dimensionner
  sheet.columns.forEach((col, i) => {
    let maxLen = headers[i]?.length ?? 10
    for (const row of rows) {
      const cellLen = (row[i] ?? '').length
      if (cellLen > maxLen) maxLen = cellLen
    }
    col.width = Math.min(maxLen + 2, 40)
  })
}

export async function generateExcel(input: ExcelExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Gestion RH — ACCG Namur-Luxembourg'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(input.sheetName ?? input.titre)
  applySheet(sheet, input.headers, input.rows)

  if (input.extraSheet) {
    const extra = workbook.addWorksheet(input.extraSheet.name)
    applySheet(extra, input.extraSheet.headers, input.extraSheet.rows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
