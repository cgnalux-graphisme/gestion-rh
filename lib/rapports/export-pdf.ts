import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type PdfExportInput = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
  // Page supplémentaire optionnelle
  extraPage?: {
    titre: string
    headers: string[]
    rows: string[][]
  }
}

export function generatePdf(input: PdfExportInput): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // En-tête
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Centrale Générale FGTB Namur-Luxembourg', 14, 10)

  doc.setFontSize(14)
  doc.setTextColor(26, 35, 50) // #1a2332
  doc.text(input.titre, 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(input.periode, 14, 27)

  // Tableau principal
  autoTable(doc, {
    startY: 32,
    head: [input.headers],
    body: input.rows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 35, 50], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  })

  // Page supplémentaire
  if (input.extraPage) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(26, 35, 50)
    doc.text(input.extraPage.titre, 14, 15)

    autoTable(doc, {
      startY: 22,
      head: [input.extraPage.headers],
      body: input.extraPage.rows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 35, 50], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    })
  }

  // Pied de page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    const now = new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Généré le ${now}`, 14, doc.internal.pageSize.height - 7)
    doc.text(`Page ${i}/${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 7)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
