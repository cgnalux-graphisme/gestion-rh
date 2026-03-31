'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { CorrectionPointage } from '@/types/database'
import { localTimeToIso } from '@/lib/utils/dates'
import { logAudit } from '@/lib/audit/logger'

// ─── Worker actions ───

/** Soumet une demande de correction de pointage */
export async function demanderCorrectionPointageAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const date = formData.get('date') as string
  const champ = formData.get('champ') as string
  const heure_proposee = formData.get('heure_proposee') as string
  const motif = formData.get('motif') as string

  if (!date || !champ || !heure_proposee || !motif) {
    return { error: 'Tous les champs sont obligatoires' }
  }

  const validChamps = ['arrivee', 'midi_out', 'midi_in', 'depart']
  if (!validChamps.includes(champ)) {
    return { error: 'Champ de pointage invalide' }
  }

  // Vérifier qu'il n'y a pas déjà une demande en attente pour cette date + champ
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('corrections_pointage')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('champ', champ)
    .eq('statut', 'en_attente')
    .maybeSingle()

  if (existing) {
    return { error: 'Une demande de correction est déjà en attente pour ce champ et cette date' }
  }

  const { error } = await admin.from('corrections_pointage').insert({
    user_id: user.id,
    date,
    champ,
    heure_proposee,
    motif,
  })

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: 'pointage.demande_correction',
    category: 'pointage',
    description: `Demande correction pointage: ${champ} → ${heure_proposee} le ${date}`,
    metadata: { date, champ, heure_proposee },
  })

  revalidatePath('/pointage')
  revalidatePath('/admin/calendrier')
  return { success: true }
}

/** Récupère les demandes de correction du travailleur connecté */
export async function getMesCorrectionsAction(): Promise<CorrectionPointage[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('corrections_pointage')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as CorrectionPointage[]
}

// ─── Admin actions ───

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

/** Récupère les corrections en attente (pour badge admin) */
export async function getCorrectionsEnAttenteCount(): Promise<number> {
  await assertAdmin()
  const admin = createAdminClient()
  const { count } = await admin
    .from('corrections_pointage')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'en_attente')

  return count ?? 0
}

/** Récupère les corrections en attente avec profil */
export async function getCorrectionsEnAttenteAdmin(): Promise<CorrectionPointage[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('corrections_pointage')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })

  return (data ?? []) as CorrectionPointage[]
}

export type TraiterCorrectionOptions = {
  /** Heure à appliquer si approuvé (heure bureau ou heure proposée) */
  heureAppliquee?: string  // 'HH:mm'
  /** Minutes à déduire du pot d'heures si refus avec déduction */
  minutesDeduites?: number
}

/** Traiter une correction : approuver (corrige le pointage) ou refuser (optionnellement déduire du pot) */
export async function traiterCorrectionAction(
  correctionId: string,
  decision: 'approuve' | 'refuse',
  commentaire_admin?: string,
  options?: TraiterCorrectionOptions
): Promise<{ error?: string }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Récupérer la correction
  const { data: correction } = await admin
    .from('corrections_pointage')
    .select('*')
    .eq('id', correctionId)
    .single()

  if (!correction) return { error: 'Correction introuvable' }
  if (correction.statut !== 'en_attente') return { error: 'Cette correction a déjà été traitée' }

  let heure_corrigee: string | null = null

  // Si approuvé, corriger le pointage automatiquement
  if (decision === 'approuve') {
    const time = options?.heureAppliquee ?? correction.heure_proposee
    heure_corrigee = time
    const isoTime = localTimeToIso(correction.date, time)

    const { error: pointageError } = await admin.from('pointage').upsert(
      {
        user_id: correction.user_id,
        date: correction.date,
        [correction.champ]: isoTime,
      },
      { onConflict: 'user_id,date' }
    )
    if (pointageError) return { error: `Erreur lors de la correction du pointage : ${pointageError.message}` }

    // Marquer le champ comme corrigé dans pointage.corrections_appliquees
    const { data: currentPointage } = await admin
      .from('pointage')
      .select('corrections_appliquees')
      .eq('user_id', correction.user_id)
      .eq('date', correction.date)
      .single()

    const currentCorrections = (currentPointage?.corrections_appliquees as Record<string, boolean>) ?? {}
    await admin.from('pointage').update({
      corrections_appliquees: { ...currentCorrections, [correction.champ]: true },
    }).eq('user_id', correction.user_id).eq('date', correction.date)
  }

  // Si refusé avec déduction du pot d'heures
  let minutes_deduites: number | null = null
  if (decision === 'refuse' && options?.minutesDeduites && options.minutesDeduites > 0) {
    minutes_deduites = options.minutesDeduites
    const annee = parseInt(correction.date.slice(0, 4))

    // Déduire du pot d'heures
    const { data: pot } = await admin
      .from('pot_heures')
      .select('solde_minutes')
      .eq('user_id', correction.user_id)
      .eq('annee', annee)
      .maybeSingle()

    const currentSolde = pot?.solde_minutes ?? 0
    const newSolde = currentSolde - minutes_deduites
    if (newSolde < 0) {
      return { error: `Pot d'heures insuffisant (${currentSolde} min disponibles, ${minutes_deduites} min requises)` }
    }
    await admin.from('pot_heures').upsert(
      {
        user_id: correction.user_id,
        annee,
        solde_minutes: newSolde,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,annee' }
    )

    await logAudit({
      targetUserId: correction.user_id,
      actorUserId: adminUser.id,
      action: 'pot_heures.deduction_correction',
      category: 'pot_heures',
      description: `Déduction ${minutes_deduites}min du pot heures suite à correction refusée (${correction.champ} le ${correction.date})`,
      metadata: { date: correction.date, champ: correction.champ, minutes_deduites },
    })
  }

  // Mettre à jour le statut de la demande
  const { error } = await admin
    .from('corrections_pointage')
    .update({
      statut: decision,
      commentaire_admin: commentaire_admin ?? null,
      traite_par: adminUser.id,
      traite_le: new Date().toISOString(),
      vu_par_travailleur: false,
      heure_corrigee,
      minutes_deduites,
    })
    .eq('id', correctionId)

  if (error) return { error: error.message }

  await logAudit({
    targetUserId: correction.user_id,
    actorUserId: adminUser.id,
    action: `pointage.correction_${decision}`,
    category: 'pointage',
    description: `Correction pointage ${decision === 'approuve' ? 'approuvée' : 'refusée'}: ${correction.champ} → ${heure_corrigee ?? correction.heure_proposee} le ${correction.date}${minutes_deduites ? ` (${minutes_deduites}min déduites)` : ''}`,
    metadata: { date: correction.date, champ: correction.champ, heure_proposee: correction.heure_proposee, decision, heure_corrigee, minutes_deduites },
    commentaire: commentaire_admin,
  })

  revalidatePath('/admin/calendrier')
  revalidatePath('/pointage')
  return {}
}
