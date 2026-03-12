// lib/pot-heures/actions.ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PotHeures } from '@/types/database'

/** Récupère le solde de l'année courante pour l'utilisateur connecté */
export async function getSoldeHeuresAction(annee?: number): Promise<PotHeures | null> {
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

/** (Admin) Récupère le solde d'un travailleur pour une année */
export async function getSoldeHeuresWorkerAction(
  userId: string,
  annee?: number
): Promise<PotHeures | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const targetAnnee = annee ?? new Date().getFullYear()
  const admin = createAdminClient()

  const { data } = await admin
    .from('pot_heures')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', targetAnnee)
    .single()

  return data ?? null
}
