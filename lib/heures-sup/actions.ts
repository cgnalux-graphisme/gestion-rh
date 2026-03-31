'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DemandeHeuresSup, PotHeures } from '@/types/database'
import { logAudit } from '@/lib/audit/logger'

export type MouvementPotHeures = {
  date: string
  type: 'hs_approuvee' | 'recup_prise' | 'deduction_correction' | 'correction_admin' | 'solde_initial'
  description: string
  delta_minutes: number
  solde_apres: number
}

/** Récupère toutes les demandes HS du travailleur connecté */
export async function getMesDemandesHSAction(): Promise<DemandeHeuresSup[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('demandes_heures_sup')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as DemandeHeuresSup[]
}

/** Soumet une nouvelle demande d'heures supplémentaires */
export async function demanderHeuresSupAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const date = formData.get('date') as string
  const heuresStr = formData.get('heures') as string
  const minutesStr = formData.get('minutes') as string
  const commentaire = (formData.get('commentaire') as string) || null

  if (!date) return { error: 'La date est obligatoire' }

  const heures = parseInt(heuresStr || '0', 10)
  const minutes = parseInt(minutesStr || '0', 10)
  const nb_minutes = heures * 60 + minutes

  if (nb_minutes <= 0) return { error: 'Le nombre d\'heures doit être supérieur à 0' }
  if (nb_minutes > 720) return { error: 'Maximum 12 heures supplémentaires par jour' }
  if (!commentaire || commentaire.trim().length === 0) {
    return { error: 'Un commentaire expliquant la raison est obligatoire' }
  }

  const admin = createAdminClient()

  // Vérifier qu'il n'y a pas déjà une demande pour cette date
  const { data: existing } = await admin
    .from('demandes_heures_sup')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (existing) {
    return { error: 'Une demande existe déjà pour cette date' }
  }

  const { error: insertError } = await admin
    .from('demandes_heures_sup')
    .insert({
      user_id: user.id,
      date,
      nb_minutes,
      commentaire_travailleur: commentaire.trim(),
    })

  if (insertError) return { error: insertError.message }

  const h = Math.floor(nb_minutes / 60)
  const m = nb_minutes % 60
  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'heures_sup.demande',
    category: 'heures_sup',
    description: `Demande heures sup: ${h}h${m > 0 ? String(m).padStart(2, '0') : ''} le ${date}`,
    metadata: { date, nb_minutes },
  })

  revalidatePath('/')
  return { success: true }
}

/** Récupère le solde du pot d'heures */
export async function getPotHeuresAction(annee?: number): Promise<PotHeures | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const targetAnnee = annee ?? new Date().getFullYear()
  const { data } = await supabase
    .from('pot_heures')
    .select('*')
    .eq('user_id', user.id)
    .eq('annee', targetAnnee)
    .single()
  return data ?? null
}

