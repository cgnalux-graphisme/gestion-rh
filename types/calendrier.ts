export type StatutJour =
  | 'present'
  | 'en_cours'
  | 'absent'
  | 'conge'
  | 'maladie'
  | 'ferie'
  | 'greve'
  | 'weekend'
  | 'vide'

export type IndicateurPointage = 'ok' | 'anomalie' | 'manquant' | 'corrige'

export type IndicateursJour = {
  arrivee: IndicateurPointage
  midi_out: IndicateurPointage
  midi_in: IndicateurPointage
  depart: IndicateurPointage
}

export type JourCalendrier = {
  date: string        // ISO "YYYY-MM-DD"
  statut: StatutJour
  label?: string      // nom du jour férié si ferie, type de congé si conge
  anomalie?: boolean  // true si le pointage nécessite vérification
  indicateurs?: IndicateursJour  // couleur par pointage (feu tricolore)
}

export type TravailleurCalendrier = {
  id: string
  prenom: string
  nom: string
  service: string     // nom du service
  bureau: string      // nom du bureau principal (pour le tri)
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
