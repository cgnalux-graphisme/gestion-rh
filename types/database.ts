export type ServiceCode = 'svc_admin' | 'juridique' | 'compta_rh' | 'permanent'
export type OptionHoraire = 'A' | 'B'

export type Service = {
  id: string
  nom: string
  code: ServiceCode
}

// Structure d'une journée dans les horaires bureau (matin + après-midi)
export type HorairesBureauJour = {
  matin_debut: string   // 'HH:mm'
  matin_fin: string     // 'HH:mm'
  aprem_debut: string   // 'HH:mm'
  aprem_fin: string     // 'HH:mm'
}

// Map jours 1–5 (lundi–vendredi) → HorairesBureauJour
export type HorairesBureauHebdo = {
  '1': HorairesBureauJour
  '2': HorairesBureauJour
  '3': HorairesBureauJour
  '4': HorairesBureauJour
  '5': HorairesBureauJour
}

// Legacy: structure horaires travailleur (utilisé par parametres_horaires)
export type HorairesJour = {
  ouverture: string   // 'HH:mm'
  fermeture: string   // 'HH:mm'
  pause_midi: number  // minutes
}

export type HorairesHebdo = {
  '1': HorairesJour
  '2': HorairesJour
  '3': HorairesJour
  '4': HorairesJour
  '5': HorairesJour
}

export type Bureau = {
  id: string
  nom: string
  code: string
  horaires_normaux: HorairesBureauHebdo
  horaires_ete: HorairesBureauHebdo
}

export type Profile = {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string | null
  date_naissance: string | null
  contact_urgence: string | null
  rue: string | null
  numero: string | null
  boite: string | null
  code_postal: string | null
  commune: string | null
  pays: string
  service_id: string
  type_contrat: string | null
  date_entree: string | null
  option_horaire: OptionHoraire | null
  option_horaire_prochaine: OptionHoraire | null
  avatar_url: string | null
  is_admin_rh: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  // joins
  service?: Service
}

export type UserBureauSchedule = {
  id: string
  user_id: string
  bureau_id: string
  jour: 1 | 2 | 3 | 4 | 5
  valide_depuis: string
  bureau?: Bureau
}

export type InvitationToken = {
  id: string
  user_id: string
  expires_at: string
  used_at: string | null
}

export type DayStatus = 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | 'G' | '?' | 'W' | '-'

export type Pointage = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  arrivee: string | null   // ISO timestamptz
  midi_out: string | null
  midi_in: string | null
  depart: string | null
  corrections_appliquees: Record<string, boolean>  // {"arrivee": true, ...}
  created_at: string
}

export type DayStatusRecord = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | 'G'
  commentaire: string | null
  corrige_par: string | null
  created_at: string
}

export type PotHeures = {
  id: string
  user_id: string
  annee: number
  solde_minutes: number
  updated_at: string
}

export type TypeConge = 'conge_annuel' | 'repos_comp' | 'recuperation' | 'maladie' | 'autre'
export type StatutConge = 'en_attente' | 'approuve' | 'refuse' | 'annule'
export type StatutDemandeHS = 'en_attente' | 'approuve' | 'refuse'

export type DemiJournee = 'matin' | 'apres_midi'

