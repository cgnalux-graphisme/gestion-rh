'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Conge, DemandeHeuresSup, CorrectionPointage, ReassignationTemporaire } from '@/types/database'

export type UnreadDecision =
  | { type: 'conge'; data: Conge }
  | { type: 'heures_sup'; data: DemandeHeuresSup }
  | { type: 'correction'; data: CorrectionPointage }
  | { type: 'reassignation'; data: ReassignationTemporaire }

/** Fetch all unread RH decisions for the current worker */
export async function getUnreadDecisions(): Promise<UnreadDecision[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [congesRes, hsRes, correctionsRes, reassignationsRes] = await Promise.all([
    supabase
      .from('conges')
      .select('*')
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false)
      .order('approuve_le', { ascending: false }),
    supabase
      .from('demandes_heures_sup')
      .select('*')
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false)
      .order('approuve_le', { ascending: false }),
    supabase
      .from('corrections_pointage')
      .select('*')
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false)
      .order('traite_le', { ascending: false }),
    supabase
      .from('reassignations_temporaires')
      .select('*, bureau:bureaux!bureau_id(nom, code), conge:conges!conge_id(type, date_debut, date_fin, profile:profiles!user_id(prenom, nom))')
      .eq('travailleur_id', user.id)
      .eq('statut', 'en_attente')
      .eq('vu_par_travailleur', false)
      .order('date', { ascending: true }),
  ])

  const decisions: UnreadDecision[] = [
    ...(reassignationsRes.data ?? []).map((r) => ({ type: 'reassignation' as const, data: r as unknown as ReassignationTemporaire })),
    ...(congesRes.data ?? []).map((c) => ({ type: 'conge' as const, data: c as Conge })),
    ...(hsRes.data ?? []).map((h) => ({ type: 'heures_sup' as const, data: h as DemandeHeuresSup })),
    ...(correctionsRes.data ?? []).map((c) => ({ type: 'correction' as const, data: c as CorrectionPointage })),
  ]

  return decisions
}

/** Mark a single decision as seen */
export async function markDecisionVue(
  table: 'conges' | 'demandes_heures_sup' | 'corrections_pointage' | 'reassignations_temporaires',
  id: string
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const userColumn = table === 'reassignations_temporaires' ? 'travailleur_id' : 'user_id'
  await admin
    .from(table)
    .update({ vu_par_travailleur: true })
    .eq('id', id)
    .eq(userColumn, user.id)
}

/** Mark all decisions as seen at once */
export async function markAllDecisionsVues(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await Promise.all([
    admin
      .from('conges')
      .update({ vu_par_travailleur: true })
      .eq('user_id', user.id)
      .eq('vu_par_travailleur', false),
    admin
      .from('demandes_heures_sup')
      .update({ vu_par_travailleur: true })
      .eq('user_id', user.id)
      .eq('vu_par_travailleur', false),
    admin
      .from('corrections_pointage')
      .update({ vu_par_travailleur: true })
      .eq('user_id', user.id)
      .eq('vu_par_travailleur', false),
    admin
      .from('reassignations_temporaires')
      .update({ vu_par_travailleur: true })
      .eq('travailleur_id', user.id)
      .eq('vu_par_travailleur', false),
  ])
}