/** Récupère les mouvements du pot d'heures pour le graphique et le journal */
export async function getMouvementsPotHeuresAction(annee?: number): Promise<MouvementPotHeures[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const targetAnnee = annee ?? new Date().getFullYear()
  const admin = createAdminClient()

  // Récupérer le solde initial (parametres_option_horaire)
  const { data: params } = await admin
    .from('parametres_option_horaire')
    .select('pot_heures_initial')
    .single()
  const soldeInitial = params?.pot_heures_initial ?? 0

  // 1. HS approuvées
  const { data: hsData } = await admin
    .from('demandes_heures_sup')
    .select('date, nb_minutes, commentaire_travailleur')
    .eq('user_id', user.id)
    .eq('statut', 'approuve')
    .gte('date', `${targetAnnee}-01-01`)
    .lte('date', `${targetAnnee}-12-31`)

  // 2. Récupérations approuvées
  const { data: recupData } = await admin
    .from('conges')
    .select('date_debut, recup_minutes, commentaire_travailleur')
    .eq('user_id', user.id)
    .eq('type', 'recuperation')
    .eq('statut', 'approuve')
    .gte('date_debut', `${targetAnnee}-01-01`)
    .lte('date_debut', `${targetAnnee}-12-31`)

  // 3. Corrections refusées avec déduction
  const { data: corrData } = await admin
    .from('corrections_pointage')
    .select('date, minutes_deduites, motif')
    .eq('user_id', user.id)
    .gt('minutes_deduites', 0)
    .gte('date', `${targetAnnee}-01-01`)
    .lte('date', `${targetAnnee}-12-31`)

  // 4. Corrections manuelles admin (audit_logs)
  const { data: auditData } = await admin
    .from('audit_logs')
    .select('created_at, metadata, description')
    .eq('target_user_id', user.id)
    .eq('category', 'pot_heures')
    .like('action', 'pot_heures.correction%')
    .gte('created_at', `${targetAnnee}-01-01`)
    .lte('created_at', `${targetAnnee}-12-31`)

  // Assembler les mouvements
  const mouvements: { date: string; type: MouvementPotHeures['type']; description: string; delta_minutes: number; created_at: string }[] = []

  // Solde initial au 1er janvier
  mouvements.push({
    date: `${targetAnnee}-01-01`,
    type: 'solde_initial',
    description: 'Solde initial',
    delta_minutes: soldeInitial,
    created_at: `${targetAnnee}-01-01T00:00:00`,
  })

  for (const hs of hsData ?? []) {
    mouvements.push({
      date: hs.date,
      type: 'hs_approuvee',
      description: hs.commentaire_travailleur ? `HS : ${hs.commentaire_travailleur.slice(0, 60)}` : 'Heures sup approuvées',
      delta_minutes: hs.nb_minutes,
      created_at: `${hs.date}T12:00:00`,
    })
  }

  for (const r of recupData ?? []) {
    const mins = r.recup_minutes ?? 0
    mouvements.push({
      date: r.date_debut,
      type: 'recup_prise',
      description: r.commentaire_travailleur ? `Récup : ${r.commentaire_travailleur.slice(0, 60)}` : 'Récupération prise',
      delta_minutes: -mins,
      created_at: `${r.date_debut}T12:00:01`,
    })
  }

  for (const c of corrData ?? []) {
    mouvements.push({
      date: c.date,
      type: 'deduction_correction',
      description: c.motif ? `Déduction : ${c.motif.slice(0, 60)}` : 'Déduction correction refusée',
      delta_minutes: -(c.minutes_deduites ?? 0),
      created_at: `${c.date}T12:00:02`,
    })
  }

  for (const a of auditData ?? []) {
    const meta = a.metadata as Record<string, unknown> | null
    const delta = typeof meta?.delta_minutes === 'number' ? meta.delta_minutes as number : 0
    mouvements.push({
      date: (a.created_at as string).slice(0, 10),
      type: 'correction_admin',
      description: a.description ?? 'Correction manuelle admin',
      delta_minutes: delta,
      created_at: a.created_at as string,
    })
  }

  // Trier par date + created_at
  mouvements.sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Calculer le solde cumulé
  let solde = 0
  const result: MouvementPotHeures[] = mouvements.map((m) => {
    solde += m.delta_minutes
    return {
      date: m.date,
      type: m.type,
      description: m.description,
      delta_minutes: m.delta_minutes,
      solde_apres: solde,
    }
  })

  return result
}

/** Annule une demande en attente */
export async function annulerDemandeHSAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: demande } = await admin
    .from('demandes_heures_sup')
    .select('user_id, statut')
    .eq('id', id)
    .single()

  if (!demande) return { error: 'Demande introuvable' }
  if (demande.user_id !== user.id) return { error: 'Non autorisé' }
  if (demande.statut !== 'en_attente') return { error: 'Seules les demandes en attente peuvent être annulées' }

  const { error } = await admin.from('demandes_heures_sup').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'heures_sup.annulation',
    category: 'heures_sup',
    description: 'Demande heures sup annulée',
  })

  revalidatePath('/')
  return {}
}
