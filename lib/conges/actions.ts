'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges, AnnulationConge } from '@/types/database'
import { calcJoursOuvrables, todayBrussels } from '@/lib/utils/dates'
import { logAudit } from '@/lib/audit/logger'

/** Récupère les soldes de l'année courante pour l'utilisateur connecté */
export async function getSoldesCongesAction(annee?: number): Promise<SoldeConges | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const targetAnnee = annee ?? new Date().getFullYear()
  const { data } = await supabase
    .from('soldes_conges')
    .select('*')
    .eq('user_id', user.id)
    .eq('annee', targetAnnee)
    .single()
  return data ?? null
}

/** Récupère toutes les demandes du travailleur connecté */
export async function getMesCongesAction(): Promise<Conge[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('conges')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as Conge[]
}

/** Soumet une nouvelle demande de congé */
export async function demanderCongeAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = formData.get('type') as string
  const date_debut = formData.get('date_debut') as string
  const date_fin = formData.get('date_fin') as string
  const commentaire_travailleur = (formData.get('commentaire_travailleur') as string) || null
  const demi_journee_raw = formData.get('demi_journee') as string | null
  const demi_journee = (demi_journee_raw === 'matin' || demi_journee_raw === 'apres_midi') ? demi_journee_raw : null

  // Validations basiques
  if (!type || !date_debut) return { error: 'Champs obligatoires manquants' }

  // Récupération: single day + heures
  if (type === 'recuperation') {
    const heures = parseInt(formData.get('recup_heures') as string, 10) || 0
    const minutes = parseInt(formData.get('recup_minutes') as string, 10) || 0
    const totalMinutes = heures * 60 + minutes
    if (totalMinutes <= 0) return { error: 'Veuillez indiquer une durée à récupérer' }
    if (totalMinutes > 480) return { error: 'La durée ne peut pas dépasser 8h par jour' }

    const admin = createAdminClient()
    const { error: insertError } = await admin
      .from('conges')
      .insert({
        user_id: user.id,
        type,
        date_debut,
        date_fin: date_debut,
        nb_jours: 1,
        recup_minutes: totalMinutes,
        commentaire_travailleur: commentaire_travailleur
          ? `${heures}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''} — ${commentaire_travailleur}`
          : `${heures}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`,
      })

    if (insertError) return { error: insertError.message }

    await logAudit({
      targetUserId: user.id,
      actorUserId: user.id,
      action: 'conge.demande',
      category: 'conges',
      description: `Demande de congé: ${type} du ${date_debut} au ${date_debut} (1j)`,
      metadata: { type, date_debut, date_fin: date_debut, nb_jours: 1 },
    })

    revalidatePath('/conges')
    return { success: true }
  }

  // Autres types: période avec date_fin
  if (!date_fin) return { error: 'Date de fin obligatoire' }
  if (date_debut > date_fin) return { error: 'La date de fin doit être après la date de début' }
  const joursComplets = calcJoursOuvrables(date_debut, date_fin)
  if (joursComplets === 0) return { error: 'Aucun jour ouvrable dans la période sélectionnée' }
  // Demi-journée uniquement si jour unique
  const isDemiJournee = demi_journee && date_debut === date_fin
  const nb_jours = isDemiJournee ? 0.5 : joursComplets

  const admin = createAdminClient()
  let warning: string | undefined

  // Vérifier le solde si congé annuel (warning non-bloquant)
  if (type === 'conge_annuel') {
    const annee = new Date(date_debut).getFullYear()
    const { data: solde } = await admin
      .from('soldes_conges')
      .select('conges_annuels_total, conges_annuels_pris')
      .eq('user_id', user.id)
      .eq('annee', annee)
      .single()
    if (solde) {
      const disponible = solde.conges_annuels_total - solde.conges_annuels_pris
      if (nb_jours > disponible) {
        warning = `Solde insuffisant (${disponible} jour(s) disponible(s)). La demande sera soumise à la décision de l'admin.`
      }
    }
  }

  // Insérer le congé
  const { error: insertError } = await admin
    .from('conges')
    .insert({
      user_id: user.id, type, date_debut, date_fin, nb_jours,
      demi_journee: isDemiJournee ? demi_journee : null,
      commentaire_travailleur,
    })

  if (insertError) return { error: insertError.message }

  const demiLabel = isDemiJournee ? ` (${demi_journee === 'matin' ? 'matin' : 'après-midi'})` : ''
  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'conge.demande',
    category: 'conges',
    description: `Demande de congé: ${type} du ${date_debut} au ${date_fin || date_debut} (${nb_jours}j${demiLabel})`,
    metadata: { type, date_debut, date_fin: date_fin || date_debut, nb_jours, demi_journee: isDemiJournee ? demi_journee : null },
  })

  revalidatePath('/conges')
  return { success: true, warning }
}

