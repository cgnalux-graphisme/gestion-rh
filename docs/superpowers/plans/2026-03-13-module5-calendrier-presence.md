# Module 5 — Calendriers de présence — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter un calendrier de présence (passé + futur) par travailleur, avec double vue semaine/mois, filtres service/bureau, pour tous les utilisateurs connectés.

**Architecture:** Server Components purs pour le rendu + un seul Client Component (`CalendrierFiltres`) pour la navigation interactive via `router.push` / searchParams URL. Données agrégées depuis `day_statuses`, `conges`, `user_bureau_schedule` en une seule fonction server-side. Pas de routes API, cohérent avec M1–M4.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (PostgreSQL, RLS) · Tailwind CSS · shadcn/ui · `Date` natif (pas de librairie de dates).

**Spec:** `docs/superpowers/specs/2026-03-13-module5-calendrier-presence-design.md`

---

## File Map

| Action | Fichier | Responsabilité |
|---|---|---|
| Create | `types/calendrier.ts` | Types StatutJour, JourCalendrier, TravailleurCalendrier |
| Create | `lib/calendrier/joursFeries.ts` | Jours fériés belges (fixes + Pâques), retourne Map<ISO, nom> |
| Create | `lib/calendrier/getCalendrierData.ts` | Agrège profiles + day_statuses + conges + bureau_schedule |
| Create | `components/calendrier/StatutCell.tsx` | Badge coloré RSC par statut (présent/absent/congé/férié/weekend/vide) |
| Create | `components/calendrier/CalendrierVueSemaine.tsx` | Grille RSC 7 colonnes avec groupement par service |
| Create | `components/calendrier/CalendrierVueMois.tsx` | Grille RSC 28–31 colonnes, message mobile |
| Create | `components/calendrier/CalendrierFiltres.tsx` | Client Component : dropdowns service/bureau + switch vue + navigation |
| Create | `app/(dashboard)/calendrier/page.tsx` | RSC worker : lit searchParams, appelle getCalendrierData |
| Create | `app/(dashboard)/calendrier/loading.tsx` | Skeleton animate-pulse |
| Create | `app/(dashboard)/admin/calendrier/page.tsx` | RSC admin : même logique + vérif is_admin_rh inline |
| Create | `app/(dashboard)/admin/calendrier/loading.tsx` | Skeleton animate-pulse |
| Modify | `components/layout/Sidebar.tsx` | Mettre à jour le lien admin `/calendrier` → `/admin/calendrier` |

---

## Chunk 1 — Fondations : Types + Jours Fériés

### Task 1 : Types TypeScript pour le module calendrier

**Files:**
- Create: `types/calendrier.ts`

- [ ] **Step 1 : Créer `types/calendrier.ts`**

```ts
import type { Service, Bureau } from './database'

export type StatutJour =
  | 'present'
  | 'absent'
  | 'conge'
  | 'ferie'
  | 'weekend'
  | 'vide'

export type JourCalendrier = {
  date: string        // ISO "YYYY-MM-DD"
  statut: StatutJour
  label?: string      // nom du jour férié si ferie, type de congé si conge
}

export type TravailleurCalendrier = {
  id: string
  prenom: string
  nom: string
  service: string     // nom du service
  jours: JourCalendrier[]
}

export type CalendrierFiltresProps = {
  vue: 'semaine' | 'mois'
  date: string
  serviceId?: string
  bureauId?: string
  services: Service[]
  bureaux: Bureau[]
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add types/calendrier.ts
git commit -m "feat(types): add calendrier types (StatutJour, JourCalendrier, TravailleurCalendrier)"
```

---

### Task 2 : Jours fériés belges

**Files:**
- Create: `lib/calendrier/joursFeries.ts`

- [ ] **Step 1 : Créer `lib/calendrier/joursFeries.ts`**

```ts
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
    for (const [k, v] of joursFeries(y)) {
      merged.set(k, v)
    }
  }
  return merged
}
```

- [ ] **Step 2 : Vérifier manuellement que Pâques 2026 est correct**

Pâques 2026 = 5 avril. Lundi de Pâques = 6 avril. Ascension = 14 mai. Lundi de Pentecôte = 25 mai.

