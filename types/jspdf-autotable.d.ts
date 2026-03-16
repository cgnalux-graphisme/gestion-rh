declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'
  export default function autoTable(doc: jsPDF, options: Record<string, unknown>): void
}
