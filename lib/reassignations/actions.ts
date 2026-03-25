'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit/logger'

/** Récupère les réaffectations en attente pour le travailleur connecté */
export async function getReassignationsEnAttente() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('reassignations_temporaires')
    .select(`
      *,
      bureau:bureaux!bureau_id(id, nom),
      conge:conges!conge_id(
        id, type, date_debut, date_fin,
        profile:profiles!user_id(prenom, nom)
      )
    `)
    .eq('travailleur_id', user.id)
    .eq('statut', 'en_attente')
    .order('date', { ascending: true })

  return data ?? []
}

/** Le travailleur accepte ou refuse une réaffectation */
export async function repondreReassignation(
  id: string,
  accepte: boolean,
  commentaire?: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Vérifier que la réaffectation appartient bien à l'utilisateur et est en attente
  const { data: reassignation } = await admin
    .from('reassignations_temporaires')
    .select('*, bureau:bureaux!bureau_id(nom)')
    .eq('id', id)
    .eq('travailleur_id', user.id)
    .eq('statut', 'en_attente')
    .single()

  if (!reassignation) {
    return { error: 'Réaffectation introuvable ou déjà traitée' }
  }

  const nouveauStatut = accepte ? 'accepte' : 'refuse'

  // Mettre à jour le statut
  const { error: updateError } = await admin
    .from('reassignations_temporaires')
    .update({
      statut: nouveauStatut,
      repondu_le: new Date().toISOString(),
      commentaire: commentaire ?? null,
      vu_par_travailleur: true,
    })
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  // Si accepté, créer l'affectation temporaire au bureau
  if (accepte) {
    await admin
      .from('bureau_affectations_temp')
      .upsert(
        {
          user_id: user.id,
          bureau_id: reassignation.bureau_id,
          date: reassignation.date,
          reassignation_id: id,
        },
        { onConflict: 'user_id,bureau_id,date' }
      )
  }

  const bureauInfo = reassignation.bureau as { nom: string } | null

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: `reassignation.${nouveauStatut}`,
    category: 'conges',
    description: `Réaffectation ${accepte ? 'acceptée' : 'refusée'}: ${bureauInfo?.nom ?? 'bureau'} le ${reassignation.date}`,
    metadata: { reassignation_id: id, bureau_id: reassignation.bureau_id, date: reassignation.date, accepte },
    commentaire,
  })

  revalidatePath('/')
  revalidatePath('/admin/conges')
  return { success: true }
}
