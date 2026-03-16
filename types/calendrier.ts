export type StatutJour =
  | 'present'
  | 'absent'
  | 'conge'
  | 'ferie'
  | 'weekend'
  | 'vide'

export type JourCalendrier = {
  date: string        // ISO "YYYY-MM-DD"
  statut: StatutJour
  label?: string      // nom du jour férié si ferie, type de congé si conge
}

export type TravailleurCalendrier = {
  id: string
  prenom: string
  nom: string
  service: string     // nom du service
  jours: JourCalendrier[]
}

export type CalendrierFiltresProps = {
  vue: 'semaine' | 'mois'
  date: string
  serviceId?: string
  bureauId?: string
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}