/** Soumet un signalement maladie avec certificat médical */
export async function signalerMaladieAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const date_debut = formData.get('date_debut') as string
  const date_fin = formData.get('date_fin') as string
  const commentaire_travailleur = (formData.get('commentaire_travailleur') as string) || null
  const piece_jointe = formData.get('piece_jointe') as File | null

  if (!date_debut || !date_fin) return { error: 'Les dates sont obligatoires' }
  if (date_debut > date_fin) return { error: 'La date de fin doit être après la date de début' }
  const nb_jours = calcJoursOuvrables(date_debut, date_fin)
  if (nb_jours === 0) return { error: 'Aucun jour ouvrable dans la période sélectionnée' }

  // Validation fichier
  if (piece_jointe && piece_jointe.size > 0) {
    if (piece_jointe.size > 5 * 1024 * 1024) {
      return { error: 'Le fichier ne doit pas dépasser 5 MB' }
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(piece_jointe.type)) {
      return { error: 'Seuls les fichiers PDF, JPG et PNG sont acceptés' }
    }
  }

  const admin = createAdminClient()

  // Insérer le congé maladie
  const { data: newConge, error: insertError } = await admin
    .from('conges')
    .insert({
      user_id: user.id,
      type: 'maladie',
      date_debut,
      date_fin,
      nb_jours,
      commentaire_travailleur,
    })
    .select('id')
    .single()

  if (insertError || !newConge) return { error: insertError?.message ?? 'Erreur lors de la création' }

  // Upload certificat si présent
  if (piece_jointe && piece_jointe.size > 0) {
    const ext = piece_jointe.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${user.id}/${newConge.id}.${ext}`
    const buffer = await piece_jointe.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('certificats-medicaux')
      .upload(path, buffer, { contentType: piece_jointe.type, upsert: true })
    if (uploadError) {
      await admin.from('conges').delete().eq('id', newConge.id)
      return { error: `Erreur upload fichier : ${uploadError.message}` }
    }
    await admin.from('conges').update({ piece_jointe_url: path }).eq('id', newConge.id)
  }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'conge.maladie',
    category: 'conges',
    description: `Signalement maladie: du ${date_debut} au ${date_fin} (${nb_jours}j)`,
    metadata: { date_debut, date_fin, nb_jours, avec_certificat: !!(piece_jointe && piece_jointe.size > 0) },
  })

  revalidatePath('/conges')
  return { success: true }
}

/** Annule une demande en_attente du travailleur connecté */
export async function annulerCongeAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: conge } = await admin
    .from('conges')
    .select('user_id, statut, piece_jointe_url')
    .eq('id', id)
    .single()

  if (!conge) return { error: 'Demande introuvable' }
  if (conge.user_id !== user.id) return { error: 'Non autorisé' }
  if (conge.statut !== 'en_attente') return { error: 'Seules les demandes en attente peuvent être annulées' }

  // Supprimer la pièce jointe si présente
  if (conge.piece_jointe_url) {
    await admin.storage.from('certificats-medicaux').remove([conge.piece_jointe_url])
  }

  const { error } = await admin.from('conges').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'conge.annulation',
    category: 'conges',
    description: 'Demande de congé annulée',
  })

  revalidatePath('/conges')
  return {}
}

/** Génère une URL signée (1h) pour qu'un travailleur voie son propre certificat */
export async function getSignedUrlWorkerAction(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!path.startsWith(user.id + '/')) return null
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('certificats-medicaux')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Historique congés filtrés par année */
export async function getHistoriqueCongesAction(annee?: number): Promise<Conge[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const targetAnnee = annee ?? new Date().getFullYear()
  const debut = `${targetAnnee}-01-01`
  const fin = `${targetAnnee}-12-31`
  const { data } = await supabase
    .from('conges')
    .select('*')
    .eq('user_id', user.id)
    .gte('date_debut', debut)
    .lte('date_debut', fin)
    .in('type', ['conge_annuel', 'repos_comp'])
    .order('date_debut', { ascending: false })
  return (data ?? []) as Conge[]
}

/** Annulations en cours du travailleur connecté */
export async function getAnnulationsEnCoursAction(): Promise<AnnulationConge[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('annulations_conges')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as AnnulationConge[]
}

/** Demande d'annulation d'un congé approuvé */
export async function demanderAnnulationCongeAction(
  congeId: string,
  motif: string
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!motif || motif.trim().length === 0) return { error: 'Le motif est obligatoire' }

  const admin = createAdminClient()
  const { data: conge } = await admin
    .from('conges')
    .select('user_id, statut, date_debut')
    .eq('id', congeId)
    .single()

  if (!conge) return { error: 'Congé introuvable' }
  if (conge.user_id !== user.id) return { error: 'Non autorisé' }
  if (conge.statut !== 'approuve') return { error: 'Seuls les congés approuvés peuvent faire l\'objet d\'une demande d\'annulation' }

  const today = todayBrussels()
  if (conge.date_debut <= today) return { error: 'Impossible d\'annuler un congé déjà commencé ou passé' }

  const { error: insertError } = await admin
    .from('annulations_conges')
    .insert({ conge_id: congeId, user_id: user.id, motif: motif.trim() })

  if (insertError) {
    if (insertError.code === '23505') return { error: 'Une demande d\'annulation est déjà en cours pour ce congé' }
    return { error: insertError.message }
  }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'conge.demande_annulation',
    category: 'conges',
    description: `Demande d'annulation du congé #${congeId.slice(0, 8)}`,
    metadata: { conge_id: congeId },
  })

  revalidatePath('/conges')
  return {}
}
