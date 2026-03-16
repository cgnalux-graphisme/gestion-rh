# Module 6 — Rapports, Exports & Statistiques — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter une page admin centralisée `/admin/rapports` avec 4 blocs de statistiques (taux de présence, absences par type, top absences, pot d'heures), 5 exports en Excel + PDF, et des filtres par période/service/bureau.

**Architecture:** Server Components purs pour le rendu des stats + deux Client Components (filtres et exports). Données agrégées via une fonction server-side `getStatsData`. Exports générés côté serveur via Server Actions avec `exceljs` (Excel) et `jspdf` + `jspdf-autotable` (PDF), retournés en base64. Pattern identique aux modules 1–5.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (PostgreSQL, RLS) · Tailwind CSS · shadcn/ui · `exceljs` · `jspdf` + `jspdf-autotable`

**Spec:** `docs/superpowers/specs/2026-03-16-module6-rapports-exports-stats-design.md`

---

## File Map

| Action | Fichier | Responsabilité |
|---|---|---|
| Create | `types/rapports.ts` | Types PeriodeType, StatsData, ExportParams |
| Create | `lib/rapports/periodes.ts` | Calcul plage de dates depuis periodeType + periodeDate |
| Create | `lib/rapports/getStatsData.ts` | Agrège stats depuis day_statuses, profiles, pot_heures |
| Create | `lib/rapports/exports.ts` | 10 Server Actions exports (5 types × 2 formats) |
| Create | `lib/rapports/export-data.ts` | 5 fonctions de collecte de données pour les exports |
| Create | `lib/rapports/export-excel.ts` | Formateur Excel générique (exceljs) |
| Create | `lib/rapports/export-pdf.ts` | Formateur PDF générique (jspdf + autotable) |
| Create | `components/rapports/RapportsFiltres.tsx` | Client Component : période/service/bureau + navigation |
| Create | `components/rapports/TauxPresenceChart.tsx` | RSC : barres CSS horizontales par service |
| Create | `components/rapports/AbsencesParTypeChart.tsx` | RSC : donut SVG inline + légende |
| Create | `components/rapports/TopAbsences.tsx` | RSC : liste ordonnée top 5 |
| Create | `components/rapports/PotHeuresChart.tsx` | RSC : barres positives/négatives par service |
| Create | `components/rapports/ExportsSection.tsx` | Client Component : boutons de téléchargement |
| Create | `app/(dashboard)/admin/rapports/page.tsx` | RSC principal, lit searchParams, orchestre tout |
| Create | `app/(dashboard)/admin/rapports/loading.tsx` | Skeleton animate-pulse |
| Modify | `components/layout/Sidebar.tsx` | Lien Rapports → `/admin/rapports` |

---

## Chunk 1 — Fondations : Dépendances + Types + Utilitaire périodes

### Task 1 : Installer les dépendances

**Files:**
- Modify: `package.json`

- [ ] **Step 1 : Installer exceljs, jspdf, jspdf-autotable**

```bash
cd /c/Users/cgnal/Documents/.Applications/gestion_rh
npm install exceljs jspdf jspdf-autotable
```

- [ ] **Step 2 : Vérifier l'installation**

```bash
node -e "require('exceljs'); require('jspdf'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add exceljs, jspdf, jspdf-autotable for M6 exports"
```

---

### Task 2 : Types TypeScript pour le module rapports

**Files:**
- Create: `types/rapports.ts`

- [ ] **Step 1 : Créer `types/rapports.ts`**

```ts
export type PeriodeType = 'mois' | 'trimestre' | 'annee'

export type ExportParams = {
  periodeType: PeriodeType
  periodeDate: string   // ISO "YYYY-MM-DD"
  serviceId?: string
  bureauId?: string
}

export type TauxPresenceService = {
  service: string
  serviceId: string
  taux: number
  joursPresent: number
  joursOuvrables: number
}

export type AbsenceParType = {
  type: string
  label: string
  count: number
  couleur: string
}

export type TopAbsenceEntry = {
  prenom: string
  nom: string
  service: string
  joursMaladie: number
  joursAbsent: number
  total: number
}

export type PotHeuresService = {
  service: string
  serviceId: string
  moyenneMinutes: number
  nbTravailleurs: number
}

export type StatsData = {
  tauxPresence: TauxPresenceService[]
  tauxGlobal: number
  absencesParType: AbsenceParType[]
  totalAbsences: number
  topAbsences: TopAbsenceEntry[]
  potHeures: PotHeuresService[]
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: pas d'erreurs liées à `types/rapports.ts`

- [ ] **Step 3 : Commit**

```bash
git add types/rapports.ts
git commit -m "feat(rapports): add TypeScript types for M6 stats and exports"
```

---

### Task 3 : Utilitaire de calcul de périodes

**Files:**
- Create: `lib/rapports/periodes.ts`

- [ ] **Step 1 : Créer `lib/rapports/periodes.ts`**

```ts
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
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: pas d'erreurs

- [ ] **Step 3 : Commit**

```bash
git add lib/rapports/periodes.ts
git commit -m "feat(rapports): add period calculation utilities"
```

---

## Chunk 2 — Couche données stats + Page + Composants visuels

### Task 4 : Fonction `getStatsData`

**Files:**
- Create: `lib/rapports/getStatsData.ts`

Référence : `lib/calendrier/getCalendrierData.ts` pour le pattern de requêtes parallèles et le filtre bureau.

