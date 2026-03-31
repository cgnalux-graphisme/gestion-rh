// lib/utils/dates.ts
// Fonctions pures — aucun I/O, testables sans DB

import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'

const TZ = 'Europe/Brussels'

/** Formate un objet Date local → 'YYYY-MM-DD' sans conversion UTC */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Date du jour en heure belge → 'YYYY-MM-DD' */
export function todayBrussels(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }) // sv-SE gives 'YYYY-MM-DD'
}

/** Heure courante en heure belge, arrondie à la minute → ISO UTC string (avec suffixe Z) */
export function nowBrusselsIso(): string {
  // Obtenir l'heure actuelle en timezone Brussels
  const now = new Date()
  const brusselsStr = now.toLocaleString('sv-SE', { timeZone: TZ, hour12: false })
  // brusselsStr = "YYYY-MM-DD HH:mm:ss"
  const [datePart, timePart] = brusselsStr.split(' ')
  const [h, m] = timePart.split(':')
  // Reconstruire un ISO en tant que "heure belge" puis convertir en UTC
  const fakeUtc = new Date(`${datePart}T${h}:${m}:00Z`)
  const offsetMs = getOffsetMs(fakeUtc, TZ)
  return new Date(fakeUtc.getTime() + offsetMs).toISOString()
}

/** Formate un timestamp ISO → 'HH:mm' en heure belge */
export function formatTimeBrussels(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Convertit 'YYYY-MM-DD' + 'HH:mm' locale belge → ISO UTC string */
export function localTimeToIso(date: string, time: string): string | null {
  if (!time) return null
  // Crée un Date interprété comme heure locale belge
  // En utilisant Intl pour résoudre l'offset
  const fakeUtc = new Date(`${date}T${time}:00Z`)
  const offsetMs = getOffsetMs(fakeUtc, TZ)
  return new Date(fakeUtc.getTime() + offsetMs).toISOString()
}

/** Calcule l'offset UTC d'un fuseau à un instant donné (exporté pour nowBrusselsIso) */
export function getOffsetMs(date: Date, tz: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: tz })
  return new Date(utcStr).getTime() - new Date(tzStr).getTime()
}

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
    recuperation: 'Récupération',
    maladie: 'Maladie',
    autre: 'Autre',
  }
  return labels[type] ?? type
}

/** Demi-journée → label lisible */
export function labelDemiJournee(dj: string | null): string {
  if (dj === 'matin') return 'Matin'
  if (dj === 'apres_midi') return 'Après-midi'
  return 'Journée complète'
}

/** Formate nb_jours avec support des demi-journées (0.5 → "½", 1.5 → "1½", etc.) */
export function formatNbJours(n: number): string {
  if (n === 0.5) return '½'
  if (n % 1 === 0.5) return `${Math.floor(n)}½`
  return String(n)
}

/** Statut de congé → label lisible */
export function labelStatutConge(statut: string): string {
  const labels: Record<string, string> = {
    en_attente: 'En attente',
    approuve: 'Approuvé',
    refuse: 'Refusé',
    annule: 'Annulé',
  }
  return labels[statut] ?? statut
}

/** Retourne toutes les dates ouvrables entre deux dates incluses (exclut jours fériés belges) */
export function getJoursOuvrables(debut: string, fin: string): string[] {
  const feries = joursFeriesPlage(debut, fin)
  const start = new Date(debut + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  const dates: string[] = []
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dow >= 1 && dow <= 5 && !feries.has(dateStr)) {
      dates.push(dateStr)
    }
    d.setDate(d.getDate() + 1)
  }
  return dates
}
