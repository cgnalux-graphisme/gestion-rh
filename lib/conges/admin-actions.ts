'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges, Profile } from '@/types/database'
import { getJoursOuvrables } from '@/lib/utils/dates'
import { sendCongeDecisionEmail, sendReassignationEmail } from '@/lib/resend/emails'
import { formatDateFr } from '@/lib/utils/dates'
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
  const adminUser = await assertAdmin()
  const userId = formData.get('user_id') as string
  const anneeStr = formData.get('annee') as string
  const caTotal = parseInt(formData.get('conges_annuels_total') as string, 10)
  const rcTotal = parseInt(formData.get('repos_comp_total') as string, 10)
  const reliquatCA = parseInt(formData.get('reliquat_conges_annuels') as string, 10) || 0
  const reliquatRC = parseInt(formData.get('reliquat_repos_comp') as string, 10) || 0

  if (!userId || !anneeStr) return { error: 'Paramètres manquants' }
  if (isNaN(caTotal) || isNaN(rcTotal)) return { error: 'Valeurs invalides' }
  if (caTotal < 0 || rcTotal < 0 || reliquatCA < 0 || reliquatRC < 0) return { error: 'Les soldes ne peuvent pas être négatifs' }

  const annee = parseInt(anneeStr, 10)
  const admin = createAdminClient()
  const { error } = await admin.from('soldes_conges').upsert(
    {
      user_id: userId,
      annee,
      conges_annuels_total: caTotal,
      repos_comp_total: rcTotal,
      reliquat_conges_annuels: reliquatCA,
      reliquat_repos_comp: reliquatRC,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,annee' }
  )
  if (error) return { error: error.message }

  const commentaire = (formData.get('commentaire_admin') as string) || null
  await logAudit({
    targetUserId: userId,
    actorUserId: adminUser.id,
    action: 'conges.soldes_modifies',
    category: 'conges',
    description: `Soldes congés ${annee} modifiés: CA=${caTotal}, RC=${rcTotal}`,
    metadata: { annee, conges_annuels_total: caTotal, repos_comp_total: rcTotal, reliquat_ca: reliquatCA, reliquat_rc: reliquatRC },
    commentaire,
  })

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
    vu_par_travailleur: false,
  }).eq('id', id)
  if (updateError) return { error: updateError.message }

  if (decision === 'approuve') {
    const annee = new Date(conge.date_debut).getFullYear()

    // Incrémenter le compteur de jours pris dans soldes_conges (UPDATE atomique via RPC)
    if (conge.type === 'conge_annuel' || conge.type === 'repos_comp') {
      const champ = conge.type === 'conge_annuel' ? 'conges_annuels_pris' : 'repos_comp_pris'
      const { error: rpcError } = await admin.rpc('incrementer_solde_conges', {
        p_user_id: conge.user_id,
        p_annee: annee,
        p_champ: champ,
        p_delta: conge.nb_jours,
      })
      if (rpcError) return { error: `Erreur mise à jour solde: ${rpcError.message}` }
    }

    // Si récupération : déduire du pot d'heures (nb_jours * minutes théoriques/jour)
    if (conge.type === 'recuperation') {
      // Récupérer l'option horaire du travailleur
      const { data: workerProfile } = await admin
        .from('profiles')
        .select('option_horaire')
        .eq('id', conge.user_id)
        .single()

      const option = workerProfile?.option_horaire ?? 'B'
      const minutesParJourVal = option === 'A' ? 438 : 408
      const minutesADeduire = conge.nb_jours * minutesParJourVal

      const { data: pot } = await admin
        .from('pot_heures')
        .select('solde_minutes')
        .eq('user_id', conge.user_id)
        .eq('annee', annee)
        .single()

      if (pot) {
        const newSolde = pot.solde_minutes - minutesADeduire
        if (newSolde < 0) {
          return { error: `Pot d'heures insuffisant (${pot.solde_minutes} min disponibles, ${minutesADeduire} min requises)` }
        }
        await admin
          .from('pot_heures')
          .update({
            solde_minutes: newSolde,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', conge.user_id)
          .eq('annee', annee)
      }
    }

    // Écrire les day_statuses pour chaque jour ouvrable du congé
    const statusCode: 'C' | 'M' | 'R' =
      conge.type === 'maladie' ? 'M' :
      (conge.type === 'repos_comp' || conge.type === 'recuperation') ? 'R' : 'C'

    const joursOuvrables = getJoursOuvrables(conge.date_debut, conge.date_fin)
    if (joursOuvrables.length > 0) {
      const demiLabel = conge.demi_journee === 'matin' ? ' (matin)' : conge.demi_journee === 'apres_midi' ? ' (après-midi)' : ''
      const upserts = joursOuvrables.map((date) => ({
        user_id: conge.user_id,
        date,
        status: statusCode,
        commentaire: `Congé approuvé #${id.slice(0, 8)}${demiLabel}`,
        corrige_par: adminUser.id,
      }))
      await admin.from('day_statuses').upsert(upserts, { onConflict: 'user_id,date' })
    }
  }

  // Envoyer email au travailleur (non-bloquant, avec logging en cas d'échec)
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
      demi_journee: conge.demi_journee,
      commentaire_admin,
    }).catch((err) => {
      console.error('[sendCongeDecisionEmail] Échec envoi:', err)
      logAudit({
        targetUserId: conge.user_id,
        actorUserId: adminUser.id,
        action: 'email.echec',
        category: 'admin',
        description: `Échec envoi email décision congé à ${profile.email}`,
        metadata: { error: String(err), conge_id: id, decision },
      }).catch(() => {})
    })
  }

  await logAudit({
    targetUserId: conge.user_id,
    actorUserId: adminUser.id,
    action: `conge.${decision}`,
    category: 'conges',
    description: `Congé ${decision === 'approuve' ? 'approuvé' : 'refusé'}: ${conge.type} du ${conge.date_debut} au ${conge.date_fin} (${conge.nb_jours}j)`,
    metadata: { type: conge.type, date_debut: conge.date_debut, date_fin: conge.date_fin, nb_jours: conge.nb_jours, demi_journee: conge.demi_journee, decision },
    commentaire: commentaire_admin,
  })

  revalidatePath('/admin/conges')
  revalidatePath('/conges')
  revalidatePath('/admin/recap')
  return { success: true }
}

