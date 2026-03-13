// lib/horaires/utils.ts
// Fonctions pures — aucun I/O, testables sans DB

import { OptionHoraire, HorairesHebdo } from '@/types/database'

/** Minutes théoriques par jour selon l'option horaire */
export function minutesParJour(option: OptionHoraire): number {
  return option === 'A' ? 438 : 408  // A = 7h18 = 438min, B = 6h48 = 408min
}

/** Formate des minutes en "Xh Ymin" (ex: 90 → "1h 30min", -45 → "-45min", 0 → "0min") */
export function formatMinutes(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes)
  const sign = totalMinutes < 0 ? '-' : ''
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (abs === 0) return '0min'
  if (h === 0) return `${sign}${m}min`
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h ${m}min`
}

/** Retourne true si la date est en période été (juillet ou août) */
export function isEte(date: Date): boolean {
  const month = date.getMonth() + 1  // getMonth() = 0-indexed
  return month === 7 || month === 8
}

/** Retourne les horaires du jour depuis un objet HorairesHebdo */
export function getHorairesJour(
  horaires: HorairesHebdo,
  jour: 1 | 2 | 3 | 4 | 5
) {
  return horaires[String(jour) as keyof HorairesHebdo]
}

/** Détermine si on est après la deadline de changement d'option (15 décembre) */
export function isApresDeadlineChangementOption(date: Date = new Date()): boolean {
  return date.getMonth() === 11 && date.getDate() > 15
}

/** Label complet d'une option horaire */
export function labelOptionHoraire(option: OptionHoraire): string {
  if (option === 'A') return 'Option A — 36,5h/semaine (7h18/jour)'
  return 'Option B — 34h/semaine (6h48/jour)'
}
