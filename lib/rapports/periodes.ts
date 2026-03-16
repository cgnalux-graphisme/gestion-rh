import type { PeriodeType } from '@/types/rapports'

/**
 * Calcule la plage de dates [dateDebut, dateFin] selon le type de période.
 * Toutes les dates sont en ISO "YYYY-MM-DD".
 */
export function calculerPlage(
  periodeType: PeriodeType,
  periodeDate: string
): { dateDebut: string; dateFin: string } {
  const [y, m] = periodeDate.split('-').map(Number)

  if (periodeType === 'mois') {
    const debut = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate() // dernier jour du mois
    const fin = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { dateDebut: debut, dateFin: fin }
  }

  if (periodeType === 'trimestre') {
    // T1: jan-mar, T2: avr-jun, T3: jul-sep, T4: oct-dec
    const q = Math.ceil(m / 3)
    const moisDebut = (q - 1) * 3 + 1
    const moisFin = q * 3
    const debut = `${y}-${String(moisDebut).padStart(2, '0')}-01`
    const lastDay = new Date(y, moisFin, 0).getDate()
    const fin = `${y}-${String(moisFin).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { dateDebut: debut, dateFin: fin }
  }

  // annee
  return { dateDebut: `${y}-01-01`, dateFin: `${y}-12-31` }
}

/**
 * Label lisible pour la période.
 */
export function labelPeriode(periodeType: PeriodeType, periodeDate: string): string {
  const [y, m] = periodeDate.split('-').map(Number)

  if (periodeType === 'mois') {
    const dt = new Date(y, m - 1, 1)
    const moisNom = dt.toLocaleDateString('fr-BE', { month: 'long' })
    return `${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)} ${y}`
  }

  if (periodeType === 'trimestre') {
    const q = Math.ceil(m / 3)
    return `T${q} ${y}`
  }

  return `${y}`
}

/**
 * Calcule la periodeDate suivante/précédente selon le type.
 */
export function navigatePeriode(
  periodeType: PeriodeType,
  periodeDate: string,
  direction: 'prev' | 'next'
): string {
  const [y, m] = periodeDate.split('-').map(Number)
  const delta = direction === 'next' ? 1 : -1

  if (periodeType === 'mois') {
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  if (periodeType === 'trimestre') {
    const d = new Date(y, m - 1 + delta * 3, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  // annee
  return `${y + delta}-01-01`
}

/**
 * Retourne la periodeDate "aujourd'hui" normalisée selon le type.
 */
export function periodeDateAujourdhui(periodeType: PeriodeType): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}