/** Approuve ou refuse une demande d'annulation de congé */
export async function traiterAnnulationCongeAction(
  annulationId: string,
  decision: 'approuve' | 'refuse',
  commentaire_admin?: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  if (decision === 'refuse' && !commentaire_admin?.trim()) {
    return { error: 'Un commentaire est obligatoire pour refuser une annulation' }
  }

  const { data: annulation } = await admin
    .from('annulations_conges')
    .select('*, conge:conges!conge_id(*, profile:profiles!user_id(prenom, nom, email))')
    .eq('id', annulationId)
    .single()

  if (!annulation) return { error: 'Demande introuvable' }
  if (annulation.statut !== 'en_attente') return { error: 'Cette demande a déjà été traitée' }

  if (decision === 'approuve') {
    // Appel RPC atomique
    const { error: rpcError } = await admin.rpc('approuver_annulation_conge', {
      p_annulation_id: annulationId,
      p_admin_id: adminUser.id,
    })
    if (rpcError) return { error: rpcError.message }
  } else {
    // Refus simple
    const { error: updateError } = await admin
      .from('annulations_conges')
      .update({
        statut: 'refuse',
        commentaire_admin: commentaire_admin?.trim() ?? null,
        traite_par: adminUser.id,
        traite_le: new Date().toISOString(),
      })
      .eq('id', annulationId)
    if (updateError) return { error: updateError.message }
  }

  const conge = annulation.conge as Conge & { profile: { prenom: string; nom: string; email: string } | null }

  // Email notification (non-bloquant)
  if (conge?.profile?.email) {
    sendCongeDecisionEmail({
      email: conge.profile.email,
      prenom: conge.profile.prenom,
      decision: decision === 'approuve' ? 'refuse' : 'approuve', // inversé: annulation approuvée = congé annulé
      type: conge.type,
      date_debut: conge.date_debut,
      date_fin: conge.date_fin,
      nb_jours: conge.nb_jours,
      commentaire_admin: decision === 'approuve'
        ? 'Votre demande d\'annulation a été acceptée. Le congé est annulé.'
        : `Votre demande d'annulation a été refusée. ${commentaire_admin ?? ''}`,
    }).catch((err) => {
      console.error('[sendCongeDecisionEmail] Échec envoi annulation:', err)
      logAudit({
        targetUserId: annulation.user_id,
        actorUserId: adminUser.id,
        action: 'email.echec',
        category: 'admin',
        description: `Échec envoi email annulation congé à ${conge.profile?.email}`,
        metadata: { error: String(err), annulation_id: annulationId, decision },
      }).catch(() => {})
    })
  }

  await logAudit({
    targetUserId: annulation.user_id,
    actorUserId: adminUser.id,
    action: `conge.annulation_${decision}`,
    category: 'conges',
    description: `Annulation ${decision === 'approuve' ? 'approuvée' : 'refusée'} pour congé #${annulation.conge_id.slice(0, 8)}`,
    metadata: { annulation_id: annulationId, conge_id: annulation.conge_id, decision },
    commentaire: commentaire_admin,
  })

  revalidatePath('/admin/conges')
  revalidatePath('/conges')
  return { success: true }
}