Ajouter temporairement dans la page dashboard ou vérifier via `npx ts-node` si disponible. Sinon vérifier par la logique :
- `paques(2026)` doit retourner `[2026, 4, 5]`
- `addDays(2026, 4, 5, 1)` → `[2026, 4, 6]` ✓
- `addDays(2026, 4, 5, 39)` → `[2026, 5, 14]` ✓
- `addDays(2026, 4, 5, 50)` → `[2026, 5, 25]` ✓

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add lib/calendrier/joursFeries.ts
git commit -m "feat(calendrier): add Belgian public holidays calculator (Meeus algorithm)"
```

---

## Chunk 2 — Données : getCalendrierData

### Task 3 : Fonction d'agrégation des données calendrier

**Files:**
- Create: `lib/calendrier/getCalendrierData.ts`

- [ ] **Step 1 : Créer `lib/calendrier/getCalendrierData.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { TravailleurCalendrier, JourCalendrier, StatutJour } from '@/types/calendrier'
import type { TypeConge } from '@/types/database'
import { joursFeriesPlage } from './joursFeries'

const TYPE_CONGE_LABEL: Record<TypeConge, string> = {
  conge_annuel: 'Congé annuel',
  repos_comp: 'Repos compensatoire',
  maladie: 'Maladie',
  autre: 'Autre',
}

const DAY_STATUS_MAP: Record<string, { statut: StatutJour; label?: string }> = {
  P: { statut: 'present' },
  A: { statut: 'absent' },
  C: { statut: 'conge', label: 'Congé annuel' },
  M: { statut: 'conge', label: 'Maladie' },
  R: { statut: 'conge', label: 'Repos compensatoire' },
}
// 'F' est géré séparément car le label dépend de joursFeries

type Params = {
  dateDebut: string
  dateFin: string
  serviceId?: string
  bureauId?: string
}

// Note : le retour étend la signature de la spec (TravailleurCalendrier[] uniquement)
// pour y inclure services + bureaux nécessaires aux dropdowns de CalendrierFiltres.
// Les pages (Tasks 8/9) déstructurent { travailleurs, services, bureaux }.
type GetCalendrierDataResult = {
  travailleurs: TravailleurCalendrier[]
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}

