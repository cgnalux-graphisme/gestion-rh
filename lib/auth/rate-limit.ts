import { createAdminClient } from '@/lib/supabase/server'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

/**
 * Vérifie si un identifiant (email) est autorisé à tenter une action.
 * Renvoie false si le nombre de tentatives dépasse le seuil dans la fenêtre.
 */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data } = await admin
    .from('login_attempts')
    .select('attempt_count')
    .eq('identifier', identifier.toLowerCase())
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.attempt_count ?? 0) < MAX_ATTEMPTS
}

/** Enregistre une tentative échouée. */
export async function recordFailedAttempt(identifier: string): Promise<void> {
  const admin = createAdminClient()
  const key = identifier.toLowerCase()
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data: existing } = await admin
    .from('login_attempts')
    .select('id, attempt_count')
    .eq('identifier', key)
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await admin
      .from('login_attempts')
      .update({ attempt_count: existing.attempt_count + 1 })
      .eq('id', existing.id)
  } else {
    await admin
      .from('login_attempts')
      .insert({ identifier: key })
  }
}

/** Réinitialise le compteur après une connexion réussie. */
export async function resetRateLimit(identifier: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('login_attempts')
    .delete()
    .eq('identifier', identifier.toLowerCase())
}
