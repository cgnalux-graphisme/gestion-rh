'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DemandeHeuresSup, Profile } from '@/types/database'
import { logAudit } from '@/lib/audit/logger'

async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) redirect('/')
  return user
}

type DemandeHSWithProfile = DemandeHeuresSup & {
  profile: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

/** Toutes les demandes HS, toutes personnes */
export async function getAllDemandesHSAdmin(): Promise<DemandeHSWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('demandes_heures_sup')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .order('created_at', { ascending: false })
  return (data ?? []) as DemandeHSWithProfile[]
}

/** Demandes HS en attente (pour widget dashboard) */
export async function getDemandesHSEnAttenteAdmin(): Promise<DemandeHSWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('demandes_heures_sup')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
    .limit(5)
  return (data ?? []) as DemandeHSWithProfile[]
}

/** Approuve ou refuse une demande d'heures supplémentaires */
export async function traiterDemandeHSAction(
  id: string,
  decision: 'approuve' | 'refuse',
  commentaire_admin?: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Récupérer la demande + profil travailleur
  const { data: demande } = await admin
    .from('demandes_heures_sup')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('id', id)
    .single()

  if (!demande) return { error: 'Demande introuvable' }
  if (demande.statut !== 'en_attente') return { error: 'Cette demande a déjà été traitée' }

  // Si refus, le commentaire admin est obligatoire
  if (decision === 'refuse' && (!commentaire_admin || commentaire_admin.trim().length === 0)) {
    return { error: 'Un motif est obligatoire pour un refus' }
  }

  // Mettre à jour le statut
  const { error: updateError } = await admin.from('demandes_heures_sup').update({
    statut: decision,
    commentaire_admin: commentaire_admin?.trim() ?? null,
    approuve_par: adminUser.id,
    approuve_le: new Date().toISOString(),
    vu_par_travailleur: false,
  }).eq('id', id)
  if (updateError) return { error: updateError.message }

  // Si approuvé, ajouter les minutes au pot d'heures
  if (decision === 'approuve') {
    const annee = new Date(demande.date).getFullYear()

    // Upsert pot_heures : créer si n'existe pas, sinon ajouter
    const { data: existingPot } = await admin
      .from('pot_heures')
      .select('solde_minutes')
      .eq('user_id', demande.user_id)
      .eq('annee', annee)
      .single()

    if (existingPot) {
      await admin
        .from('pot_heures')
        .update({
          solde_minutes: existingPot.solde_minutes + demande.nb_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', demande.user_id)
        .eq('annee', annee)
    } else {
      await admin
        .from('pot_heures')
        .insert({
          user_id: demande.user_id,
          annee,
          solde_minutes: demande.nb_minutes,
        })
    }
  }

  const h = Math.floor(demande.nb_minutes / 60)
  const m = demande.nb_minutes % 60
  await logAudit({
    targetUserId: demande.user_id,
    actorUserId: adminUser.id,
    action: `heures_sup.${decision}`,
    category: 'heures_sup',
    description: `Heures sup ${decision === 'approuve' ? 'approuvées' : 'refusées'}: ${h}h${m > 0 ? String(m).padStart(2, '0') : ''} le ${demande.date}`,
    metadata: { date: demande.date, nb_minutes: demande.nb_minutes, decision },
    commentaire: commentaire_admin,
  })

  revalidatePath('/admin/heures-sup')
  revalidatePath('/')
  return { success: true }
}