- [ ] **Step 1 : Créer `lib/rapports/getStatsData.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'
import { calculerPlage } from './periodes'
import type { PeriodeType, StatsData } from '@/types/rapports'

const ABSENCE_MAP: Record<string, { label: string; couleur: string }> = {
  C: { label: 'Congé annuel', couleur: '#f59e0b' },
  M: { label: 'Maladie', couleur: '#ef4444' },
  R: { label: 'Repos compensatoire', couleur: '#6c63ff' },
  A: { label: 'Absent non justifié', couleur: '#f97316' },
}

type Params = {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
}

export async function getStatsData(params: Params): Promise<StatsData> {
  const { periodeType, periodeDate, serviceId, bureauId } = params
  const { dateDebut, dateFin } = calculerPlage(periodeType, periodeDate)
  const annee = parseInt(periodeDate.slice(0, 4))
  const supabase = createClient()

  // --- Requête 1 : profiles actifs ---
  let profilesQuery = supabase
    .from('profiles')
    .select('id, prenom, nom, service_id, service:services(id, nom)')
    .eq('is_active', true)
    .order('nom')

  if (serviceId) {
    profilesQuery = profilesQuery.eq('service_id', serviceId)
  }

  const { data: profilesData } = await profilesQuery
  const profiles = profilesData ?? []
  const userIds = profiles.map((p) => p.id)

  // Charger services + bureaux pour les filtres
  const [servicesRes, bureauxRes] = await Promise.all([
    supabase.from('services').select('id, nom').order('nom'),
    supabase.from('bureaux').select('id, nom').order('nom'),
  ])
  const services = servicesRes.data ?? []
  const bureaux = bureauxRes.data ?? []

  if (userIds.length === 0) {
    return {
      tauxPresence: [], tauxGlobal: 0,
      absencesParType: [], totalAbsences: 0,
      topAbsences: [],
      potHeures: [],
      services, bureaux,
    }
  }

  // --- Requêtes 2, 3, 4 en parallèle ---
  const [dayStatusesRes, potHeuresRes, bureauSchedulesRes] = await Promise.all([
    supabase
      .from('day_statuses')
      .select('user_id, date, status')
      .in('user_id', userIds)
      .gte('date', dateDebut)
      .lte('date', dateFin),
    supabase
      .from('pot_heures')
      .select('user_id, solde_minutes')
      .in('user_id', userIds)
      .eq('annee', annee),
    bureauId
      ? supabase
          .from('user_bureau_schedule')
          .select('user_id, bureau_id, jour, valide_depuis')
          .in('user_id', userIds)
      : Promise.resolve({ data: null }),
  ])

  const dayStatuses = dayStatusesRes.data ?? []
  const potHeuresData = potHeuresRes.data ?? []
  const bureauSchedules = bureauSchedulesRes.data ?? []

  // --- Jours fériés + jours ouvrables ---
  const feries = joursFeriesPlage(dateDebut, dateFin)
  const joursOuvrablesList: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    if (dow >= 1 && dow <= 5 && !feries.has(iso)) {
      joursOuvrablesList.push(iso)
    }
    cur.setDate(cur.getDate() + 1)
  }
  const joursOuvrables = joursOuvrablesList.length

  // --- Filtre bureau : construire index ---
  const bureauIndex = new Map<string, Map<number, { bureau_id: string; valide_depuis: string }[]>>()
  if (bureauId) {
    for (const bs of bureauSchedules) {
      if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
      const byJour = bureauIndex.get(bs.user_id)!
      if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
      byJour.get(bs.jour)!.push(bs)
    }
    bureauIndex.forEach((byJour) => {
      byJour.forEach((list) => {
        list.sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis))
      })
    })
  }

  // Déterminer quels travailleurs sont retenus (et pour quels jours)
  function isUserInBureau(userId: string, dateIso: string): boolean {
    if (!bureauId) return true
    const d = new Date(dateIso + 'T00:00:00')
    const dow = d.getDay()
    if (dow === 0 || dow === 6) return false
    const byJour = bureauIndex.get(userId)
    const list = byJour?.get(dow) ?? []
    const entry = list.find((bs) => bs.valide_depuis <= dateIso) ?? null
    return entry?.bureau_id === bureauId
  }

  // Filtrer les profiles si bureauId est fourni
  const filteredProfiles = bureauId
    ? profiles.filter((p) =>
        joursOuvrablesList.some((d) => isUserInBureau(p.id, d))
      )
    : profiles

  // --- Index day_statuses par userId → date → status ---
  const statusIndex = new Map<string, Map<string, string>>()
  for (const ds of dayStatuses) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, ds.status)
  }

  // --- TAUX DE PRÉSENCE par service ---
  const serviceMap = new Map<string, { nom: string; id: string; present: number; workers: number }>()
  let totalPresent = 0
  let totalWorkerDays = 0

  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string; nom: string } | null)
    const svcId = svc?.id ?? p.service_id
    const svcNom = svc?.nom ?? 'Inconnu'
    if (!serviceMap.has(svcId)) serviceMap.set(svcId, { nom: svcNom, id: svcId, present: 0, workers: 0 })
    const entry = serviceMap.get(svcId)!
    entry.workers++

    const userStatuses = statusIndex.get(p.id)
    let userPresent = 0
    for (const d of joursOuvrablesList) {
      if (bureauId && !isUserInBureau(p.id, d)) continue
      if (userStatuses?.get(d) === 'P') userPresent++
    }
    entry.present += userPresent
    totalPresent += userPresent
    totalWorkerDays += bureauId
      ? joursOuvrablesList.filter((d) => isUserInBureau(p.id, d)).length
      : joursOuvrables
  }

  // Calculer les jours effectifs par service (tenant compte du filtre bureau)
  const serviceDaysMap = new Map<string, number>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string } | null)
    const svcId = svc?.id ?? p.service_id
    const prevDays = serviceDaysMap.get(svcId) ?? 0
    const effectiveDays = bureauId
      ? joursOuvrablesList.filter((d) => isUserInBureau(p.id, d)).length
      : joursOuvrables
    serviceDaysMap.set(svcId, prevDays + effectiveDays)
  }

  const tauxPresence = Array.from(serviceMap.values()).map((s) => {
    const denominator = serviceDaysMap.get(s.id) ?? (joursOuvrables * s.workers)
    return {
      service: s.nom,
      serviceId: s.id,
      taux: denominator > 0 ? Math.round((s.present / denominator) * 100) : 0,
      joursPresent: s.present,
      joursOuvrables: denominator,
    }
  })
  const tauxGlobal = totalWorkerDays > 0 ? Math.round((totalPresent / totalWorkerDays) * 100) : 0

  // --- ABSENCES PAR TYPE ---
  const absenceCounts: Record<string, number> = { C: 0, M: 0, R: 0, A: 0 }
  const filteredUserIds = new Set(filteredProfiles.map((p) => p.id))
  for (const ds of dayStatuses) {
    if (!filteredUserIds.has(ds.user_id)) continue
    if (bureauId && !isUserInBureau(ds.user_id, ds.date)) continue
    if (ds.status in absenceCounts) {
      absenceCounts[ds.status]++
    }
  }
  const absencesParType = Object.entries(ABSENCE_MAP).map(([type, meta]) => ({
    type,
    label: meta.label,
    count: absenceCounts[type] ?? 0,
    couleur: meta.couleur,
  }))
  const totalAbsences = Object.values(absenceCounts).reduce((a, b) => a + b, 0)

  // --- TOP ABSENCES ---
  const userAbsences = new Map<string, { prenom: string; nom: string; service: string; m: number; a: number }>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { nom: string } | null)?.nom ?? 'Inconnu'
    userAbsences.set(p.id, { prenom: p.prenom, nom: p.nom, service: svc, m: 0, a: 0 })
  }
  for (const ds of dayStatuses) {
    const entry = userAbsences.get(ds.user_id)
    if (!entry) continue
    if (bureauId && !isUserInBureau(ds.user_id, ds.date)) continue
    if (ds.status === 'M') entry.m++
    if (ds.status === 'A') entry.a++
  }
  const topAbsences = Array.from(userAbsences.values())
    .map((e) => ({
      prenom: e.prenom,
      nom: e.nom,
      service: e.service,
      joursMaladie: e.m,
      joursAbsent: e.a,
      total: e.m + e.a,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // --- POT D'HEURES PAR SERVICE ---
  const potIndex = new Map<string, number>()
  for (const ph of potHeuresData) {
    potIndex.set(ph.user_id, ph.solde_minutes)
  }

  const potServiceMap = new Map<string, { nom: string; id: string; total: number; count: number }>()
  for (const p of filteredProfiles) {
    const svc = (p.service as unknown as { id: string; nom: string } | null)
    const svcId = svc?.id ?? p.service_id
    const svcNom = svc?.nom ?? 'Inconnu'
    if (!potServiceMap.has(svcId)) potServiceMap.set(svcId, { nom: svcNom, id: svcId, total: 0, count: 0 })
    const entry = potServiceMap.get(svcId)!
    entry.count++
    entry.total += potIndex.get(p.id) ?? 0
  }
  const potHeures = Array.from(potServiceMap.values()).map((s) => ({
    service: s.nom,
    serviceId: s.id,
    moyenneMinutes: s.count > 0 ? Math.round(s.total / s.count) : 0,
    nbTravailleurs: s.count,
  }))

  return {
    tauxPresence, tauxGlobal,
    absencesParType, totalAbsences,
    topAbsences,
    potHeures,
    services, bureaux,
  }
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: pas d'erreurs

- [ ] **Step 3 : Commit**

```bash
git add lib/rapports/getStatsData.ts
git commit -m "feat(rapports): add getStatsData server-side data aggregation"
```

---

### Task 5 : Composant `RapportsFiltres` (Client Component)

**Files:**
- Create: `components/rapports/RapportsFiltres.tsx`

Référence : `components/calendrier/CalendrierFiltres.tsx` pour le pattern `router.push` + searchParams.

- [ ] **Step 1 : Créer `components/rapports/RapportsFiltres.tsx`**

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { labelPeriode, navigatePeriode, periodeDateAujourdhui } from '@/lib/rapports/periodes'
import type { PeriodeType } from '@/types/rapports'

type Props = {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}

export default function RapportsFiltres({
  periodeType,
  periodeDate,
  serviceId,
  bureauId,
  services,
  bureaux,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { periode: periodeType, date: periodeDate, service: serviceId, bureau: bureauId, ...updates }
    if (merged.periode) params.set('periode', merged.periode)
    if (merged.date) params.set('date', merged.date)
    if (merged.service) params.set('service', merged.service)
    if (merged.bureau) params.set('bureau', merged.bureau)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handlePrev() {
    navigate({ date: navigatePeriode(periodeType, periodeDate, 'prev') })
  }

  function handleNext() {
    navigate({ date: navigatePeriode(periodeType, periodeDate, 'next') })
  }

  function handleAujourdhui() {
    navigate({ date: periodeDateAujourdhui(periodeType) })
  }

  function handlePeriodeTypeChange(newType: string) {
    navigate({ periode: newType, date: periodeDateAujourdhui(newType as PeriodeType) })
  }

  const btnBase = 'px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600'
  const selectBase = 'text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#e53e3e]/30'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {/* Navigation période */}
      <div className="flex items-center gap-1">
        <button onClick={handlePrev} className={btnBase} title="Période précédente">←</button>
        <span className="text-sm font-medium text-gray-700 px-2 min-w-[180px] text-center">
          {labelPeriode(periodeType, periodeDate)}
        </span>
        <button onClick={handleNext} className={btnBase} title="Période suivante">→</button>
        <button onClick={handleAujourdhui} className={`${btnBase} ml-1`}>
          Aujourd&apos;hui
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Type de période */}
        <div className="flex rounded border border-gray-200 overflow-hidden">
          {(['mois', 'trimestre', 'annee'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handlePeriodeTypeChange(t)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                periodeType === t
                  ? 'bg-[#1a2332] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'annee' ? 'Année' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <select
          className={selectBase}
          value={serviceId ?? ''}
          onChange={(e) => navigate({ service: e.target.value || undefined })}
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>

        <select
          className={selectBase}
          value={bureauId ?? ''}
          onChange={(e) => navigate({ bureau: e.target.value || undefined })}
        >
          <option value="">Tous les bureaux</option>
          {bureaux.map((b) => (
            <option key={b.id} value={b.id}>{b.nom}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/rapports/RapportsFiltres.tsx
git commit -m "feat(rapports): add RapportsFiltres client component"
```

