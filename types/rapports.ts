export type PeriodeType = 'mois' | 'trimestre' | 'annee'

export type ExportParams = {
  periodeType: PeriodeType
  periodeDate: string   // ISO "YYYY-MM-DD"
  serviceId?: string
  bureauId?: string
}

export type TauxPresenceService = {
  service: string
  serviceId: string
  taux: number
  joursPresent: number
  joursOuvrables: number
}

export type AbsenceParType = {
  type: string
  label: string
  count: number
  couleur: string
}

export type TopAbsenceEntry = {
  prenom: string
  nom: string
  service: string
  joursMaladie: number
  joursAbsent: number
  total: number
}

export type PotHeuresService = {
  service: string
  serviceId: string
  moyenneMinutes: number
  nbTravailleurs: number
}

export type StatsData = {
  tauxPresence: TauxPresenceService[]
  tauxGlobal: number
  absencesParType: AbsenceParType[]
  totalAbsences: number
  topAbsences: TopAbsenceEntry[]
  potHeures: PotHeuresService[]
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}
