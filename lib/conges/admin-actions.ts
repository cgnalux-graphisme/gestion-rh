'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges, Profile } from '@/types/database'
import { getJoursOuvrables } from '@/lib/utils/dates'
import { sendCongeDecisionEmail } from '@/lib/resend/emails'

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

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

/** Toutes les demandes, toutes personnes */
export async function getAllCongesAdmin(): Promise<CongeWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .order('created_at', { ascending: false })
  return (data ?? []) as CongeWithProfile[]
}

/** Demandes en attente uniquement (pour widget dashboard) */
export async function getCongesEnAttenteAdmin(): Promise<CongeWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
    .limit(5)
  return (data ?? []) as CongeWithProfile[]
}

/** Nombre total de demandes en attente */
export async function getCongesEnAttenteCount(): Promise<number> {
  await assertAdmin()
  const admin = createAdminClient()
  const { count } = await admin
    .from('conges')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'en_attente')
  return count ?? 0
}

/** URL signée (1h) pour voir un certificat médical */
export async function getSignedUrlAdminAction(path: string): Promise<string | null> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('certificats-medicaux')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Récupère les soldes d'un travailleur (vue admin) */
export async function getSoldesCongesWorkerAdmin(
  userId: string,
  annee?: number
): Promise<SoldeConges | null> {
  await assertAdmin()
  const targetAnnee = annee ?? new Date().getFullYear()
  const admin = createAdminClient()
  const { data } = await admin
    .from('soldes_conges')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', targetAnnee)
    .single()
  return data ?? null
}

/** Modifie les soldes annuels d'un travailleur */
export async function updateSoldesCongesAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const anneeStr = formData.get('annee') as string
  const caTotal = parseInt(formData.get('conges_annuels_total') as string, 10)
  const rcTotal = parseInt(formData.get('repos_comp_total') as string, 10)

  if (!userId || !anneeStr) return { error: 'Paramètres manquants' }
  if (isNaN(caTotal) || isNaN(rcTotal)) return { error: 'Valeurs invalides' }
  if (caTotal < 0 || rcTotal < 0) return { error: 'Les soldes ne peuvent pas être négatifs' }

  const annee = parseInt(anneeStr, 10)
  const admin = createAdminClient()
  const { error } = await admin.from('soldes_conges').upsert(
    { user_id: userId, annee, conges_annuels_total: caTotal, repos_comp_total: rcTotal, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,annee' }
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

/** Approuve ou refuse une demande de congé */
export async function traiterCongeAction(
  id: string,
  decision: 'approuve' | 'refuse',
  commentaire_admin?: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Récupérer le congé + profil travailleur
  const { data: conge } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('id', id)
    .single()

  if (!conge) return { error: 'Demande introuvable' }
  if (conge.statut !== 'en_attente') return { error: 'Cette demande a déjà été traitée' }

  // Mettre à jour le statut
  const { error: updateError } = await admin.from('conges').update({
    statut: decision,
    commentaire_admin: commentaire_admin ?? null,
    approuve_par: adminUser.id,
    approuve_le: new Date().toISOString(),
  }).eq('id', id)
  if (updateError) return { error: updateError.message }

  if (decision === 'approuve') {
    const annee = new Date(conge.date_debut).getFullYear()

    // Incrémenter le compteur de jours pris dans soldes_conges
    if (conge.type === 'conge_annuel' || conge.type === 'repos_comp') {
      const { data: solde } = await admin
        .from('soldes_conges')
        .select('conges_annuels_pris, repos_comp_pris')
        .eq('user_id', conge.user_id)
        .eq('annee', annee)
        .single()

      if (solde) {
        const update =
          conge.type === 'conge_annuel'
            ? { conges_annuels_pris: solde.conges_annuels_pris + conge.nb_jours, updated_at: new Date().toISOString() }
            : { repos_comp_pris: solde.repos_comp_pris + conge.nb_jours, updated_at: new Date().toISOString() }
        await admin
          .from('soldes_conges')
          .update(update)
          .eq('user_id', conge.user_id)
          .eq('annee', annee)
      }
    }

    // Écrire les day_statuses pour chaque jour ouvrable du congé
    const statusCode: 'C' | 'M' | 'R' =
      conge.type === 'maladie' ? 'M' :
      conge.type === 'repos_comp' ? 'R' : 'C'

    const joursOuvrables = getJoursOuvrables(conge.date_debut, conge.date_fin)
    if (joursOuvrables.length > 0) {
      const upserts = joursOuvrables.map((date) => ({
        user_id: conge.user_id,
        date,
        status: statusCode,
        commentaire: `Congé approuvé #${id.slice(0, 8)}`,
        corrige_par: adminUser.id,
      }))
      await admin.from('day_statuses').upsert(upserts, { onConflict: 'user_id,date' })
    }
  }

  // Envoyer email au travailleur (non-bloquant)
  const profile = conge.profile as { prenom: string; nom: string; email: string } | null
  if (profile?.email) {
    sendCongeDecisionEmail({
      email: profile.email,
      prenom: profile.prenom,
      decision,
      type: conge.type,
      date_debut: conge.date_debut,
      date_fin: conge.date_fin,
      nb_jours: conge.nb_jours,
      commentaire_admin,
    }).catch(() => {/* email non-bloquant */})
  }

  revalidatePath('/admin/conges')
  revalidatePath('/conges')
  revalidatePath('/admin/recap')
  return { success: true }
}