---

### Task 6 : 4 composants statistiques RSC

**Files:**
- Create: `components/rapports/TauxPresenceChart.tsx`
- Create: `components/rapports/AbsencesParTypeChart.tsx`
- Create: `components/rapports/TopAbsences.tsx`
- Create: `components/rapports/PotHeuresChart.tsx`

- [ ] **Step 1 : Créer `components/rapports/TauxPresenceChart.tsx`**

```tsx
import type { TauxPresenceService } from '@/types/rapports'

export default function TauxPresenceChart({
  tauxPresence,
  tauxGlobal,
}: {
  tauxPresence: TauxPresenceService[]
  tauxGlobal: number
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-gray-900">{tauxGlobal}%</span>
        <span className="text-sm text-gray-500">Taux de présence global</span>
      </div>
      <div className="space-y-3">
        {tauxPresence.map((s) => (
          <div key={s.serviceId}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{s.service}</span>
              <span>{s.taux}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${s.taux}%` }}
              />
            </div>
          </div>
        ))}
        {tauxPresence.length === 0 && (
          <p className="text-xs text-gray-400">Aucune donnée sur la période</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `components/rapports/AbsencesParTypeChart.tsx`**

```tsx
import type { AbsenceParType } from '@/types/rapports'

export default function AbsencesParTypeChart({
  absencesParType,
  totalAbsences,
}: {
  absencesParType: AbsenceParType[]
  totalAbsences: number
}) {
  // Donut SVG
  const radius = 50
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const segments = absencesParType
    .filter((a) => a.count > 0)
    .map((a) => {
      const pct = totalAbsences > 0 ? a.count / totalAbsences : 0
      const dashArray = pct * circumference
      const seg = { ...a, dashArray, dashOffset: -offset }
      offset += dashArray
      return seg
    })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Absences par type</h3>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            {/* Fond gris */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
            {/* Segments */}
            {segments.map((seg) => (
              <circle
                key={seg.type}
                cx="60" cy="60" r={radius}
                fill="none"
                stroke={seg.couleur}
                strokeWidth="16"
                strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-700">{totalAbsences}</span>
          </div>
        </div>

        {/* Légende */}
        <div className="space-y-2">
          {absencesParType.map((a) => (
            <div key={a.type} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.couleur }} />
              <span className="text-gray-600">{a.label}</span>
              <span className="font-semibold text-gray-800 ml-auto">{a.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Créer `components/rapports/TopAbsences.tsx`**

```tsx
import type { TopAbsenceEntry } from '@/types/rapports'

export default function TopAbsences({ topAbsences }: { topAbsences: TopAbsenceEntry[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Top 5 — Absences (maladie + non justifié)
      </h3>
      {topAbsences.length === 0 ? (
        <p className="text-xs text-gray-400">Aucune absence sur la période</p>
      ) : (
        <ol className="space-y-2">
          {topAbsences.map((e, i) => (
            <li key={`${e.prenom}-${e.nom}`} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0">
                {i + 1}
              </span>
              <span className="font-medium text-gray-800">
                {e.prenom} {e.nom}
              </span>
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">
                {e.service}
              </span>
              <span className="ml-auto text-gray-600">
                {e.total}j ({e.joursMaladie} maladie, {e.joursAbsent} non justifié)
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
```

- [ ] **Step 4 : Créer `components/rapports/PotHeuresChart.tsx`**

```tsx
import type { PotHeuresService } from '@/types/rapports'
import { formatMinutes } from '@/lib/horaires/utils'

export default function PotHeuresChart({ potHeures }: { potHeures: PotHeuresService[] }) {
  const maxAbs = Math.max(...potHeures.map((s) => Math.abs(s.moyenneMinutes)), 1)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Pot d&apos;heures par service</h3>
      <div className="space-y-3">
        {potHeures.map((s) => {
          const pct = Math.round((Math.abs(s.moyenneMinutes) / maxAbs) * 50)
          const isPositive = s.moyenneMinutes >= 0
          return (
            <div key={s.serviceId}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{s.service} ({s.nbTravailleurs})</span>
                <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                  {isPositive ? '+' : ''}{formatMinutes(s.moyenneMinutes)} (moy.)
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full relative">
                {/* Ligne centrale */}
                <div className="absolute left-1/2 top-0 w-px h-2 bg-gray-300" />
                {/* Barre */}
                <div
                  className={`absolute top-0 h-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{
                    left: isPositive ? '50%' : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
        {potHeures.length === 0 && (
          <p className="text-xs text-gray-400">Aucune donnée sur la période</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 6 : Commit**

```bash
git add components/rapports/TauxPresenceChart.tsx components/rapports/AbsencesParTypeChart.tsx components/rapports/TopAbsences.tsx components/rapports/PotHeuresChart.tsx
git commit -m "feat(rapports): add 4 stats chart RSC components"
```

---

### Task 7 : Page `/admin/rapports` + loading + modification sidebar

**Files:**
- Create: `app/(dashboard)/admin/rapports/page.tsx`
- Create: `app/(dashboard)/admin/rapports/loading.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1 : Créer `app/(dashboard)/admin/rapports/loading.tsx`**

```tsx
export default function RapportsLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
      {/* En-tête */}
      <div className="h-8 bg-gray-200 rounded w-64" />
      {/* Filtres */}
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-8 bg-gray-200 rounded w-32" />
      </div>
      {/* Stats grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>
      {/* Exports */}
      <div className="h-8 bg-gray-200 rounded w-32" />
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/admin/rapports/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStatsData } from '@/lib/rapports/getStatsData'
import RapportsFiltres from '@/components/rapports/RapportsFiltres'
import TauxPresenceChart from '@/components/rapports/TauxPresenceChart'
import AbsencesParTypeChart from '@/components/rapports/AbsencesParTypeChart'
import TopAbsences from '@/components/rapports/TopAbsences'
import PotHeuresChart from '@/components/rapports/PotHeuresChart'
import type { PeriodeType } from '@/types/rapports'

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: { periode?: string; date?: string; service?: string; bureau?: string }
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

  // Parse searchParams
  const periodeType: PeriodeType =
    searchParams.periode === 'trimestre' || searchParams.periode === 'annee'
      ? searchParams.periode
      : 'mois'

  const now = new Date()
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const periodeDate = searchParams.date ?? defaultDate

  const serviceId = searchParams.service || undefined
  const bureauId = searchParams.bureau || undefined

  const stats = await getStatsData({ periodeType, periodeDate, serviceId, bureauId })

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Rapports & Statistiques</h1>
        <Link
          href="/admin/recap"
          className="text-xs text-[#e53e3e] hover:underline"
        >
          Voir le récap mensuel →
        </Link>
      </div>

      {/* Filtres */}
      <RapportsFiltres
        periodeType={periodeType}
        periodeDate={periodeDate}
        serviceId={serviceId}
        bureauId={bureauId}
        services={stats.services}
        bureaux={stats.bureaux}
      />

      {/* Stats grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <TauxPresenceChart tauxPresence={stats.tauxPresence} tauxGlobal={stats.tauxGlobal} />
        <AbsencesParTypeChart absencesParType={stats.absencesParType} totalAbsences={stats.totalAbsences} />
        <TopAbsences topAbsences={stats.topAbsences} />
        <PotHeuresChart potHeures={stats.potHeures} />
      </div>

      {/* Section Exports — placeholder, sera implémenté dans le Chunk 3 */}
      <div id="exports" />
    </div>
  )
}
```

- [ ] **Step 3 : Modifier `components/layout/Sidebar.tsx` — changer le lien Rapports**

Dans `components/layout/Sidebar.tsx`, ligne 23, changer :
```ts
// Avant
{ href: '/admin/recap', icon: '📊', label: 'Rapports' },
// Après
{ href: '/admin/rapports', icon: '📊', label: 'Rapports' },
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5 : Lancer le serveur de dev et vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/admin/rapports` — vérifier :
- Admin guard fonctionne (redirige si non admin)
- Les 4 blocs de stats s'affichent
- Les filtres changent les searchParams dans l'URL
- Le lien "Voir le récap mensuel" mène à `/admin/recap`
- La sidebar pointe vers `/admin/rapports`

- [ ] **Step 6 : Commit**

```bash
git add app/(dashboard)/admin/rapports/ components/layout/Sidebar.tsx
git commit -m "feat(rapports): add admin rapports page with stats dashboard and filters"
```

---

## Chunk 3 — Exports : Collecte de données + Formateurs Excel/PDF

### Task 8 : Fonctions de collecte de données pour les exports

**Files:**
- Create: `lib/rapports/export-data.ts`

Chaque fonction collecte les données brutes nécessaires à un export, les formate en tableaux prêts à consommer par les formateurs Excel/PDF.

- [ ] **Step 1 : Créer `lib/rapports/export-data.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { calculerPlage, labelPeriode } from './periodes'
import { joursFeriesPlage } from '@/lib/calendrier/joursFeries'
import { formatMinutes } from '@/lib/horaires/utils'
import { labelTypeConge, labelStatutConge, formatDateFr } from '@/lib/utils/dates'
import type { ExportParams } from '@/types/rapports'

export type ExportMeta = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
}

async function getAdminSupabase() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin_rh) throw new Error('Non autorisé')
  return supabase
}

/**
 * Filtre bureau partagé : charge user_bureau_schedule et retourne un Set de user_ids
 * assignés au bureau pour au moins un jour ouvrable de la plage.
 */
async function filterByBureau(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  bureauId: string | undefined,
  dateDebut: string,
  dateFin: string
): Promise<Set<string> | null> {
  if (!bureauId) return null // pas de filtre

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, valide_depuis')
    .in('user_id', userIds)

  const bureauIndex = new Map<string, Map<number, { bureau_id: string; valide_depuis: string }[]>>()
  for (const bs of (schedules ?? [])) {
    if (!bureauIndex.has(bs.user_id)) bureauIndex.set(bs.user_id, new Map())
    const byJour = bureauIndex.get(bs.user_id)!
    if (!byJour.has(bs.jour)) byJour.set(bs.jour, [])
    byJour.get(bs.jour)!.push(bs)
  }
  bureauIndex.forEach((byJour) => {
    byJour.forEach((list) => list.sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis)))
  })

  const feries = joursFeriesPlage(dateDebut, dateFin)
  const retained = new Set<string>()
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    if (dow >= 1 && dow <= 5 && !feries.has(iso)) {
      for (const uid of userIds) {
        const byJour = bureauIndex.get(uid)
        const list = byJour?.get(dow) ?? []
        const entry = list.find((bs) => bs.valide_depuis <= iso) ?? null
        if (entry?.bureau_id === bureauId) retained.add(uid)
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return retained
}

export async function collectPointages(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const feries = joursFeriesPlage(dateDebut, dateFin)

  // Générer la liste de dates
  const dates: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, service:services(nom)')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: dayStatuses } = await supabase
    .from('day_statuses')
    .select('user_id, date, status')
    .in('user_id', workers.map((w) => w.id))
    .gte('date', dateDebut)
    .lte('date', dateFin)

  const statusIndex = new Map<string, Map<string, string>>()
  for (const ds of (dayStatuses ?? [])) {
    if (!statusIndex.has(ds.user_id)) statusIndex.set(ds.user_id, new Map())
    statusIndex.get(ds.user_id)!.set(ds.date, ds.status)
  }

  const headers = ['Nom', 'Prénom', 'Service', ...dates.map((d) => d.slice(8)), 'Total P']
  const rows = workers.map((w) => {
    const svc = (w.service as unknown as { nom: string } | null)?.nom ?? ''
    let totalP = 0
    const cells = dates.map((d) => {
      const dow = new Date(d + 'T00:00:00').getDay()
      if (dow === 0 || dow === 6) return 'W'
      if (feries.has(d)) return 'F'
      const status = statusIndex.get(w.id)?.get(d) ?? ''
      if (status === 'P') totalP++
      return status
    })
    return [w.nom, w.prenom, svc, ...cells, String(totalP)]
  })

  return { titre: 'Pointages mensuels', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectTravailleurs(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, email, service:services(nom), option_horaire, type_contrat, date_entree, is_active')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('user_id, jour, bureau:bureaux(nom), valide_depuis')
    .in('user_id', workers.map((w) => w.id))

  const jourNoms = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
  const schedIndex = new Map<string, string>()
  for (const w of workers) {
    const userSchedules = (schedules ?? [])
      .filter((s) => s.user_id === w.id)
      .sort((a, b) => b.valide_depuis.localeCompare(a.valide_depuis))
    const byJour = new Map<number, string>()
    for (const s of userSchedules) {
      // Premier trouvé = le plus récent (trié DESC), ne pas écraser
      if (!byJour.has(s.jour)) {
        byJour.set(s.jour, (s.bureau as unknown as { nom: string })?.nom ?? '')
      }
    }
    const parts: string[] = []
    for (let j = 1; j <= 5; j++) {
      const b = byJour.get(j)
      if (b) parts.push(`${jourNoms[j]}: ${b}`)
    }
    schedIndex.set(w.id, parts.join(', ') || 'Non assigné')
  }

  const headers = ['Nom', 'Prénom', 'Email', 'Service', 'Bureau(x)', 'Option horaire', 'Type contrat', "Date d'entrée", 'Statut']
  const rows = workers.map((w) => [
    w.nom,
    w.prenom,
    w.email,
    (w.service as unknown as { nom: string } | null)?.nom ?? '',
    schedIndex.get(w.id) ?? '',
    w.option_horaire ?? '',
    w.type_contrat ?? '',
    w.date_entree ? formatDateFr(w.date_entree) : '',
    w.is_active ? 'Actif' : 'Inactif',
  ])

  return { titre: 'Liste des travailleurs', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectConges(params: ExportParams): Promise<ExportMeta & { soldesHeaders: string[]; soldesRows: string[][] }> {
  const supabase = await getAdminSupabase()
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const annee = parseInt(params.periodeDate.slice(0, 4))

  // Charger les user_ids filtrés par service (et bureau si applicable)
  let profilesQ = supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profilesData } = await profilesQ
  let filteredUserIds = (profilesData ?? []).map((p) => p.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, filteredUserIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) filteredUserIds = filteredUserIds.filter((id) => bureauFilter.has(id))

  let congesQ = supabase
    .from('conges')
    .select('user_id, type, date_debut, date_fin, nb_jours, statut, commentaire_travailleur, profile:profiles(prenom, nom)')
    .in('user_id', filteredUserIds)
    .lte('date_debut', dateFin)
    .gte('date_fin', dateDebut)
    .order('date_debut')

  const { data: conges } = await congesQ

  const headers = ['Nom', 'Type', 'Date début', 'Date fin', 'Nb jours', 'Statut', 'Commentaire']
  const rows = (conges ?? []).map((c) => {
    const p = c.profile as unknown as { prenom: string; nom: string } | null
    return [
      p ? `${p.nom} ${p.prenom}` : '',
      labelTypeConge(c.type),
      formatDateFr(c.date_debut),
      formatDateFr(c.date_fin),
      String(c.nb_jours),
      labelStatutConge(c.statut),
      c.commentaire_travailleur ?? '',
    ]
  })

  // Soldes (filtrés par les mêmes user_ids)
  let soldesQ = supabase
    .from('soldes_conges')
    .select('user_id, conges_annuels_total, conges_annuels_pris, repos_comp_total, repos_comp_pris, profile:profiles(prenom, nom)')
    .in('user_id', filteredUserIds)
    .eq('annee', annee)
  const { data: soldes } = await soldesQ

  const soldesHeaders = ['Nom', 'CA total', 'CA pris', 'CA restant', 'RC total', 'RC pris', 'RC restant']
  const soldesRows = (soldes ?? []).map((s) => {
    const p = s.profile as unknown as { prenom: string; nom: string } | null
    return [
      p ? `${p.nom} ${p.prenom}` : '',
      String(s.conges_annuels_total),
      String(s.conges_annuels_pris),
      String(s.conges_annuels_total - s.conges_annuels_pris),
      String(s.repos_comp_total),
      String(s.repos_comp_pris),
      String(s.repos_comp_total - s.repos_comp_pris),
    ]
  })

  return { titre: 'Congés', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows, soldesHeaders, soldesRows }
}

export async function collectCalendrier(params: ExportParams): Promise<ExportMeta> {
  // Réutilise la logique de getCalendrierData
  const { getCalendrierData } = await import('@/lib/calendrier/getCalendrierData')
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)
  const data = await getCalendrierData({
    dateDebut,
    dateFin,
    serviceId: params.serviceId,
    bureauId: params.bureauId,
  })

  const dates: string[] = []
  const cur = new Date(dateDebut + 'T00:00:00')
  const end = new Date(dateFin + 'T00:00:00')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  const statutToCode: Record<string, string> = {
    present: 'P', absent: 'A', conge: 'C', ferie: 'F', weekend: 'W', vide: '—',
  }

  const headers = ['Nom', 'Service', ...dates.map((d) => d.slice(8))]
  const rows = data.travailleurs.map((t) => {
    const cells = t.jours.map((j) => statutToCode[j.statut] ?? '—')
    return [`${t.nom} ${t.prenom}`, t.service, ...cells]
  })

  return { titre: 'Calendrier de présence', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}

export async function collectPotHeures(params: ExportParams): Promise<ExportMeta> {
  const supabase = await getAdminSupabase()
  const annee = parseInt(params.periodeDate.slice(0, 4))
  const { dateDebut, dateFin } = calculerPlage(params.periodeType, params.periodeDate)

  let profilesQ = supabase
    .from('profiles')
    .select('id, prenom, nom, option_horaire, service:services(nom)')
    .eq('is_active', true)
    .order('nom')
  if (params.serviceId) profilesQ = profilesQ.eq('service_id', params.serviceId)
  const { data: profiles } = await profilesQ
  let workers = profiles ?? []
  const userIds = workers.map((w) => w.id)

  // Appliquer filtre bureau
  const bureauFilter = await filterByBureau(supabase, userIds, params.bureauId, dateDebut, dateFin)
  if (bureauFilter) workers = workers.filter((w) => bureauFilter.has(w.id))

  const { data: potData } = await supabase
    .from('pot_heures')
    .select('user_id, solde_minutes')
    .in('user_id', workers.map((w) => w.id))
    .eq('annee', annee)

  const potIndex = new Map<string, number>()
  for (const p of (potData ?? [])) potIndex.set(p.user_id, p.solde_minutes)

  const headers = ['Nom', 'Service', 'Option horaire', 'Solde (minutes)', 'Solde (format)']
  const rows = workers.map((w) => {
    const solde = potIndex.get(w.id) ?? 0
    return [
      `${w.nom} ${w.prenom}`,
      (w.service as unknown as { nom: string } | null)?.nom ?? '',
      w.option_horaire ?? '',
      String(solde),
      formatMinutes(solde),
    ]
  })

  return { titre: 'Pot d\'heures', periode: labelPeriode(params.periodeType, params.periodeDate), headers, rows }
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add lib/rapports/export-data.ts
git commit -m "feat(rapports): add 5 export data collection functions"
```

---

### Task 9 : Formateur Excel générique

**Files:**
- Create: `lib/rapports/export-excel.ts`

- [ ] **Step 1 : Créer `lib/rapports/export-excel.ts`**

```ts
import ExcelJS from 'exceljs'

type ExcelExportInput = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
  sheetName?: string
  // Feuille supplémentaire optionnelle (ex : soldes congés)
  extraSheet?: {
    name: string
    headers: string[]
    rows: string[][]
  }
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A2332' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 10,
}

function applySheet(sheet: ExcelJS.Worksheet, headers: string[], rows: string[][]) {
  // En-têtes
  const headerRow = sheet.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Données
  for (const row of rows) {
    sheet.addRow(row)
  }

  // Auto-dimensionner
  sheet.columns.forEach((col, i) => {
    let maxLen = headers[i]?.length ?? 10
    for (const row of rows) {
      const cellLen = (row[i] ?? '').length
      if (cellLen > maxLen) maxLen = cellLen
    }
    col.width = Math.min(maxLen + 2, 40)
  })
}

export async function generateExcel(input: ExcelExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Gestion RH — ACCG Namur-Luxembourg'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(input.sheetName ?? input.titre)
  applySheet(sheet, input.headers, input.rows)

  if (input.extraSheet) {
    const extra = workbook.addWorksheet(input.extraSheet.name)
    applySheet(extra, input.extraSheet.headers, input.extraSheet.rows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add lib/rapports/export-excel.ts
git commit -m "feat(rapports): add generic Excel formatter with exceljs"
```

---

### Task 10 : Formateur PDF générique

**Files:**
- Create: `lib/rapports/export-pdf.ts`

- [ ] **Step 1 : Créer `lib/rapports/export-pdf.ts`**

```ts
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type PdfExportInput = {
  titre: string
  periode: string
  headers: string[]
  rows: string[][]
  // Page supplémentaire optionnelle
  extraPage?: {
    titre: string
    headers: string[]
    rows: string[][]
  }
}

export function generatePdf(input: PdfExportInput): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // En-tête
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Centrale Générale FGTB Namur-Luxembourg', 14, 10)

  doc.setFontSize(14)
  doc.setTextColor(26, 35, 50) // #1a2332
  doc.text(input.titre, 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(input.periode, 14, 27)

  // Tableau principal
  autoTable(doc, {
    startY: 32,
    head: [input.headers],
    body: input.rows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 35, 50], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  })

  // Page supplémentaire
  if (input.extraPage) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setTextColor(26, 35, 50)
    doc.text(input.extraPage.titre, 14, 15)

    autoTable(doc, {
      startY: 22,
      head: [input.extraPage.headers],
      body: input.extraPage.rows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 35, 50], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    })
  }

  // Pied de page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    const now = new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Généré le ${now}`, 14, doc.internal.pageSize.height - 7)
    doc.text(`Page ${i}/${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 7)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
```

- [ ] **Step 2 : Créer `types/jspdf-autotable.d.ts` (déclaration de types)**

`jspdf-autotable` n'a pas de types bundled. Créer ce fichier :

```ts
declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'
  export default function autoTable(doc: jsPDF, options: Record<string, unknown>): void
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: pas d'erreurs

- [ ] **Step 4 : Commit**

```bash
git add lib/rapports/export-pdf.ts types/jspdf-autotable.d.ts
git commit -m "feat(rapports): add generic PDF formatter with jspdf + autotable"
```

---

### Task 11 : Server Actions exports (10 actions)

**Files:**
- Create: `lib/rapports/exports.ts`

- [ ] **Step 1 : Créer `lib/rapports/exports.ts`**

```ts
'use server'

import type { ExportParams } from '@/types/rapports'
import { collectPointages, collectTravailleurs, collectConges, collectCalendrier, collectPotHeures } from './export-data'
import { generateExcel } from './export-excel'
import { generatePdf } from './export-pdf'

// --- Pointages ---
export async function exportPointagesExcel(params: ExportParams): Promise<string> {
  const data = await collectPointages(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportPointagesPdf(params: ExportParams): Promise<string> {
  const data = await collectPointages(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Travailleurs ---
export async function exportTravailleursExcel(params: ExportParams): Promise<string> {
  const data = await collectTravailleurs(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportTravailleursPdf(params: ExportParams): Promise<string> {
  const data = await collectTravailleurs(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Congés ---
export async function exportCongesExcel(params: ExportParams): Promise<string> {
  const data = await collectConges(params)
  const buffer = await generateExcel({
    ...data,
    extraSheet: { name: 'Soldes', headers: data.soldesHeaders, rows: data.soldesRows },
  })
  return buffer.toString('base64')
}

export async function exportCongesPdf(params: ExportParams): Promise<string> {
  const data = await collectConges(params)
  const buffer = generatePdf({
    ...data,
    extraPage: { titre: 'Soldes par travailleur', headers: data.soldesHeaders, rows: data.soldesRows },
  })
  return buffer.toString('base64')
}

// --- Calendrier ---
export async function exportCalendrierExcel(params: ExportParams): Promise<string> {
  const data = await collectCalendrier(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportCalendrierPdf(params: ExportParams): Promise<string> {
  const data = await collectCalendrier(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}

// --- Pot d'heures ---
export async function exportPotHeuresExcel(params: ExportParams): Promise<string> {
  const data = await collectPotHeures(params)
  const buffer = await generateExcel(data)
  return buffer.toString('base64')
}

export async function exportPotHeuresPdf(params: ExportParams): Promise<string> {
  const data = await collectPotHeures(params)
  const buffer = generatePdf(data)
  return buffer.toString('base64')
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add lib/rapports/exports.ts
git commit -m "feat(rapports): add 10 export Server Actions (5 types x 2 formats)"
```

---

## Chunk 4 — UI Exports + Intégration finale

### Task 12 : Composant `ExportsSection` (Client Component)

**Files:**
- Create: `components/rapports/ExportsSection.tsx`

- [ ] **Step 1 : Créer `components/rapports/ExportsSection.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { ExportParams, PeriodeType } from '@/types/rapports'
import { labelPeriode } from '@/lib/rapports/periodes'
import {
  exportPointagesExcel, exportPointagesPdf,
  exportTravailleursExcel, exportTravailleursPdf,
  exportCongesExcel, exportCongesPdf,
  exportCalendrierExcel, exportCalendrierPdf,
  exportPotHeuresExcel, exportPotHeuresPdf,
} from '@/lib/rapports/exports'

type ExportDef = {
  key: string
  titre: string
  description: string
  icon: string
  excelAction: (params: ExportParams) => Promise<string>
  pdfAction: (params: ExportParams) => Promise<string>
  filePrefix: string
}

const EXPORTS: ExportDef[] = [
  {
    key: 'pointages', titre: 'Pointages mensuels', description: 'Grille récap (travailleurs × jours, statuts)',
    icon: '⏱', excelAction: exportPointagesExcel, pdfAction: exportPointagesPdf, filePrefix: 'pointages',
  },
  {
    key: 'travailleurs', titre: 'Liste travailleurs', description: 'Tableau complet des travailleurs actifs',
    icon: '👥', excelAction: exportTravailleursExcel, pdfAction: exportTravailleursPdf, filePrefix: 'travailleurs',
  },
  {
    key: 'conges', titre: 'Congés', description: 'Demandes avec statuts + soldes par travailleur',
    icon: '🌴', excelAction: exportCongesExcel, pdfAction: exportCongesPdf, filePrefix: 'conges',
  },
  {
    key: 'calendrier', titre: 'Calendrier présence', description: 'Grille mois (travailleurs × jours)',
    icon: '📅', excelAction: exportCalendrierExcel, pdfAction: exportCalendrierPdf, filePrefix: 'calendrier',
  },
  {
    key: 'pot-heures', titre: "Pot d'heures", description: 'Soldes par travailleur et service',
    icon: '⚡', excelAction: exportPotHeuresExcel, pdfAction: exportPotHeuresPdf, filePrefix: 'pot-heures',
  },
]

function downloadBase64(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportsSection({
  periodeType,
  periodeDate,
  serviceId,
  bureauId,
}: {
  periodeType: PeriodeType
  periodeDate: string
  serviceId?: string
  bureauId?: string
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const params: ExportParams = { periodeType, periodeDate, serviceId, bureauId }

  async function handleExport(def: ExportDef, format: 'excel' | 'pdf') {
    const key = `${def.key}-${format}`
    setLoading(key)
    try {
      const action = format === 'excel' ? def.excelAction : def.pdfAction
      const base64 = await action(params)
      const ext = format === 'excel' ? 'xlsx' : 'pdf'
      const mime = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'
      // Nom de fichier lisible : ex "pointages_mars-2026.xlsx"
      const periodLabel = labelPeriode(periodeType, periodeDate).toLowerCase().replace(/\s+/g, '-')
      downloadBase64(base64, `${def.filePrefix}_${periodLabel}.${ext}`, mime)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setLoading(null)
    }
  }

  const btnBase = 'px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Exports</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {EXPORTS.map((def) => (
          <div key={def.key} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{def.icon}</span>
              <h3 className="text-sm font-semibold text-gray-800">{def.titre}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">{def.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport(def, 'excel')}
                disabled={loading !== null}
                className={`${btnBase} border-green-200 text-green-700 hover:bg-green-50`}
              >
                {loading === `${def.key}-excel` ? '⏳' : '📥'} Excel
              </button>
              <button
                onClick={() => handleExport(def, 'pdf')}
                disabled={loading !== null}
                className={`${btnBase} border-red-200 text-red-700 hover:bg-red-50`}
              >
                {loading === `${def.key}-pdf` ? '⏳' : '📥'} PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/rapports/ExportsSection.tsx
git commit -m "feat(rapports): add ExportsSection client component with download buttons"
```

---

### Task 13 : Intégrer ExportsSection dans la page

**Files:**
- Modify: `app/(dashboard)/admin/rapports/page.tsx`

- [ ] **Step 1 : Ajouter l'import et le composant dans `page.tsx`**

Dans `app/(dashboard)/admin/rapports/page.tsx` :

1. Ajouter l'import en haut :
```ts
import ExportsSection from '@/components/rapports/ExportsSection'
```

2. Remplacer le placeholder `<div id="exports" />` par :
```tsx
{/* Section Exports */}
<ExportsSection
  periodeType={periodeType}
  periodeDate={periodeDate}
  serviceId={serviceId}
  bureauId={bureauId}
/>
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3 : Tester manuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/admin/rapports` :
- Les 5 cartes d'export s'affichent sous les stats
- Cliquer sur "Excel" pour Pointages → un fichier `.xlsx` se télécharge
- Cliquer sur "PDF" pour Travailleurs → un fichier `.pdf` se télécharge
- Les filtres (période, service, bureau) affectent le contenu des exports
- L'indicateur de chargement (⏳) s'affiche pendant la génération
- Le bouton "Voir le récap mensuel" fonctionne toujours

- [ ] **Step 4 : Build de vérification**

```bash
npm run build 2>&1 | tail -20
```

Expected: build réussi sans erreurs.

- [ ] **Step 5 : Commit final**

```bash
git add app/(dashboard)/admin/rapports/page.tsx
git commit -m "feat(rapports): integrate ExportsSection into admin rapports page — M6 complete"
```
