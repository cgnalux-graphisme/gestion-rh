'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuditLog, AuditCategory } from '@/types/database'

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

export async function getHistoriqueTravailleur(
  userId: string,
  options?: { category?: AuditCategory; limit?: number; offset?: number }
): Promise<{ logs: AuditLog[]; total: number }> {
  await assertAdmin()
  const admin = createAdminClient()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = admin
    .from('audit_log')
    .select('*, actor:profiles!actor_user_id(prenom, nom)', { count: 'exact' })
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  const { data, count } = await query
  return {
    logs: (data ?? []) as AuditLog[],
    total: count ?? 0,
  }
}

export type StatsAnnee = {
  annee: number
  jours_conge: number
  jours_maladie: number
  jours_recup: number
  total_absences: number
  jours_ouvrables: number
  taux_presence: number
}

export async function getStatsTravailleur(
  userId: string
): Promise<StatsAnnee[]> {
  await assertAdmin()
  const admin = createAdminClient()

  // Get all day_statuses for this user
  const { data: dayStatuses } = await admin
    .from('day_statuses')
    .select('date, status')
    .eq('user_id', userId)

  if (!dayStatuses || dayStatuses.length === 0) return []

  // Get profile date_entree
  const { data: profile } = await admin
    .from('profiles')
    .select('date_entree')
    .eq('id', userId)
    .single()

  // Group by year
  const byYear = new Map<number, { C: number; M: number; R: number; P: number; total: number }>()

  for (const ds of dayStatuses) {
    const annee = parseInt(ds.date.slice(0, 4))
    if (!byYear.has(annee)) {
      byYear.set(annee, { C: 0, M: 0, R: 0, P: 0, total: 0 })
    }
    const year = byYear.get(annee)!
    year.total++
    if (ds.status === 'C') year.C++
    else if (ds.status === 'M') year.M++
    else if (ds.status === 'R') year.R++
    else if (ds.status === 'P') year.P++
  }

  // Calculate approximate working days per year
  const stats: StatsAnnee[] = []
  const entreeYear = profile?.date_entree
    ? parseInt(profile.date_entree.slice(0, 4))
    : null

  for (const [annee, counts] of Array.from(byYear.entries())) {
    // Estimate working days: ~261 per full year, pro-rata if entry year
    let joursOuvrables = 261
    if (entreeYear && annee === entreeYear && profile?.date_entree) {
      const entreeDate = new Date(profile.date_entree)
      const endOfYear = new Date(annee, 11, 31)
      const daysInYear = 365
      const daysWorked = Math.ceil(
        (endOfYear.getTime() - entreeDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      joursOuvrables = Math.round((daysWorked / daysInYear) * 261)
    }

    const totalAbsences = counts.C + counts.M + counts.R
    const joursPresence = joursOuvrables - totalAbsences
    const tauxPresence = joursOuvrables > 0
      ? Math.round((joursPresence / joursOuvrables) * 1000) / 10
      : 0

    stats.push({
      annee,
      jours_conge: counts.C,
      jours_maladie: counts.M,
      jours_recup: counts.R,
      total_absences: totalAbsences,
      jours_ouvrables: joursOuvrables,
      taux_presence: tauxPresence,
    })
  }

  // Sort by year descending
  stats.sort((a, b) => b.annee - a.annee)
  return stats
}
