'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges } from '@/types/database'
import { calcJoursOuvrables } from '@/lib/utils/dates'

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
  const piece_jointe = formData.get('piece_jointe') as File | null

  // Validations basiques
  if (!type || !date_debut || !date_fin) return { error: 'Champs obligatoires manquants' }
  if (date_debut > date_fin) return { error: 'La date de fin doit être après la date de début' }
  const nb_jours = calcJoursOuvrables(date_debut, date_fin)
  if (nb_jours === 0) return { error: 'Aucun jour ouvrable dans la période sélectionnée' }

  // Pièce jointe obligatoire pour maladie
  if (type === 'maladie' && (!piece_jointe || piece_jointe.size === 0)) {
    return { error: 'Un certificat médical est obligatoire pour une absence maladie' }
  }
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

  // Insérer le congé (sans piece_jointe_url pour l'instant)
  const { data: newConge, error: insertError } = await admin
    .from('conges')
    .insert({ user_id: user.id, type, date_debut, date_fin, nb_jours, commentaire_travailleur })
    .select('id')
    .single()

  if (insertError || !newConge) return { error: insertError?.message ?? 'Erreur lors de la création' }

  // Upload pièce jointe si présente
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

  revalidatePath('/conges')
  return { success: true, warning }
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

  revalidatePath('/conges')
  return {}
}

/** Génère une URL signée (1h) pour qu'un travailleur voie son propre certificat */
export async function getSignedUrlWorkerAction(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Vérifier que le path appartient à l'user
  if (!path.startsWith(user.id + '/')) return null
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('certificats-medicaux')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
