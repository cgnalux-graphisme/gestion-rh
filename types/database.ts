export type ServiceCode = 'svc_admin' | 'juridique' | 'compta_rh' | 'permanent'
export type OptionHoraire = 'A' | 'B'

export type Service = {
  id: string
  nom: string
  code: ServiceCode
}

// Structure d'une journée dans les horaires bureau
export type HorairesJour = {
  ouverture: string   // 'HH:mm'
  fermeture: string   // 'HH:mm'
  pause_midi: number  // minutes
}

// Map jours 1–5 (lundi–vendredi) → HorairesJour
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
  horaires_normaux: HorairesHebdo
  horaires_ete: HorairesHebdo
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

export type DayStatus = 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | '?' | 'W' | '-'

export type Pointage = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  arrivee: string | null   // ISO timestamptz
  midi_out: string | null
  midi_in: string | null
  depart: string | null
  created_at: string
}

export type DayStatusRecord = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A'
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

export type TypeConge = 'conge_annuel' | 'repos_comp' | 'maladie' | 'autre'
export type StatutConge = 'en_attente' | 'approuve' | 'refuse'

export type Conge = {
  id: string
  user_id: string
  type: TypeConge
  date_debut: string    // 'YYYY-MM-DD'
  date_fin: string      // 'YYYY-MM-DD'
  nb_jours: number
  statut: StatutConge
  commentaire_travailleur: string | null
  commentaire_admin: string | null
  piece_jointe_url: string | null
  approuve_par: string | null
  approuve_le: string | null
  created_at: string
  // joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

export type SoldeConges = {
  id: string
  user_id: string
  annee: number
  conges_annuels_total: number
  conges_annuels_pris: number
  repos_comp_total: number
  repos_comp_pris: number
  updated_at: string
}
