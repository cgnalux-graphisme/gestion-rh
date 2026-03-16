'use server'

import type { ExportParams } from '@/types/rapports'
import { collectPointages, collectTravailleurs, collectConges, collectCalendrier, collectPotHeures } from './export-data'
import { generateExcel } from './export-excel'
import { generatePdf } from './export-pdf'

// --- Pointages ---
export async function exportPointagesExcel(params: ExportParams): Promise<string> {
  const data = await collectPointages(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportPointagesPdf(params: ExportParams): Promise<string> {
  const data = await collectPointages(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Travailleurs ---
export async function exportTravailleursExcel(params: ExportParams): Promise<string> {
  const data = await collectTravailleurs(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportTravailleursPdf(params: ExportParams): Promise<string> {
  const data = await collectTravailleurs(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Congés ---
export async function exportCongesExcel(params: ExportParams): Promise<string> {
  const data = await collectConges(params)
  const buffer = await generateExcel({
    ...data,
    extraSheet: { name: 'Soldes', headers: data.soldesHeaders, rows: data.soldesRows },
  })
  return buffer.toString('base64')
}

export async function exportCongesPdf(params: ExportParams): Promise<string> {
  const data = await collectConges(params)
  const buffer = generatePdf({
    ...data,
    extraPage: { titre: 'Soldes par travailleur', headers: data.soldesHeaders, rows: data.soldesRows },
  })
  return buffer.toString('base64')
}

// --- Calendrier ---
export async function exportCalendrierExcel(params: ExportParams): Promise<string> {
  const data = await collectCalendrier(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportCalendrierPdf(params: ExportParams): Promise<string> {
  const data = await collectCalendrier(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Pot d'heures ---
export async function exportPotHeuresExcel(params: ExportParams): Promise<string> {
  const data = await collectPotHeures(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportPotHeuresPdf(params: ExportParams): Promise<string> {
  const data = await collectPotHeures(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}
