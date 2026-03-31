// lib/horaires/utils.ts
// Fonctions pures — aucun I/O, testables sans DB

import { OptionHoraire, HorairesHebdo, RegimeTravail } from '@/types/database'

/** Minutes théoriques par jour selon l'option horaire (temps plein) */
export function minutesParJour(option: OptionHoraire): number {
  return option === 'A' ? 438 : 408  // A = 7h18 = 438min, B = 6h48 = 408min
}

/**
 * Minutes théoriques par jour ajustées au régime de travail.
 * Si heures_par_jour est renseigné (mi-temps médical personnalisé), on l'utilise directement.
 * Sinon on applique le pourcentage_travail sur les minutes temps plein.
 *
 * @param option - Option horaire A ou B (base temps plein)
 * @param regime - Régime actif (null = temps plein)
 * @param jourSemaine - 1=lundi...5=vendredi (pour vérifier jour off)
 */
export function minutesParJourAvecRegime(
  option: OptionHoraire,
  regime: RegimeTravail | null,
  jourSemaine?: number
): number {
  const base = minutesParJour(option)

  if (!regime || regime.type_regime === 'temps_plein') return base

  // Suspension complète = 0 minutes
  if (regime.pourcentage_travail === 0) return 0

  // Jour off (4/5, 9/10...) : ce jour-là = 0 minutes
  if (regime.jour_off && jourSemaine === regime.jour_off) return 0

  // Mi-temps médical avec heures personnalisées par jour
  if (regime.heures_par_jour != null && regime.heures_par_jour > 0) {
    return Math.round(regime.heures_par_jour * 60)
  }

  // Appliquer le pourcentage sur la base temps plein
  // Pour 4/5 avec jour off, les 4 jours restants sont à 100%
  if (regime.jour_off) return base

  // Pour mi-temps sans jour off défini (répartition égale)
  return Math.round(base * regime.pourcentage_travail / 100)
}

/**
 * Vérifie si un jour est un jour off selon le régime actif
 */
export function isJourOff(regime: RegimeTravail | null, jourSemaine: number): boolean {
  if (!regime) return false
  return regime.jour_off === jourSemaine
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