export async function getCalendrierData(params: Params): Promise<GetCalendrierDataResult> {
  const { dateDebut, dateFin, serviceId, bureauId } = params
  const supabase = createClient()

  // --- Requête 1 : profiles actifs ---
  let profilesQuery = supabase
    .from('profiles')
    .select('id, prenom, nom, service:services(id, nom)')
    .eq('is_active', true)
    .order('nom')

  if (serviceId) {
    profilesQuery = profilesQuery.eq('service_id', serviceId)
  }

  const { data: profilesData } = await profilesQuery
  const profiles = profilesData ?? []
  const userIds = profiles.map((p) => p.id)

  if (userIds.length === 0) {
    const [svc, bur] = await Promise.all([
      supabase.from('services').select('id, nom').order('nom'),
      supabase.from('bureaux').select('id, nom').order('nom'),
    ])
    return { travailleurs: [], services: svc.data ?? [], bureaux: bur.data ?? [] }
  }

  // --- Requêtes 2, 3, 4, 5 en parallèle ---
  const [dayStatusesRes, congesRes, bureauSchedulesRes, servicesRes, bureauxRes] = await Promise.all([
    // Requête 2 : day_statuses
    supabase
      .from('day_statuses')
      .select('user_id, date, status')
      .in('user_id', userIds)
      .gte('date', dateDebut)
      .lte('date', dateFin),

    // Requête 3 : conges approuvés chevauchant la plage
    supabase
      .from('conges')
      .select('user_id, type, date_debut, date_fin')
      .eq('statut', 'approuve')
      .in('user_id', userIds)
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut),

    // Requête 4 : user_bureau_schedule (toutes entrées pour ces users)
    bureauId
      ? supabase
          .from('user_bureau_schedule')
          .select('user_id, bureau_id, jour, valide_depuis')
          .in('user_id', userIds)
      : Promise.resolve({ data: null }),

    // Requête 5 : listes complètes services + bureaux
    supabase.from('services').select('id, nom').order('nom'),
    supabase.from('bureaux').select('id, nom').order('nom'),
  ])

  const dayStatuses = dayStatusesRes.data ?? []
  const conges = congesRes.data ?? []
  const bureauSchedules = bureauSchedulesRes.data ?? []
  const services = servicesRes.data ?? []
  const bureaux = bureauxRes.data ?? []

  // --- Jours fériés ---
  const feries = joursFeriesPlage(dateDebut, dateFin)

  // --- Génération de la liste de dates de la plage ---
  const dates: string[] = []
  const cur = new Date(dateDebut)
  const end = new Date(dateFin)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  // --- Index day_statuses par userId → date → record ---
  const statusIndex = new Map<string, Map<string, { status: string }>>()
  for (const ds of dayStatuses) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, { status: ds.status })
  }

  // --- Index conges par userId → liste ---
  const congesIndex = new Map<string, typeof conges>()
  for (const c of conges) {
    if (!congesIndex.has(c.user_id)) congesIndex.set(c.user_id, [])
    congesIndex.get(c.user_id)!.push(c)
  }

  // --- Index bureau_schedule par userId → jourSemaine → liste triée par valide_depuis desc ---
  const bureauIndex = new Map<string, Map<number, typeof bureauSchedules>>()
  if (bureauId) {
    for (const bs of bureauSchedules) {
      if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
      const byJour = bureauIndex.get(bs.user_id)!
      if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
      byJour.get(bs.jour)!.push(bs)
    }
    // Trier chaque liste par valide_depuis DESC
    for (const byJour of bureauIndex.values()) {
      for (const list of byJour.values()) {
        list.sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis))
      }
    }
  }

  // --- Calculer le statut d'un jour pour un travailleur ---
  function getStatut(userId: string, date: string): JourCalendrier {
    const d = new Date(date)
    const dow = d.getDay() // 0=dim, 1=lun, ..., 6=sam

    // Priorité 1 : Weekend
    if (dow === 0 || dow === 6) return { date, statut: 'weekend' }

    // Priorité 2 : Jour férié
    const ferieNom = feries.get(date)
    if (ferieNom) return { date, statut: 'ferie', label: ferieNom }

    // Filtre bureau : si bureauId et ce jour n'est pas dans le bureau → vide
    if (bureauId) {
      const jourIso = dow // 1=lun...5=ven (dow === 0 ou 6 déjà exclus)
      const byJour = bureauIndex.get(userId)
      const list = byJour?.get(jourIso) ?? []
      // Trouver l'entrée valide_depuis <= date la plus récente
      const entry = list.find((bs) => bs.valide_depuis <= date) ?? null
      if (!entry || entry.bureau_id !== bureauId) {
        return { date, statut: 'vide' }
      }
    }

    // Priorité 3 : Congé approuvé couvrant cette date
    const mesConges = congesIndex.get(userId) ?? []
    const conge = mesConges.find((c) => c.date_debut <= date && c.date_fin >= date)
    if (conge) {
      return {
        date,
        statut: 'conge',
        label: TYPE_CONGE_LABEL[conge.type as TypeConge] ?? 'Congé',
      }
    }

    // Priorité 4 : DayStatusRecord
    const ds = statusIndex.get(userId)?.get(date)
    if (ds) {
      if (ds.status === 'F') {
        // Si on atteint ici, la date n'est pas dans joursFeries (priorité 2 l'aurait pris avant)
        // donc le label est toujours générique
        return { date, statut: 'ferie', label: 'Jour férié' }
      }
      const mapped = DAY_STATUS_MAP[ds.status]
      if (mapped) return { date, statut: mapped.statut, label: mapped.label }
    }

    // Priorité 5 : Vide
    return { date, statut: 'vide' }
  }

  // --- Assembler les travailleurs ---
  // Filtrer : si bureauId, inclure un travailleur uniquement s'il apparaît dans le bureau pour ≥1 jour ouvrable
  const travailleurs: TravailleurCalendrier[] = []

  for (const profile of profiles) {
    const jours = dates.map((date) => getStatut(profile.id, date))

    if (bureauId) {
      // Un travailleur apparaît si au moins un jour de la période l'inclut dans ce bureau
      const hasAnyBureauDay = dates.some((date) => {
        const d = new Date(date)
        const dow = d.getDay()
        if (dow === 0 || dow === 6) return false
        if (feries.get(date)) return false
        const jourIso = dow
        const byJour = bureauIndex.get(profile.id)
        const list = byJour?.get(jourIso) ?? []
        const entry = list.find((bs) => bs.valide_depuis <= date) ?? null
        return entry?.bureau_id === bureauId
      })
      if (!hasAnyBureauDay) continue
    }

    travailleurs.push({
      id: profile.id,
      prenom: profile.prenom,
      nom: profile.nom,
      service: (profile.service as { nom: string } | null)?.nom ?? '',
      jours,
    })
  }

  return { travailleurs, services, bureaux }
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add lib/calendrier/getCalendrierData.ts
git commit -m "feat(calendrier): add getCalendrierData server function (aggregates day_statuses, conges, bureau_schedule)"
```

---

## Chunk 3 — Composants UI

### Task 4 : StatutCell — badge coloré

**Files:**
- Create: `components/calendrier/StatutCell.tsx`

- [ ] **Step 1 : Créer `components/calendrier/StatutCell.tsx`**

```tsx
import type { StatutJour } from '@/types/calendrier'

