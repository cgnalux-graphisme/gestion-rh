import type { HorairesBureauHebdo } from '@/types/database'

export type StatutSimple = 'P' | 'C' | 'M' | 'F' | '-' | ''

export type CoverageStatus = {
  service_id: string
  service_nom: string
  presents: number
  seuil: number
  alerte: boolean  // true when presents < seuil
}

export type JourBureau = {
  date: string      // ISO "YYYY-MM-DD"
  coverage: CoverageStatus[]
}

export type TravailleurBureau = {
  id: string
  prenom: string
  nom: string
  service_id: string
  service_nom: string
  jours: { date: string; statut: StatutSimple }[]
  is_temp: boolean  // true if temp-assigned to this bureau for any day in range
}

export type CalendrierBureauData = {
  bureau: { id: string; nom: string; code: string; horaires: HorairesBureauHebdo }
  travailleurs: TravailleurBureau[]
  permanents: { id: string; prenom: string; nom: string; statut_aujourdhui: StatutSimple }[]
  jours: JourBureau[]
  bureaux: { id: string; nom: string; code: string }[]
}
