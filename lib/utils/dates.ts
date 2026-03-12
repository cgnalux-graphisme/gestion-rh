// lib/utils/dates.ts
// Fonctions pures — aucun I/O, testables sans DB

/**
 * Calcule le nombre de jours ouvrables (lundi–vendredi) entre deux dates incluses.
 * @param debut 'YYYY-MM-DD'
 * @param fin   'YYYY-MM-DD'
 */
export function calcJoursOuvrables(debut: string, fin: string): number {
  const start = new Date(debut + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  if (start > end) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Formate 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function formatDateFr(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/** Type de congé → label lisible */
export function labelTypeConge(type: string): string {
  const labels: Record<string, string> = {
    conge_annuel: 'Congé annuel',
    repos_comp: 'Repos compensatoire',
    maladie: 'Maladie',
    autre: 'Autre',
  }
  return labels[type] ?? type
}

/** Statut de congé → label lisible */
export function labelStatutConge(statut: string): string {
  const labels: Record<string, string> = {
    en_attente: 'En attente',
    approuve: 'Approuvé',
    refuse: 'Refusé',
  }
  return labels[statut] ?? statut
}

/** Retourne toutes les dates ouvrables entre deux dates incluses */
export function getJoursOuvrables(debut: string, fin: string): string[] {
  const start = new Date(debut + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  const dates: string[] = []
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      dates.push(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() + 1)
  }
  return dates
}
