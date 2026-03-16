/**
 * Calcule les jours fériés belges pour une année donnée.
 * Retourne Map<"YYYY-MM-DD", "Nom du jour férié">.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function addDays(year: number, month: number, day: number, days: number): [number, number, number] {
  const d = new Date(year, month - 1, day + days)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

/**
 * Algorithme de Meeus/Jones/Butcher pour calculer le dimanche de Pâques.
 */
function paques(year: number): [number, number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [year, month, day]
}

export function joursFeries(annee: number): Map<string, string> {
  const map = new Map<string, string>()

  // Jours fixes
  map.set(toISO(annee, 1, 1), 'Nouvel An')
  map.set(toISO(annee, 5, 1), 'Fête du Travail')
  map.set(toISO(annee, 7, 21), 'Fête Nationale')
  map.set(toISO(annee, 8, 15), 'Assomption')
  map.set(toISO(annee, 11, 1), 'Toussaint')
  map.set(toISO(annee, 11, 11), 'Armistice')
  map.set(toISO(annee, 12, 25), 'Noël')

  // Jours variables (calculés depuis Pâques)
  const [py, pm, pd] = paques(annee)
  const [lpy, lpm, lpd] = addDays(py, pm, pd, 1)
  const [ay, am, ad] = addDays(py, pm, pd, 39)
  const [penty, pentm, pentd] = addDays(py, pm, pd, 50)

  map.set(toISO(lpy, lpm, lpd), 'Lundi de Pâques')
  map.set(toISO(ay, am, ad), 'Ascension')
  map.set(toISO(penty, pentm, pentd), 'Lundi de Pentecôte')

  return map
}

/**
 * Retourne la Map fusionnée pour toutes les années couvrant la plage dateDebut–dateFin.
 */
export function joursFeriesPlage(dateDebut: string, dateFin: string): Map<string, string> {
  const anneeDebut = parseInt(dateDebut.slice(0, 4))
  const anneeFin = parseInt(dateFin.slice(0, 4))
  const merged = new Map<string, string>()
  for (let y = anneeDebut; y <= anneeFin; y++) {
    joursFeries(y).forEach((v, k) => merged.set(k, v))
  }
  return merged
}