/** Crée une réaffectation temporaire pour couvrir un congé */
export async function creerReassignation(
  congeId: string,
  travailleurId: string,
  bureauId: string,
  date: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Récupérer le congé avec le profil du demandeur
  const { data: conge } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom)')
    .eq('id', congeId)
    .single()
  if (!conge) return { error: 'Congé introuvable' }

  // Récupérer le profil du travailleur à réaffecter
  const { data: travailleur } = await admin
    .from('profiles')
    .select('prenom, nom, email')
    .eq('id', travailleurId)
    .single()
  if (!travailleur) return { error: 'Travailleur introuvable' }

  // Récupérer le nom du bureau
  const { data: bureau } = await admin
    .from('bureaux')
    .select('nom')
    .eq('id', bureauId)
    .single()
  if (!bureau) return { error: 'Bureau introuvable' }

  // Insérer la réaffectation
  const { error: insertError } = await admin
    .from('reassignations_temporaires')
    .insert({
      conge_id: congeId,
      travailleur_id: travailleurId,
      bureau_id: bureauId,
      date,
      statut: 'en_attente',
      vu_par_travailleur: false,
      cree_par: adminUser.id,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Une réaffectation existe déjà pour ce travailleur à cette date et ce bureau' }
    }
    return { error: insertError.message }
  }

  const congeProfile = conge.profile as { prenom: string; nom: string } | null

  await logAudit({
    targetUserId: travailleurId,
    actorUserId: adminUser.id,
    action: 'reassignation.creation',
    category: 'admin',
    description: `Réaffectation créée: ${travailleur.prenom} ${travailleur.nom} → ${bureau.nom} le ${formatDateFr(date)}`,
    metadata: { conge_id: congeId, bureau_id: bureauId, date },
  })

  // Email non-bloquant
  if (travailleur.email) {
    sendReassignationEmail({
      email: travailleur.email,
      prenom: travailleur.prenom,
      bureauNom: bureau.nom,
      date: formatDateFr(date),
      raisonPrenom: congeProfile?.prenom ?? '',
      raisonNom: congeProfile?.nom ?? '',
    }).catch((err) => {
      console.error('[sendReassignationEmail] Échec envoi:', err)
      logAudit({
        targetUserId: travailleurId,
        actorUserId: adminUser.id,
        action: 'email.echec',
        category: 'admin',
        description: `Échec envoi email réaffectation à ${travailleur.email}`,
        metadata: { error: String(err), conge_id: congeId },
      }).catch(() => {})
    })
  }

  revalidatePath('/admin/conges')
  return { success: true }
}
