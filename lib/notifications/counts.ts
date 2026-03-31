'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface NotificationCounts {
  // Worker - decisions non lues (réponses du RH)
  decisionsConges: number
  decisionsHS: number
  decisionsCorrections: number
  // Worker - réaffectations en attente de réponse
  reassignationsEnAttente: number
  // Admin - demandes à traiter
  congesATraiter: number
  hsATraiter: number
  correctionsATraiter: number
}

const EMPTY: NotificationCounts = {
  decisionsConges: 0,
  decisionsHS: 0,
  decisionsCorrections: 0,
  reassignationsEnAttente: 0,
  congesATraiter: 0,
  hsATraiter: 0,
  correctionsATraiter: 0,
}

export async function getNotificationCounts(): Promise<NotificationCounts> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin_rh ?? false

  // Worker: count decisions not yet seen + pending reassignations
  const [congesRes, hsRes, correctionsRes, reassignationsRes] = await Promise.all([
    supabase
      .from('conges')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false),
    supabase
      .from('demandes_heures_sup')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false),
    supabase
      .from('corrections_pointage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('statut', ['approuve', 'refuse'])
      .eq('vu_par_travailleur', false),
    supabase
      .from('reassignations_temporaires')
      .select('id', { count: 'exact', head: true })
      .eq('travailleur_id', user.id)
      .eq('statut', 'en_attente')
      .eq('vu_par_travailleur', false),
  ])

  const counts: NotificationCounts = {
    ...EMPTY,
    decisionsConges: congesRes.count ?? 0,
    decisionsHS: hsRes.count ?? 0,
    decisionsCorrections: correctionsRes.count ?? 0,
    reassignationsEnAttente: reassignationsRes.count ?? 0,
  }

  // Admin counts
  if (isAdmin) {
    const admin = createAdminClient()
    const [adminConges, adminHS, adminCorrections] = await Promise.all([
      admin
        .from('conges')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_attente'),
      admin
        .from('demandes_heures_sup')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_attente'),
      admin
        .from('corrections_pointage')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_attente'),
    ])

    counts.congesATraiter = adminConges.count ?? 0
    counts.hsATraiter = adminHS.count ?? 0
    counts.correctionsATraiter = adminCorrections.count ?? 0
  }

  return counts
}