export type Conge = {
  id: string
  user_id: string
  type: TypeConge
  date_debut: string    // 'YYYY-MM-DD'
  date_fin: string      // 'YYYY-MM-DD'
  nb_jours: number      // supporte 0.5 pour les demi-journées
  demi_journee: DemiJournee | null  // null = journée complète
  statut: StatutConge
  commentaire_travailleur: string | null
  commentaire_admin: string | null
  recup_minutes: number | null
  piece_jointe_url: string | null
  approuve_par: string | null
  approuve_le: string | null
  created_at: string
  // joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

export type AnnulationConge = {
  id: string
  conge_id: string
  user_id: string
  motif: string
  statut: 'en_attente' | 'approuve' | 'refuse'
  commentaire_admin: string | null
  traite_par: string | null
  traite_le: string | null
  created_at: string
}

export type DemandeHeuresSup = {
  id: string
  user_id: string
  date: string           // 'YYYY-MM-DD'
  nb_minutes: number
  commentaire_travailleur: string | null
  commentaire_admin: string | null
  statut: StatutDemandeHS
  approuve_par: string | null
  approuve_le: string | null
  created_at: string
  // joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

// ─── Demandes de correction pointage ───
export type StatutCorrectionPointage = 'en_attente' | 'approuve' | 'refuse'

export type CorrectionPointage = {
  id: string
  user_id: string
  date: string              // 'YYYY-MM-DD'
  champ: 'arrivee' | 'midi_out' | 'midi_in' | 'depart'
  heure_proposee: string    // 'HH:mm'
  motif: string
  statut: StatutCorrectionPointage
  commentaire_admin: string | null
  traite_par: string | null
  traite_le: string | null
  vu_par_travailleur: boolean
  minutes_deduites: number | null
  heure_corrigee: string | null  // 'HH:mm' effectivement appliquée
  created_at: string
  // joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

// ─── Régimes de travail (droit belge) ───
export type RegimeType =
  | 'temps_plein'
  | 'mi_temps_medical'
  | 'conge_parental'
  | 'credit_temps_motif'
  | 'credit_temps_fin_carriere'
  | 'conge_assistance_medicale'
  | 'conge_soins_palliatifs'
  | 'conge_aidant_proche'
  | 'temps_partiel_contractuel'
  | 'prestations_reduites_medicales'
  | 'conge_formation'

export type RegimeFraction =
  | 'temps_plein'
  | 'mi_temps'
  | 'quatre_cinquieme'
  | 'trois_quart'
  | 'neuf_dixieme'
  | 'un_dixieme'
  | 'un_tiers'
  | 'suspension_complete'
  | 'personnalise'

export type RegimeTravail = {
  id: string
  user_id: string
  type_regime: RegimeType
  fraction: RegimeFraction
  pourcentage_travail: number       // 0-100
  jour_off: number | null           // 1=lundi...5=vendredi (pour 4/5, 1/5, 9/10)
  heures_par_jour: number | null    // pour mi-temps médical personnalisé
  jours_par_semaine: number         // ex: 5, 4, 2.5
  date_debut: string                // 'YYYY-MM-DD'
  date_fin: string | null           // null = en cours
  commentaire: string | null
  created_at: string
  updated_at: string
}

// Labels pour l'UI
export const REGIME_TYPE_LABELS: Record<RegimeType, string> = {
  temps_plein: 'Temps plein',
  mi_temps_medical: 'Mi-temps médical (reprise progressive)',
  conge_parental: 'Congé parental',
  credit_temps_motif: 'Crédit-temps avec motif',
  credit_temps_fin_carriere: 'Crédit-temps fin de carrière',
  conge_assistance_medicale: 'Congé assistance médicale',
  conge_soins_palliatifs: 'Congé soins palliatifs',
  conge_aidant_proche: 'Congé aidant proche',
  temps_partiel_contractuel: 'Temps partiel contractuel',
  prestations_reduites_medicales: 'Prestations réduites (raisons médicales)',
  conge_formation: 'Congé-éducation payé',
}

export const REGIME_FRACTION_LABELS: Record<RegimeFraction, string> = {
  temps_plein: 'Temps plein (100%)',
  mi_temps: 'Mi-temps (50%)',
  trois_quart: '3/4 temps (75%)',
  quatre_cinquieme: '4/5 temps (80%)',
  neuf_dixieme: '9/10 temps (90%)',
  un_dixieme: 'Réduction 1/10 (90%)',
  un_tiers: '1/3 temps (33%)',
  suspension_complete: 'Suspension complète (0%)',
  personnalise: 'Personnalisé',
}

// Fractions autorisées par type de régime (droit belge)
export const FRACTIONS_PAR_REGIME: Record<RegimeType, RegimeFraction[]> = {
  temps_plein: ['temps_plein'],
  mi_temps_medical: ['mi_temps', 'quatre_cinquieme', 'un_tiers', 'personnalise'],
  conge_parental: ['suspension_complete', 'mi_temps', 'quatre_cinquieme', 'neuf_dixieme', 'un_dixieme'],
  credit_temps_motif: ['suspension_complete', 'mi_temps', 'quatre_cinquieme'],
  credit_temps_fin_carriere: ['mi_temps', 'quatre_cinquieme'],
  conge_assistance_medicale: ['suspension_complete', 'mi_temps', 'quatre_cinquieme', 'neuf_dixieme'],
  conge_soins_palliatifs: ['suspension_complete', 'mi_temps', 'quatre_cinquieme', 'neuf_dixieme'],
  conge_aidant_proche: ['suspension_complete', 'mi_temps', 'quatre_cinquieme', 'neuf_dixieme'],
  temps_partiel_contractuel: ['mi_temps', 'trois_quart', 'quatre_cinquieme', 'un_tiers', 'personnalise'],
  prestations_reduites_medicales: ['mi_temps', 'quatre_cinquieme', 'trois_quart', 'personnalise'],
  conge_formation: ['temps_plein', 'quatre_cinquieme', 'mi_temps', 'personnalise'],
}

// Pourcentage par défaut pour chaque fraction
export const POURCENTAGE_PAR_FRACTION: Record<RegimeFraction, number> = {
  temps_plein: 100,
  mi_temps: 50,
  trois_quart: 75,
  quatre_cinquieme: 80,
  neuf_dixieme: 90,
  un_dixieme: 90,
  un_tiers: 33,
  suspension_complete: 0,
  personnalise: 50,
}

// Jours par semaine par défaut pour chaque fraction
export const JOURS_PAR_FRACTION: Record<RegimeFraction, number> = {
  temps_plein: 5,
  mi_temps: 2.5,
  trois_quart: 4,
  quatre_cinquieme: 4,
  neuf_dixieme: 4.5,
  un_dixieme: 4.5,
  un_tiers: 2,
  suspension_complete: 0,
  personnalise: 2.5,
}

export const JOURS_SEMAINE_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
}

export type SoldeConges = {
  id: string
  user_id: string
  annee: number
  conges_annuels_total: number
  conges_annuels_pris: number
  repos_comp_total: number
  repos_comp_pris: number
  reliquat_conges_annuels: number
  reliquat_repos_comp: number
  updated_at: string
}

// ─── Paramètres Options Horaires ───

export type HorairesTravailJour = {
  debut: string    // 'HH:mm'
  fin: string      // 'HH:mm'
  pause_midi: number // minutes
}

export type HorairesTravailHebdo = {
  '1': HorairesTravailJour
  '2': HorairesTravailJour
  '3': HorairesTravailJour
  '4': HorairesTravailJour
  '5': HorairesTravailJour
}

export type ParametresOption = {
  id: string
  option_horaire: OptionHoraire
  heures_semaine: number
  horaires: HorairesTravailHebdo
  horaires_ete: HorairesTravailHebdo
  conges_annuels_defaut: number
  repos_comp_defaut: number
  pot_heures_initial: number
  updated_at: string
}

// ─── Bureau Services & Couverture ───

export type BureauService = {
  id: string
  bureau_id: string
  service_id: string
}

export type BureauServiceSeuil = {
  id: string
  bureau_id: string
  service_id: string
  seuil_minimum: number
}

export type BureauAffectationTemp = {
  id: string
  user_id: string
  bureau_id: string
  date: string
  created_by: string
}

export type StatutReassignation = 'en_attente' | 'accepte' | 'refuse'

export type ReassignationTemporaire = {
  id: string
  conge_id: string
  travailleur_id: string
  bureau_id: string
  date: string
  statut: StatutReassignation
  demande_par: string
  created_at: string
  updated_at: string
  repondu_le: string | null
  commentaire: string | null
  vu_par_travailleur: boolean
  // Joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
  bureau?: Pick<Bureau, 'nom' | 'code'>
  conge?: Pick<Conge, 'user_id' | 'date_debut' | 'date_fin'> & {
    profile?: Pick<Profile, 'prenom' | 'nom'>
  }
}

// ─── Audit Log ───

export type AuditCategory =
  | 'conges'
  | 'pointage'
  | 'heures_sup'
  | 'regime'
  | 'profil'
  | 'admin'
  | 'pot_heures'

export type AuditLog = {
  id: string
  target_user_id: string
  actor_user_id: string
  action: string
  category: AuditCategory
  description: string
  metadata: Record<string, unknown>
  commentaire: string | null
  created_at: string
  // joins optionnels
  actor?: Pick<Profile, 'prenom' | 'nom'>
}