const CONFIG: Record<StatutJour, { bg: string; text: string; letter: string; tooltip?: string }> = {
  present: { bg: 'bg-green-100', text: 'text-green-800', letter: 'P', tooltip: 'Présent' },
  absent: { bg: 'bg-red-100', text: 'text-red-800', letter: 'A', tooltip: 'Absent' },
  conge: { bg: 'bg-orange-100', text: 'text-orange-800', letter: 'C' },
  ferie: { bg: 'bg-blue-100', text: 'text-blue-800', letter: 'F' },
  weekend: { bg: 'bg-gray-100', text: 'text-gray-300', letter: '' },
  vide: { bg: 'bg-white', text: 'text-gray-200', letter: '', tooltip: 'Non renseigné' },
}

type Props = {
  statut: StatutJour
  label?: string
  size?: 'sm' | 'md'
}

export default function StatutCell({ statut, label, size = 'md' }: Props) {
  const cfg = CONFIG[statut]
  const tooltip = label ?? cfg.tooltip

  const sizeClass = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-xs'

  return (
    <div
      className={`${sizeClass} ${cfg.bg} ${cfg.text} font-medium rounded flex items-center justify-center flex-shrink-0`}
      title={tooltip}
    >
      {cfg.letter}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add components/calendrier/StatutCell.tsx
git commit -m "feat(calendrier): add StatutCell component"
```

---

### Task 5 : CalendrierVueSemaine

**Files:**
- Create: `components/calendrier/CalendrierVueSemaine.tsx`

- [ ] **Step 1 : Créer `components/calendrier/CalendrierVueSemaine.tsx`**

```tsx
import React from 'react'
import type { TravailleurCalendrier } from '@/types/calendrier'
import StatutCell from './StatutCell'

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Props = {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string  // lundi ISO de la semaine
}

function formatColHeader(dateISO: string): string {
  // Parser en UTC pour éviter le décalage timezone
  const [, , day] = dateISO.split('-').map(Number)
  const d = new Date(dateISO + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const jour = JOURS_COURTS[dow === 0 ? 6 : dow - 1]
  return `${jour} ${day}`
}

export default function CalendrierVueSemaine({ travailleurs, dateDebut }: Props) {
  // Générer les 7 dates de la semaine en UTC
  const dates: string[] = []
  const [y, m, d] = dateDebut.split('-').map(Number)
  for (let i = 0; i < 7; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i))
    dates.push(dt.toISOString().slice(0, 10))
  }

  // Grouper par service
  const services: string[] = []
  const byService = new Map<string, TravailleurCalendrier[]>()
  for (const t of travailleurs) {
    if (!byService.has(t.service)) {
      services.push(t.service)
      byService.set(t.service, [])
    }
    byService.get(t.service)!.push(t)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[140px]">
              Travailleur
            </th>
            {dates.map((date) => (
              <th key={date} className="px-1 py-2 text-center font-medium text-gray-500 min-w-[40px]">
                {formatColHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <React.Fragment key={service}>
              <tr>
                <td
                  colSpan={8}
                  className="sticky left-0 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {service}
                </td>
              </tr>
              {byService.get(service)!.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white z-10 px-3 py-1.5 text-sm text-gray-700 whitespace-nowrap">
                    {t.prenom} {t.nom}
                  </td>
                  {t.jours.map((jour) => (
                    <td key={jour.date} className="px-1 py-1.5 text-center">
                      <StatutCell statut={jour.statut} label={jour.label} size="md" />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
          {travailleurs.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                Aucun travailleur trouvé pour ces filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add components/calendrier/CalendrierVueSemaine.tsx
git commit -m "feat(calendrier): add CalendrierVueSemaine RSC grid"
```

---

### Task 6 : CalendrierVueMois

**Files:**
- Create: `components/calendrier/CalendrierVueMois.tsx`

- [ ] **Step 1 : Créer `components/calendrier/CalendrierVueMois.tsx`**

```tsx
import React from 'react'
import type { TravailleurCalendrier } from '@/types/calendrier'
import StatutCell from './StatutCell'

type Props = {
  travailleurs: TravailleurCalendrier[]
  dateDebut: string  // 1er du mois ISO
}

function nomAbregé(prenom: string, nom: string): string {
  return `${prenom[0]}. ${nom}`
}

export default function CalendrierVueMois({ travailleurs, dateDebut }: Props) {
  // Générer toutes les dates du mois en UTC
  const [year, month] = dateDebut.split('-').map(Number)
  const nbJours = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const dates: string[] = []
  for (let d = 1; d <= nbJours; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  // Grouper par service
  const services: string[] = []
  const byService = new Map<string, TravailleurCalendrier[]>()
  for (const t of travailleurs) {
    if (!byService.has(t.service)) {
      services.push(t.service)
      byService.set(t.service, [])
    }
    byService.get(t.service)!.push(t)
  }

  return (
    <>
      {/* Message mobile */}
      <p className="md:hidden text-sm text-gray-500 p-4">
        La vue mensuelle n&apos;est pas disponible sur mobile. Utilisez la vue semaine.
      </p>

      {/* Grille desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-medium text-gray-500 min-w-[120px]">
                Travailleur
              </th>
              {dates.map((date) => (
                <th key={date} className="px-0.5 py-2 text-center font-medium text-gray-400 min-w-[28px]">
                  {parseInt(date.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <React.Fragment key={service}>
                <tr>
                  <td
                    colSpan={dates.length + 1}
                    className="sticky left-0 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {service}
                  </td>
                </tr>
                {byService.get(service)!.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white z-10 px-3 py-1 text-xs text-gray-700 whitespace-nowrap">
                      {nomAbregé(t.prenom, t.nom)}
                    </td>
                    {t.jours.map((jour) => (
                      <td key={jour.date} className="px-0.5 py-1 text-center">
                        <StatutCell statut={jour.statut} label={jour.label} size="sm" />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {travailleurs.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} className="text-center py-8 text-gray-400">
                  Aucun travailleur trouvé pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add components/calendrier/CalendrierVueMois.tsx
git commit -m "feat(calendrier): add CalendrierVueMois RSC grid"
```

---

### Task 7 : CalendrierFiltres (Client Component)

**Files:**
- Create: `components/calendrier/CalendrierFiltres.tsx`

- [ ] **Step 1 : Créer `components/calendrier/CalendrierFiltres.tsx`**

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { CalendrierFiltresProps } from '@/types/calendrier'

// Toutes les opérations sur les dates ISO utilisent UTC pour éviter les décalages timezone.

function isoToUtc(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function utcToIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

/** Retourne le lundi (ISO UTC) de la semaine contenant dateIso. */
function getLundiSemaine(dateIso: string): string {
  const [y, m, d] = isoToUtc(dateIso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=dim
  const diff = dow === 0 ? -6 : 1 - dow
  return utcToIso(y, m, d + diff)
}

function formatPeriodeLabel(vue: 'semaine' | 'mois', date: string): string {
  // Utiliser les composants ISO directement pour éviter les décalages timezone
  const [y, m, d] = isoToUtc(date)
  if (vue === 'mois') {
    const dt = new Date(Date.UTC(y, m - 1, 1))
    return dt.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  // Vue semaine : du lundi au dimanche
  const lundiDt = new Date(Date.UTC(y, m - 1, d))
  const dimancheDt = new Date(Date.UTC(y, m - 1, d + 6))
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'UTC' }
  const lundiStr = lundiDt.toLocaleDateString('fr-BE', opts)
  const dimancheStr = dimancheDt.toLocaleDateString('fr-BE', { ...opts, year: 'numeric' })
  return `Semaine du ${lundiStr} au ${dimancheStr}`
}

export default function CalendrierFiltres({
  vue,
  date,
  serviceId,
  bureauId,
  services,
  bureaux,
}: CalendrierFiltresProps) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { vue, date, serviceId, bureauId, ...updates }
    if (merged.vue) params.set('vue', merged.vue)
    if (merged.date) params.set('date', merged.date)
    if (merged.serviceId) params.set('service', merged.serviceId)
    if (merged.bureauId) params.set('bureau', merged.bureauId)
    router.push(`${pathname}?${params.toString()}`)
  }

  function navigatePrev() {
    // date est toujours le lundi de la semaine (normalisé par la page)
    if (vue === 'semaine') {
      const [y, m, d] = isoToUtc(date)
      navigate({ date: utcToIso(y, m, d - 7) })
    } else {
      const [y, m] = isoToUtc(date)
      const prev = new Date(Date.UTC(y, m - 2, 1)) // m-2 car mois 0-indexé
      navigate({ date: `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  function navigateNext() {
    if (vue === 'semaine') {
      const [y, m, d] = isoToUtc(date)
      navigate({ date: utcToIso(y, m, d + 7) })
    } else {
      const [y, m] = isoToUtc(date)
      const next = new Date(Date.UTC(y, m, 1)) // m car mois 0-indexé → mois suivant
      navigate({ date: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  function navigateAujourdhui() {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const d = today.getDate()
    const todayIso = utcToIso(y, m, d)
    if (vue === 'semaine') {
      navigate({ date: getLundiSemaine(todayIso) })
    } else {
      navigate({ date: `${y}-${String(m).padStart(2, '0')}-01` })
    }
  }

  function switchVue(newVue: 'semaine' | 'mois') {
    const [y, m, d] = isoToUtc(date)
    let newDate: string
    if (newVue === 'mois') {
      // Lundi → 1er du mois contenant ce lundi (tout en UTC)
      newDate = `${y}-${String(m).padStart(2, '0')}-01`
    } else {
      // 1er du mois → lundi de la semaine contenant le 1er
      newDate = getLundiSemaine(utcToIso(y, m, d))
    }
    navigate({ vue: newVue, date: newDate })
  }

  const btnBase = 'px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600'
  const selectBase = 'text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#e53e3e]/30'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Navigation période */}
      <div className="flex items-center gap-1">
        <button onClick={navigatePrev} className={btnBase} title="Période précédente">←</button>
        <span className="text-sm font-medium text-gray-700 px-2 min-w-[220px] text-center">
          {formatPeriodeLabel(vue, date)}
        </span>
        <button onClick={navigateNext} className={btnBase} title="Période suivante">→</button>
        <button onClick={navigateAujourdhui} className={`${btnBase} ml-1`}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 ml-auto">
        <select
          className={selectBase}
          value={serviceId ?? ''}
          onChange={(e) => navigate({ serviceId: e.target.value || undefined })}
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>

        <select
          className={selectBase}
          value={bureauId ?? ''}
          onChange={(e) => navigate({ bureauId: e.target.value || undefined })}
        >
          <option value="">Tous les bureaux</option>
          {bureaux.map((b) => (
            <option key={b.id} value={b.id}>{b.nom}</option>
          ))}
        </select>

        {/* Switch vue */}
        <div className="flex rounded border border-gray-200 overflow-hidden">
          {(['semaine', 'mois'] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchVue(v)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                vue === v
                  ? 'bg-[#1a2332] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add components/calendrier/CalendrierFiltres.tsx
git commit -m "feat(calendrier): add CalendrierFiltres client component (navigation + filters)"
```

---

## Chunk 4 — Pages + Navigation + RLS

### Task 8 : Page worker `/calendrier`

**Files:**
- Create: `app/(dashboard)/calendrier/page.tsx`
- Create: `app/(dashboard)/calendrier/loading.tsx`

- [ ] **Step 1 : Créer `app/(dashboard)/calendrier/loading.tsx`**

```tsx
export default function CalendrierLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
      <div className="h-10 bg-gray-100 rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/calendrier/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCalendrierData } from '@/lib/calendrier/getCalendrierData'
import CalendrierFiltres from '@/components/calendrier/CalendrierFiltres'
import CalendrierVueSemaine from '@/components/calendrier/CalendrierVueSemaine'
import CalendrierVueMois from '@/components/calendrier/CalendrierVueMois'

function getLundiSemaine(d: Date): string {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const lundi = new Date(d)
  lundi.setDate(d.getDate() + diff)
  return lundi.toISOString().slice(0, 10)
}

function getPremierDuMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type SearchParams = {
  vue?: string
  date?: string
  service?: string
  bureau?: string
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { vue: vueParam, date: dateParam, service, bureau } = await searchParams

  const vue = vueParam === 'mois' ? 'mois' : 'semaine'
  const today = new Date()

  // Date de référence par défaut selon la vue
  const defaultDate = vue === 'semaine'
    ? getLundiSemaine(today)
    : getPremierDuMois(today)

  const date = dateParam ?? defaultDate
  const serviceId = service
  const bureauId = bureau

  // Calcul de la plage selon la vue
  let dateDebut: string
  let dateFin: string

  if (vue === 'semaine') {
    dateDebut = getLundiSemaine(new Date(date))
    const fin = new Date(dateDebut)
    fin.setDate(fin.getDate() + 6)
    dateFin = fin.toISOString().slice(0, 10)
  } else {
    const d = new Date(date)
    dateDebut = getPremierDuMois(d)
    const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    dateFin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(nbJours).padStart(2, '0')}`
  }

  const { travailleurs, services, bureaux } = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId,
    bureauId,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">📅 Calendrier de présence</h1>
      <CalendrierFiltres
        vue={vue}
        date={dateDebut}
        serviceId={serviceId}
        bureauId={bureauId}
        services={services}
        bureaux={bureaux}
      />
      {vue === 'semaine' ? (
        <CalendrierVueSemaine travailleurs={travailleurs} dateDebut={dateDebut} />
      ) : (
        <CalendrierVueMois travailleurs={travailleurs} dateDebut={dateDebut} />
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add app/(dashboard)/calendrier/page.tsx app/(dashboard)/calendrier/loading.tsx
git commit -m "feat(pages): add /calendrier worker page with week/month views and filters"
```

---

### Task 9 : Page admin `/admin/calendrier`

**Files:**
- Create: `app/(dashboard)/admin/calendrier/page.tsx`
- Create: `app/(dashboard)/admin/calendrier/loading.tsx`

- [ ] **Step 1 : Créer `app/(dashboard)/admin/calendrier/loading.tsx`**

Même contenu que le loading worker :

```tsx
export default function AdminCalendrierLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
      <div className="h-10 bg-gray-100 rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/admin/calendrier/page.tsx`**

Copier la logique de la page worker et ajouter la vérification admin :

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCalendrierData } from '@/lib/calendrier/getCalendrierData'
import CalendrierFiltres from '@/components/calendrier/CalendrierFiltres'
import CalendrierVueSemaine from '@/components/calendrier/CalendrierVueSemaine'
import CalendrierVueMois from '@/components/calendrier/CalendrierVueMois'

function getLundiSemaine(d: Date): string {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const lundi = new Date(d)
  lundi.setDate(d.getDate() + diff)
  return lundi.toISOString().slice(0, 10)
}

function getPremierDuMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type SearchParams = {
  vue?: string
  date?: string
  service?: string
  bureau?: string
}

export default async function AdminCalendrierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const { vue: vueParam, date: dateParam, service, bureau } = await searchParams

  const vue = vueParam === 'mois' ? 'mois' : 'semaine'
  const today = new Date()

  const defaultDate = vue === 'semaine'
    ? getLundiSemaine(today)
    : getPremierDuMois(today)

  const date = dateParam ?? defaultDate
  const serviceId = service
  const bureauId = bureau

  let dateDebut: string
  let dateFin: string

  if (vue === 'semaine') {
    dateDebut = getLundiSemaine(new Date(date))
    const fin = new Date(dateDebut)
    fin.setDate(fin.getDate() + 6)
    dateFin = fin.toISOString().slice(0, 10)
  } else {
    const d = new Date(date)
    dateDebut = getPremierDuMois(d)
    const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    dateFin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(nbJours).padStart(2, '0')}`
  }

  const { travailleurs, services, bureaux } = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId,
    bureauId,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">📅 Calendrier de présence</h1>
      <CalendrierFiltres
        vue={vue}
        date={dateDebut}
        serviceId={serviceId}
        bureauId={bureauId}
        services={services}
        bureaux={bureaux}
      />
      {vue === 'semaine' ? (
        <CalendrierVueSemaine travailleurs={travailleurs} dateDebut={dateDebut} />
      ) : (
        <CalendrierVueMois travailleurs={travailleurs} dateDebut={dateDebut} />
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add "app/(dashboard)/admin/calendrier/page.tsx" "app/(dashboard)/admin/calendrier/loading.tsx"
git commit -m "feat(pages): add /admin/calendrier page with admin guard"
```

---

### Task 10 : Navigation Sidebar + RLS

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- RLS check via MCP Supabase

- [ ] **Step 1 : Mettre à jour le lien admin dans Sidebar**

Dans `components/layout/Sidebar.tsx`, ligne 22, changer le href admin calendrier de `/calendrier` vers `/admin/calendrier` :

```tsx
// Avant
{ href: '/calendrier', icon: '📅', label: 'Calendrier' },

// Après (dans adminLinks uniquement)
{ href: '/admin/calendrier', icon: '📅', label: 'Calendrier' },
```

Le lien worker (`workerLinks`) reste sur `/calendrier`.

- [ ] **Step 2 : Vérifier la politique RLS sur `profiles`**

Via MCP Supabase (`execute_sql`), vérifier si une politique SELECT ouverte aux utilisateurs authentifiés existe déjà sur `profiles` :

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';
```

Si aucune politique `SELECT` n'autorise les workers à lire tous les profils actifs, appliquer via `apply_migration` :

```sql
-- Nom migration: "allow_authenticated_read_active_profiles"
CREATE POLICY "Authenticated users can read active profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_active = true);
```

> ⚠️ Vérifier d'abord si une politique similaire existe déjà pour éviter les conflits.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(nav): update admin sidebar calendar link to /admin/calendrier"
```

---

### Task 11 : Vérification finale sur le dev server

- [ ] **Step 1 : Lancer le dev server**

```bash
npm run dev
```

- [ ] **Step 2 : Vérifier la page worker `/calendrier`**

- Naviguer vers `http://localhost:3009/calendrier`
- Vérifier que la grille semaine s'affiche avec les bons travailleurs
- Vérifier les couleurs des cellules (présent = vert, absent = rouge, congé = orange, etc.)
- Naviguer avec les flèches ← → et vérifier que la semaine change
- Cliquer "Aujourd'hui" et vérifier que ça revient à la semaine courante
- Basculer en vue Mois et vérifier la grille mensuelle
- Tester le filtre service (ex : sélectionner "Juridique") → seuls les travailleurs du service s'affichent
- Tester le filtre bureau (ex : "Namur") → seuls les travailleurs assignés à Namur apparaissent

- [ ] **Step 3 : Vérifier la page admin `/admin/calendrier`**

- Naviguer vers `http://localhost:3009/admin/calendrier` avec un compte admin
- Vérifier que l'accès est possible
- Naviguer vers `http://localhost:3009/admin/calendrier` avec un compte worker → doit rediriger vers `/`

- [ ] **Step 4 : Vérifier le lien sidebar**

- En tant qu'admin, vérifier que le lien "Calendrier" dans la sidebar pointe vers `/admin/calendrier`
- En tant que worker, vérifier qu'il pointe vers `/calendrier`

- [ ] **Step 5 : Vérifier sur mobile (DevTools)**

- En vue semaine : scroll horizontal fonctionnel, colonne noms sticky visible
- En vue mois : message "La vue mensuelle n'est pas disponible sur mobile" s'affiche

- [ ] **Step 6 : Commit final**

```bash
git add -A
git commit -m "chore: module 5 calendrier présence — vérification finale"
```

---

## Récapitulatif des fichiers créés/modifiés

| Fichier | Type |
|---|---|
| `types/calendrier.ts` | Créé |
| `lib/calendrier/joursFeries.ts` | Créé |
| `lib/calendrier/getCalendrierData.ts` | Créé |
| `components/calendrier/StatutCell.tsx` | Créé |
| `components/calendrier/CalendrierVueSemaine.tsx` | Créé |
| `components/calendrier/CalendrierVueMois.tsx` | Créé |
| `components/calendrier/CalendrierFiltres.tsx` | Créé |
| `app/(dashboard)/calendrier/page.tsx` | Créé |
| `app/(dashboard)/calendrier/loading.tsx` | Créé |
| `app/(dashboard)/admin/calendrier/page.tsx` | Créé |
| `app/(dashboard)/admin/calendrier/loading.tsx` | Créé |
| `components/layout/Sidebar.tsx` | Modifié (lien admin) |
| Migration RLS `profiles` | Conditionnelle |
