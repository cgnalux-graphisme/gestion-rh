export type ServiceCode = 'svc_admin' | 'juridique' | 'compta_rh' | 'permanent'
export type OptionHoraire = 'A' | 'B'

export type Service = {
  id: string
  nom: string
  code: ServiceCode
}

export type Bureau = {
  id: string
  nom: string
  code: string
  horaires_normaux: Record<string, unknown>
  horaires_ete: Record<string, unknown>
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
