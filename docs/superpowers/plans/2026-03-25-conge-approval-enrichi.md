# Congé Approval Enrichi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the leave approval modal with worker balance info, bureau coverage analysis, and optional temporary reassignment workflow.

**Architecture:** Replace the existing `CongeApprovalModal` (Dialog) with a Sheet (drawer) containing 4 zones: request summary, balances, coverage, and reassignment. New `reassignations_temporaires` table stores reassignment proposals. Server actions handle all data loading (`getCongeContext`) and mutations (`creerReassignation`, `repondreReassignation`). Notifications integrate into the existing `NotificationCounts`/`NotificationsBanner` system.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + RLS), Server Actions, React Email + Resend, shadcn/ui Sheet, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-25-conge-approval-enrichi-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `types/database.ts` | Add `ReassignationTemporaire` type |
| `supabase/migrations/XXXXXX_create_reassignations_temporaires.sql` | DB table + indexes + RLS |
| `components/ui/sheet.tsx` | shadcn Sheet component (install) |
| `lib/conges/context-actions.ts` | **New** — `getCongeContext()` server action (soldes, couverture, disponibilités) |
| `lib/reassignations/actions.ts` | **New** — `creerReassignation()`, `repondreReassignation()`, `getReassignationsForConge()` |
| `emails/ReassignationEmail.tsx` | **New** — React Email template for reassignment notification |
| `lib/resend/emails.ts` | Add `sendReassignationEmail()` function |
| `components/admin/CongeApprovalDrawer.tsx` | **New** — Replace modal, 4-zone drawer |
| `components/admin/CongeApprovalDrawer/ZoneSoldes.tsx` | **New** — Balance display with alerts |
| `components/admin/CongeApprovalDrawer/ZoneCouverture.tsx` | **New** — Bureau coverage per day |
| `components/admin/CongeApprovalDrawer/ZoneReassignation.tsx` | **New** — Available workers + reassign buttons |
| `components/admin/CongesTable.tsx` | Update to use drawer instead of modal |
| `lib/notifications/counts.ts` | Add `reassignationsEnAttente` (worker) + `reassignationsRefusees` (admin) |
| `lib/notifications/actions.ts` | Add reassignation type to `UnreadDecision`, update `markDecisionVue` + `markAllDecisionsVues` |
| `components/dashboard/NotificationsBanner.tsx` | Add reassignment card with Accept/Refuse buttons |

---

## Task 1: Database — Create `reassignations_temporaires` table

**Files:**
- Create: `supabase/migrations/20260325120000_create_reassignations_temporaires.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260325120000_create_reassignations_temporaires.sql`:

```sql
-- Table des réaffectations temporaires
CREATE TABLE reassignations_temporaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conge_id UUID NOT NULL REFERENCES conges(id) ON DELETE CASCADE,
  travailleur_id UUID NOT NULL REFERENCES profiles(id),
  bureau_id UUID NOT NULL REFERENCES bureaux(id),
  date DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'accepte', 'refuse')),
  demande_par UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  repondu_le TIMESTAMPTZ,
  commentaire TEXT,
  vu_par_travailleur BOOLEAN DEFAULT false,

  UNIQUE(conge_id, travailleur_id, date)
);

-- Indexes
CREATE INDEX idx_reassignations_bureau_date ON reassignations_temporaires(bureau_id, date);
CREATE INDEX idx_reassignations_travailleur_statut ON reassignations_temporaires(travailleur_id, statut);
CREATE INDEX idx_reassignations_conge ON reassignations_temporaires(conge_id);

-- RLS
ALTER TABLE reassignations_temporaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travailleur voit ses reassignations"
  ON reassignations_temporaires FOR SELECT
  USING (travailleur_id = auth.uid());

CREATE POLICY "Admin RH acces complet reassignations"
  ON reassignations_temporaires FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  );

-- Trigger updated_at
CREATE TRIGGER set_updated_at_reassignations
  BEFORE UPDATE ON reassignations_temporaires
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run: Use `apply_migration` MCP tool with the SQL above.
Expected: Migration applied successfully.

- [ ] **Step 3: Add TypeScript type to types/database.ts**

Add after the `BureauAffectationTemp` type:

```typescript
export type StatutReassignation = 'en_attente' | 'accepte' | 'refuse'

export type ReassignationTemporaire = {
  id: string
  conge_id: string
  travailleur_id: string
  bureau_id: string
  date: string
  statut: StatutReassignation
  demande_par: string
  created_at: string
  updated_at: string
  repondu_le: string | null
  commentaire: string | null
  vu_par_travailleur: boolean
  // Joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
  bureau?: Pick<Bureau, 'nom' | 'code'>
  conge?: Pick<Conge, 'user_id' | 'date_debut' | 'date_fin'> & {
    profile?: Pick<Profile, 'prenom' | 'nom'>
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325120000_create_reassignations_temporaires.sql types/database.ts
git commit -m "feat: create reassignations_temporaires table with RLS and types"
```

---

## Task 2: Server Action — `getCongeContext()` (soldes + couverture + disponibilités)

**Files:**
- Create: `lib/conges/context-actions.ts`

**Reference:**
- `lib/conges/admin-actions.ts` for `assertAdmin()` and Supabase query patterns
- `lib/regime/actions.ts` for `getRegimeActif()` pattern
- `lib/utils/dates.ts` for `getJoursOuvrables()`, `todayBrussels()`

- [ ] **Step 1: Create the context types**

Create `lib/conges/context-actions.ts` with type definitions:

```typescript
'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRegimeActif } from '@/lib/regime/actions'
import { getJoursOuvrables } from '@/lib/utils/dates'
import type { SoldeConges, ReassignationTemporaire } from '@/types/database'

// Type exports
export type SoldeAlert = 'ok' | 'warning' | 'danger'

export interface WorkerSoldes {
  congesAnnuels: { total: number; pris: number; reliquat: number; restant: number; apresApprobation: number; alert: SoldeAlert }
  reposComp: { total: number; pris: number; reliquat: number; restant: number; apresApprobation: number; alert: SoldeAlert }
  recuperation: { soldeMinutes: number; soldeJours: number; apresApprobationJours: number; alert: SoldeAlert; minutesParJour: number }
}

export interface WorkerPresence {
  userId: string
  prenom: string
  nom: string
  statut: 'present' | 'conge' | 'maladie' | 'absent' | 'demandeur'
  statusCode?: string
}

export interface DayCoverage {
  date: string
  dayOfWeek: number // 1=lundi ... 5=vendredi
  bureauId: string
  bureauNom: string
  workers: WorkerPresence[]
  present: number
  total: number
  ratio: number // 0-1
  alert: boolean // true if <50% or 0
}

export interface AvailableWorker {
  userId: string
  prenom: string
  nom: string
  currentBureau: string | null
}

export interface DayAvailability {
  date: string
  bureauId: string
  bureauNom: string
  availableWorkers: AvailableWorker[]
}

export interface CongeContext {
  soldes: WorkerSoldes
  coverage: DayCoverage[]
  availability: DayAvailability[] // only for days with coverage alert
  existingReassignations: ReassignationTemporaire[]
}
```

- [ ] **Step 2: Implement assertAdmin helper (import from existing)**

Reuse the existing `assertAdmin` from `lib/conges/admin-actions.ts`. Either import it (if exported) or extract to a shared `lib/auth/assert-admin.ts`. For now, copy the pattern:

```typescript
import { assertAdmin } from '@/lib/conges/admin-actions' // if exported
// OR copy the pattern if not exported:
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
```

> **Note:** Ideally, extract `assertAdmin` to `lib/auth/assert-admin.ts` to avoid duplication across files. This is a pre-existing tech debt.

- [ ] **Step 3: Implement getWorkerSoldes() helper**

```typescript
async function getWorkerSoldes(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  congeType: string,
  nbJours: number,
  optionHoraire: string
): Promise<WorkerSoldes> {
  const annee = new Date().getFullYear()

  // Get soldes_conges
  const { data: solde } = await admin
    .from('soldes_conges')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', annee)
    .single()

  // Get pot_heures
  const { data: pot } = await admin
    .from('pot_heures')
    .select('solde_minutes')
    .eq('user_id', userId)
    .single()

  const s = solde as SoldeConges | null
  const minutesParJour = optionHoraire === 'A' ? 438 : 408

  const caTotal = (s?.conges_annuels_total ?? 0) + (s?.reliquat_conges_annuels ?? 0)
  const caPris = s?.conges_annuels_pris ?? 0
  const caRestant = caTotal - caPris
  const caApres = congeType === 'conge_annuel' ? caRestant - nbJours : caRestant

  const rcTotal = (s?.repos_comp_total ?? 0) + (s?.reliquat_repos_comp ?? 0)
  const rcPris = s?.repos_comp_pris ?? 0
  const rcRestant = rcTotal - rcPris
  const rcApres = congeType === 'repos_comp' ? rcRestant - nbJours : rcRestant

  const soldeMinutes = pot?.solde_minutes ?? 0
  const soldeJours = Math.round((soldeMinutes / minutesParJour) * 100) / 100
  const recupApresJours = congeType === 'recuperation' ? soldeJours - nbJours : soldeJours

  function alertFor(value: number): SoldeAlert {
    if (value < 0) return 'danger'
    if (value === 0) return 'warning'
    return 'ok'
  }

  return {
    congesAnnuels: {
      total: caTotal, pris: caPris, reliquat: s?.reliquat_conges_annuels ?? 0,
      restant: caRestant, apresApprobation: caApres, alert: alertFor(caApres),
    },
    reposComp: {
      total: rcTotal, pris: rcPris, reliquat: s?.reliquat_repos_comp ?? 0,
      restant: rcRestant, apresApprobation: rcApres, alert: alertFor(rcApres),
    },
    recuperation: {
      soldeMinutes, soldeJours, apresApprobationJours: recupApresJours,
      alert: alertFor(recupApresJours), minutesParJour,
    },
  }
}
```

- [ ] **Step 4: Implement getCoverage() helper (BATCHED queries — no N+1)**

> **IMPORTANT:** This uses batched queries instead of per-worker loops to avoid N+1 performance issues. All day_statuses and regime_travail data are pre-fetched in bulk.

```typescript
function safeDayOfWeek(dateStr: string): number {
  // Use T12:00:00 to avoid timezone issues with new Date('YYYY-MM-DD')
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDay() === 0 ? 7 : d.getDay() // 1=lundi...7=dimanche
}

async function getCoverage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  dateDebut: string,
  dateFin: string
): Promise<DayCoverage[]> {
  const joursOuvrables = getJoursOuvrables(dateDebut, dateFin)
  if (joursOuvrables.length === 0) return []

  // 1. Get unique weekdays needed
  const weekdays = [...new Set(joursOuvrables.map(safeDayOfWeek))]

  // 2. BATCH: Get requester's bureau schedule for all relevant weekdays
  const { data: requesterSchedules } = await admin
    .from('user_bureau_schedule')
    .select('jour, bureau_id, bureaux!inner(nom, code)')
    .eq('user_id', userId)
    .in('jour', weekdays)

  if (!requesterSchedules || requesterSchedules.length === 0) return []

  // Map weekday → bureau info
  const requesterBureauMap = new Map<number, { bureauId: string; bureauNom: string }>()
  for (const rs of requesterSchedules) {
    requesterBureauMap.set(rs.jour, {
      bureauId: rs.bureau_id,
      bureauNom: (rs as any).bureaux?.nom ?? 'Bureau',
    })
  }

  // 3. BATCH: Get all workers assigned to those bureaus on those weekdays
  const bureauIds = [...new Set([...requesterBureauMap.values()].map(v => v.bureauId))]
  const { data: allSchedules } = await admin
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, profiles!inner(id, prenom, nom, is_active)')
    .in('bureau_id', bureauIds)
    .in('jour', weekdays)

  if (!allSchedules) return []

  // Collect all unique active user_ids
  const allUserIds = [...new Set(
    allSchedules
      .filter(s => (s as any).profiles?.is_active)
      .map(s => s.user_id)
  )]

  // 4. BATCH: Fetch all day_statuses for the entire date range for all workers
  const { data: allDayStatuses } = await admin
    .from('day_statuses')
    .select('user_id, date, status')
    .in('user_id', allUserIds)
    .gte('date', dateDebut)
    .lte('date', dateFin)

  // Build lookup: `userId:date` → status
  const dayStatusMap = new Map<string, string>()
  for (const ds of allDayStatuses ?? []) {
    dayStatusMap.set(`${ds.user_id}:${ds.date}`, ds.status)
  }

  // 5. BATCH: Fetch all active regimes for all workers
  const { data: allRegimes } = await admin
    .from('regime_travail')
    .select('user_id, jour_off, pourcentage_travail, date_debut, date_fin')
    .in('user_id', allUserIds)
    .lte('date_debut', dateFin)
    .or(`date_fin.is.null,date_fin.gte.${dateDebut}`)
    .order('date_debut', { ascending: false })

  // Build lookup: userId → latest regime (simple: take first match per user)
  const regimeMap = new Map<string, { jour_off: number | null; pourcentage_travail: number }>()
  for (const r of allRegimes ?? []) {
    if (!regimeMap.has(r.user_id)) {
      regimeMap.set(r.user_id, { jour_off: r.jour_off, pourcentage_travail: r.pourcentage_travail })
    }
  }

  // 6. Build coverage per day
  const coverage: DayCoverage[] = []

  for (const dateStr of joursOuvrables) {
    const dayOfWeek = safeDayOfWeek(dateStr)
    const bureauInfo = requesterBureauMap.get(dayOfWeek)
    if (!bureauInfo) continue

    // Filter workers assigned to this bureau on this weekday
    const daySchedules = allSchedules.filter(
      s => s.bureau_id === bureauInfo.bureauId && s.jour === dayOfWeek && (s as any).profiles?.is_active
    )

    const workers: WorkerPresence[] = []

    for (const sched of daySchedules) {
      const profile = (sched as any).profiles
      const wId = sched.user_id

      // Check regime jour_off
      const regime = regimeMap.get(wId)
      if (regime?.jour_off === dayOfWeek) continue
      if (regime?.pourcentage_travail === 0) continue

      // Check day_status
      const statusCode = dayStatusMap.get(`${wId}:${dateStr}`)

      let statut: WorkerPresence['statut'] = 'present'
      if (wId === userId) {
        statut = 'demandeur'
      } else if (statusCode) {
        if (['C', 'R'].includes(statusCode)) statut = 'conge'
        else if (statusCode === 'M') statut = 'maladie'
        else if (['A', 'I'].includes(statusCode)) statut = 'absent'
      }

      workers.push({ userId: wId, prenom: profile.prenom, nom: profile.nom, statut, statusCode })
    }

    const nonDemandeur = workers.filter(w => w.statut !== 'demandeur')
    const present = nonDemandeur.filter(w => w.statut === 'present').length
    const total = nonDemandeur.length
    const ratio = total > 0 ? present / total : 0

    coverage.push({
      date: dateStr, dayOfWeek, bureauId: bureauInfo.bureauId, bureauNom: bureauInfo.bureauNom,
      workers, present, total, ratio, alert: ratio < 0.5 || present === 0,
    })
  }

  return coverage
}
```

> **Performance:** This makes ~5 batch queries total regardless of how many days/workers (vs the previous N+1 approach that could make 300+ queries for a 10-day leave with 15 workers per bureau).

- [ ] **Step 5: Implement getAvailability() helper (BATCHED)**

```typescript
async function getAvailability(
  admin: ReturnType<typeof createAdminClient>,
  alertDays: DayCoverage[],
  dayStatusMap: Map<string, string>,
  regimeMap: Map<string, { jour_off: number | null; pourcentage_travail: number }>
): Promise<DayAvailability[]> {
  if (alertDays.length === 0) return []

  const weekdays = [...new Set(alertDays.map(d => d.dayOfWeek))]
  const bureauIds = [...new Set(alertDays.map(d => d.bureauId))]

  // BATCH: Get all workers on other bureaus for those weekdays
  const { data: otherSchedules } = await admin
    .from('user_bureau_schedule')
    .select('user_id, bureau_id, jour, profiles!inner(id, prenom, nom, is_active), bureaux!inner(nom)')
    .in('jour', weekdays)

  if (!otherSchedules) return []

  // BATCH: Fetch day_statuses for these workers too (if not already in map)
  const otherUserIds = [...new Set(
    otherSchedules.filter(s => (s as any).profiles?.is_active).map(s => s.user_id)
  )]
  const missingUserIds = otherUserIds.filter(uid => {
    // Check if at least one date exists for this user in the map
    return !alertDays.some(d => dayStatusMap.has(`${uid}:${d.date}`))
  })

  if (missingUserIds.length > 0) {
    const dateMin = alertDays[0].date
    const dateMax = alertDays[alertDays.length - 1].date
    const { data: extraStatuses } = await admin
      .from('day_statuses')
      .select('user_id, date, status')
      .in('user_id', missingUserIds)
      .gte('date', dateMin)
      .lte('date', dateMax)

    for (const ds of extraStatuses ?? []) {
      dayStatusMap.set(`${ds.user_id}:${ds.date}`, ds.status)
    }

    // Also fetch regimes for missing users
    const { data: extraRegimes } = await admin
      .from('regime_travail')
      .select('user_id, jour_off, pourcentage_travail, date_debut, date_fin')
      .in('user_id', missingUserIds)
      .lte('date_debut', dateMax)
      .or(`date_fin.is.null,date_fin.gte.${dateMin}`)
      .order('date_debut', { ascending: false })

    for (const r of extraRegimes ?? []) {
      if (!regimeMap.has(r.user_id)) {
        regimeMap.set(r.user_id, { jour_off: r.jour_off, pourcentage_travail: r.pourcentage_travail })
      }
    }
  }

  const availability: DayAvailability[] = []

  for (const day of alertDays) {
    const bureauWorkerIds = day.workers.map(w => w.userId)
    const available: AvailableWorker[] = []
    const seen = new Set<string>()

    const daySchedules = otherSchedules.filter(
      s => s.jour === day.dayOfWeek && !bureauIds.includes(s.bureau_id) && (s as any).profiles?.is_active
    )

    for (const sched of daySchedules) {
      const wId = sched.user_id
      if (bureauWorkerIds.includes(wId) || seen.has(wId)) continue
      seen.add(wId)

      const regime = regimeMap.get(wId)
      if (regime?.jour_off === day.dayOfWeek) continue
      if (regime?.pourcentage_travail === 0) continue

      const statusCode = dayStatusMap.get(`${wId}:${day.date}`)
      if (statusCode && ['C', 'R', 'M', 'A', 'I'].includes(statusCode)) continue

      const profile = (sched as any).profiles
      available.push({
        userId: wId,
        prenom: profile.prenom,
        nom: profile.nom,
        currentBureau: (sched as any).bureaux?.nom ?? null,
      })
    }

    availability.push({ date: day.date, bureauId: day.bureauId, bureauNom: day.bureauNom, availableWorkers: available })
  }

  return availability
}
```

- [ ] **Step 6: Implement the main getCongeContext() export**

```typescript
export async function getCongeContext(congeId: string): Promise<{ error?: string; data?: CongeContext }> {
  await assertAdmin()
  const admin = createAdminClient()

  // Fetch the conge with profile
  const { data: conge, error } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email, option_horaire)')
    .eq('id', congeId)
    .single()

  if (error || !conge) return { error: 'Congé introuvable' }

  const optionHoraire = (conge as any).profile?.option_horaire ?? 'A'

  // Fetch soldes
  const soldes = await getWorkerSoldes(admin, conge.user_id, conge.type, conge.nb_jours, optionHoraire)

  // Fetch coverage
  const coverageData = await getCoverage(admin, conge.user_id, conge.date_debut, conge.date_fin)

  // Fetch availability for alert days only
  // Note: getCoverage builds dayStatusMap and regimeMap internally.
  // To share them with getAvailability, refactor getCoverage to return them,
  // or pass them as mutable Maps that getCoverage populates.
  // For simplicity, getAvailability will fetch its own batch for non-bureau workers.
  const alertDays = coverageData.filter(d => d.alert)
  const dayStatusMap = new Map<string, string>() // shared between getCoverage and getAvailability
  const regimeMap = new Map<string, { jour_off: number | null; pourcentage_travail: number }>()
  const availability = alertDays.length > 0 ? await getAvailability(admin, alertDays, dayStatusMap, regimeMap) : []

  // Fetch existing reassignations for this conge
  const { data: existingReassignations } = await admin
    .from('reassignations_temporaires')
    .select('*, profile:profiles!travailleur_id(prenom, nom, email), bureau:bureaux!bureau_id(nom, code)')
    .eq('conge_id', congeId)

  return {
    data: {
      soldes,
      coverage: coverageData,
      availability,
      existingReassignations: (existingReassignations ?? []) as ReassignationTemporaire[],
    },
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/conges/context-actions.ts
git commit -m "feat: add getCongeContext server action for enriched leave approval"
```

---

## Task 3: Server Action — Reassignment CRUD

**Files:**
- Create: `lib/reassignations/actions.ts`
- Modify: `lib/conges/admin-actions.ts` (add `creerReassignation`)
- Modify: `lib/resend/emails.ts` (add `sendReassignationEmail`)
- Create: `emails/ReassignationEmail.tsx`

**Reference:**
- `lib/conges/admin-actions.ts` for `assertAdmin()`, `traiterCongeAction()` patterns
- `lib/notifications/actions.ts` for `createAdminClient()` mutation pattern
- `lib/audit/logger.ts` for audit logging
- `emails/CongeApprouveEmail.tsx` for React Email template pattern

- [ ] **Step 1: Create the email template**

Create `emails/ReassignationEmail.tsx`:

```tsx
import {
  Html, Head, Body, Container, Heading, Text, Button, Section, Hr,
} from '@react-email/components'

interface Props {
  prenom: string
  bureauNom: string
  date: string
  raisonPrenom: string
  raisonNom: string
  appUrl: string
}

export default function ReassignationEmail({
  prenom, bureauNom, date, raisonPrenom, raisonNom, appUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '20px', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '20px', color: '#1a2332' }}>
            Demande de réaffectation
          </Heading>
          <Text style={{ fontSize: '14px', color: '#333' }}>
            Bonjour {prenom},
          </Text>
          <Text style={{ fontSize: '14px', color: '#333' }}>
            Vous êtes proposé(e) pour une réaffectation temporaire au bureau <strong>{bureauNom}</strong> le <strong>{date}</strong>,
            afin de remplacer <strong>{raisonPrenom} {raisonNom}</strong> qui sera absent(e).
          </Text>
          <Text style={{ fontSize: '14px', color: '#333' }}>
            Merci de confirmer ou refuser cette demande dans l'application.
          </Text>
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button
              href={appUrl}
              style={{
                backgroundColor: '#e53e3e', color: '#fff', padding: '12px 24px',
                borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none',
              }}
            >
              Voir la demande
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eee' }} />
          <Text style={{ fontSize: '12px', color: '#999' }}>
            Cet email a été envoyé automatiquement par le système de gestion RH.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Add sendReassignationEmail to lib/resend/emails.ts**

Add to `lib/resend/emails.ts`:

```typescript
import ReassignationEmail from '@/emails/ReassignationEmail'

export async function sendReassignationEmail(params: {
  email: string
  prenom: string
  bureauNom: string
  date: string
  raisonPrenom: string
  raisonNom: string
}) {
  const resend = getResend()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: params.email,
      subject: `Demande de réaffectation — Bureau ${params.bureauNom} le ${params.date}`,
      react: ReassignationEmail({ ...params, appUrl }),
    })
  } catch (e) {
    console.error('Erreur envoi email réaffectation:', e)
  }
}
```

- [ ] **Step 3: Add creerReassignation to lib/conges/admin-actions.ts**

Add to `lib/conges/admin-actions.ts`:

```typescript
import { sendReassignationEmail } from '@/lib/resend/emails'
import { formatDateFr } from '@/lib/utils/dates'

export async function creerReassignation(
  congeId: string,
  travailleurId: string,
  bureauId: string,
  date: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Get conge info for the absent worker's name
  const { data: conge } = await admin
    .from('conges')
    .select('user_id, profile:profiles!user_id(prenom, nom)')
    .eq('id', congeId)
    .single()

  if (!conge) return { error: 'Congé introuvable' }

  // Get reassigned worker info
  const { data: travailleur } = await admin
    .from('profiles')
    .select('prenom, nom, email')
    .eq('id', travailleurId)
    .single()

  if (!travailleur) return { error: 'Travailleur introuvable' }

  // Get bureau name
  const { data: bureau } = await admin
    .from('bureaux')
    .select('nom')
    .eq('id', bureauId)
    .single()

  // Insert reassignation
  const { error } = await admin
    .from('reassignations_temporaires')
    .insert({
      conge_id: congeId,
      travailleur_id: travailleurId,
      bureau_id: bureauId,
      date,
      demande_par: adminUser.id,
      statut: 'en_attente',
      vu_par_travailleur: false,
    })

  if (error) {
    if (error.code === '23505') return { error: 'Réaffectation déjà existante pour ce travailleur à cette date' }
    return { error: error.message }
  }

  // Audit
  const congeProfile = (conge as any).profile
  await logAudit({
    targetUserId: travailleurId,
    actorUserId: adminUser.id,
    action: 'reassignation.creation',
    category: 'admin',
    description: `Réaffectation proposée: ${travailleur.prenom} ${travailleur.nom} au bureau ${bureau?.nom ?? bureauId} le ${formatDateFr(date)} (remplacement de ${congeProfile?.prenom ?? ''} ${congeProfile?.nom ?? ''})`,
    metadata: { conge_id: congeId, bureau_id: bureauId, date },
  })

  // Email (non-blocking)
  sendReassignationEmail({
    email: travailleur.email,
    prenom: travailleur.prenom,
    bureauNom: bureau?.nom ?? 'Bureau',
    date: formatDateFr(date),
    raisonPrenom: congeProfile?.prenom ?? '',
    raisonNom: congeProfile?.nom ?? '',
  })

  revalidatePath('/admin/conges')
  return { success: true }
}
```

- [ ] **Step 4: Create lib/reassignations/actions.ts — worker-facing actions**

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit/logger'
import type { ReassignationTemporaire } from '@/types/database'

export async function getReassignationsEnAttente(): Promise<ReassignationTemporaire[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('reassignations_temporaires')
    .select('*, bureau:bureaux!bureau_id(nom, code), conge:conges!conge_id(user_id, date_debut, date_fin, profile:profiles!user_id(prenom, nom))')
    .eq('travailleur_id', user.id)
    .eq('statut', 'en_attente')
    .order('date', { ascending: true })

  return (data ?? []) as ReassignationTemporaire[]
}

export async function repondreReassignation(
  id: string,
  accepte: boolean,
  commentaire?: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Verify reassignation exists and belongs to user
  const { data: reassignation } = await admin
    .from('reassignations_temporaires')
    .select('*, bureau:bureaux!bureau_id(nom)')
    .eq('id', id)
    .eq('travailleur_id', user.id)
    .eq('statut', 'en_attente')
    .single()

  if (!reassignation) return { error: 'Réaffectation introuvable ou déjà traitée' }

  const newStatut = accepte ? 'accepte' : 'refuse'

  // Update via admin client (controlled columns only)
  const { error } = await admin
    .from('reassignations_temporaires')
    .update({
      statut: newStatut,
      repondu_le: new Date().toISOString(),
      commentaire: commentaire ?? null,
      vu_par_travailleur: true,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // If accepted, create bureau_affectations_temp entry
  // IMPORTANT: Verify this table exists in the database before running.
  // If it doesn't exist, add it to the migration in Task 1.
  if (accepte) {
    await admin
      .from('bureau_affectations_temp')
      .upsert({
        user_id: user.id,
        bureau_id: reassignation.bureau_id,
        date: reassignation.date,
        created_by: reassignation.demande_par,
      }, { onConflict: 'user_id,date' })
  }

  // If refused, mark vu_par_travailleur=false on the conge-side for admin notification
  if (!accepte) {
    // The admin notification count will pick this up via reassignationsRefusees
  }

  // Audit
  const bureauNom = (reassignation as any).bureau?.nom ?? ''
  await logAudit({
    targetUserId: user.id,
    actorUserId: user.id,
    action: accepte ? 'reassignation.accepte' : 'reassignation.refuse',
    category: 'conges', // Worker action related to congé workflow
    description: `Réaffectation ${accepte ? 'acceptée' : 'refusée'}: bureau ${bureauNom} le ${reassignation.date}`,
    metadata: { reassignation_id: id, conge_id: reassignation.conge_id, accepte },
    commentaire: commentaire ?? null,
  })

  revalidatePath('/')
  revalidatePath('/admin/conges')
  return { success: true }
}
```

- [ ] **Step 5: Commit**

```bash
git add emails/ReassignationEmail.tsx lib/resend/emails.ts lib/conges/admin-actions.ts lib/reassignations/actions.ts
git commit -m "feat: add reassignment CRUD actions, email template, and worker response flow"
```

---

## Task 4: Install shadcn Sheet + Build Drawer UI

**Files:**
- Create: `components/ui/sheet.tsx` (via shadcn CLI)
- Create: `components/admin/CongeApprovalDrawer.tsx`
- Create: `components/admin/CongeApprovalDrawer/ZoneSoldes.tsx`
- Create: `components/admin/CongeApprovalDrawer/ZoneCouverture.tsx`
- Create: `components/admin/CongeApprovalDrawer/ZoneReassignation.tsx`

- [ ] **Step 1: Install shadcn Sheet component**

```bash
npx shadcn@latest add sheet
```

Expected: `components/ui/sheet.tsx` created.

- [ ] **Step 2: Create ZoneSoldes.tsx**

Create `components/admin/CongeApprovalDrawer/ZoneSoldes.tsx`:

```tsx
'use client'

import type { WorkerSoldes } from '@/lib/conges/context-actions'

function AlertBadge({ alert, label }: { alert: 'ok' | 'warning' | 'danger'; label: string }) {
  const colors = {
    ok: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-orange-50 text-orange-700 border-orange-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[alert]}`}>
      {label}
    </span>
  )
}

function SoldeRow({ label, restant, apres, total, alert }: {
  label: string; restant: number; apres: number; total: number; alert: 'ok' | 'warning' | 'danger'
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium">{restant}/{total} jours</span>
        <span className="text-[10px] text-gray-400">→</span>
        <AlertBadge alert={alert} label={`${apres} après`} />
      </div>
    </div>
  )
}

export default function ZoneSoldes({ soldes, congeType }: { soldes: WorkerSoldes; congeType: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Soldes du travailleur</h4>

      <SoldeRow
        label="Congés annuels"
        restant={soldes.congesAnnuels.restant}
        apres={soldes.congesAnnuels.apresApprobation}
        total={soldes.congesAnnuels.total}
        alert={soldes.congesAnnuels.alert}
      />
      <SoldeRow
        label="Repos compensatoire"
        restant={soldes.reposComp.restant}
        apres={soldes.reposComp.apresApprobation}
        total={soldes.reposComp.total}
        alert={soldes.reposComp.alert}
      />
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-gray-600">Récupération (pot d'heures)</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium">{soldes.recuperation.soldeJours}j ({soldes.recuperation.soldeMinutes}min)</span>
          <span className="text-[10px] text-gray-400">→</span>
          <AlertBadge alert={soldes.recuperation.alert} label={`${soldes.recuperation.apresApprobationJours}j après`} />
        </div>
      </div>

      {/* Highlight the relevant balance for this leave type */}
      {congeType === 'conge_annuel' && soldes.congesAnnuels.alert === 'danger' && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-semibold">
          ⚠ Solde insuffisant : passera à {soldes.congesAnnuels.apresApprobation} jours après approbation
        </div>
      )}
      {congeType === 'conge_annuel' && soldes.congesAnnuels.alert === 'warning' && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-[10px] text-orange-700 font-semibold">
          ⚠ Solde sera épuisé après approbation
        </div>
      )}
      {congeType === 'repos_comp' && soldes.reposComp.alert === 'danger' && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-semibold">
          ⚠ Solde insuffisant : passera à {soldes.reposComp.apresApprobation} jours après approbation
        </div>
      )}
      {congeType === 'recuperation' && soldes.recuperation.alert === 'danger' && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-semibold">
          ⚠ Pot d'heures insuffisant : passera à {soldes.recuperation.apresApprobationJours} jours après approbation
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create ZoneCouverture.tsx**

Create `components/admin/CongeApprovalDrawer/ZoneCouverture.tsx`:

```tsx
'use client'

import type { DayCoverage } from '@/lib/conges/context-actions'
import { formatDateFr } from '@/lib/utils/dates'

const joursSemaine = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const statusIcons: Record<string, string> = {
  present: '✅',
  conge: '🏖',
  maladie: '🤒',
  absent: '❌',
  demandeur: '👤',
}

function CoverageIndicator({ present, total, ratio }: { present: number; total: number; ratio: number }) {
  const color = ratio > 0.5 ? 'text-green-600 bg-green-50' : ratio === 0.5 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      {present}/{total} présents
    </span>
  )
}

export default function ZoneCouverture({ coverage }: { coverage: DayCoverage[] }) {
  if (coverage.length === 0) return null

  // Group by week if > 5 days
  const showGrouped = coverage.length > 5

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Couverture du bureau</h4>

      <div className="space-y-2">
        {coverage.map((day) => (
          <div key={day.date} className={`rounded-lg p-2 ${day.alert ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500">{joursSemaine[day.dayOfWeek]}</span>
                <span className="text-[11px] font-semibold">{formatDateFr(day.date)}</span>
                <span className="text-[10px] text-gray-400">{day.bureauNom}</span>
              </div>
              <CoverageIndicator present={day.present} total={day.total} ratio={day.ratio} />
            </div>

            {/* Worker list — collapsed by default if many days */}
            <div className={`flex flex-wrap gap-1 ${showGrouped ? 'mt-1' : 'mt-1'}`}>
              {day.workers.map((w) => (
                <span
                  key={w.userId}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    w.statut === 'demandeur' ? 'bg-gray-200 text-gray-500 line-through' :
                    w.statut === 'present' ? 'bg-green-100 text-green-700' :
                    w.statut === 'conge' ? 'bg-blue-100 text-blue-700' :
                    w.statut === 'maladie' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}
                >
                  {statusIcons[w.statut]} {w.prenom} {w.nom[0]}.
                </span>
              ))}
            </div>

            {day.alert && day.present === 0 && (
              <div className="mt-1 text-[10px] text-red-600 font-semibold">
                ⚠ Bureau non couvert ce jour
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create ZoneReassignation.tsx**

Create `components/admin/CongeApprovalDrawer/ZoneReassignation.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { creerReassignation } from '@/lib/conges/admin-actions'
import { formatDateFr } from '@/lib/utils/dates'
import type { DayAvailability, DayCoverage } from '@/lib/conges/context-actions'
import type { ReassignationTemporaire } from '@/types/database'

const statutLabels: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  accepte: { label: 'Acceptée', color: 'bg-green-100 text-green-700' },
  refuse: { label: 'Refusée', color: 'bg-red-100 text-red-700' },
}

export default function ZoneReassignation({
  congeId, availability, coverage, existingReassignations, onReassigned,
}: {
  congeId: string
  availability: DayAvailability[]
  coverage: DayCoverage[]
  existingReassignations: ReassignationTemporaire[]
  onReassigned: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const alertDays = coverage.filter(d => d.alert)
  if (alertDays.length === 0) return null

  function handleReassign(travailleurId: string, bureauId: string, date: string) {
    setError(null)
    startTransition(async () => {
      const result = await creerReassignation(congeId, travailleurId, bureauId, date)
      if (result.error) {
        setError(result.error)
      } else {
        onReassigned()
      }
    })
  }

  return (
    <div className="bg-white rounded-lg border border-orange-200 p-3">
      <h4 className="text-[11px] font-bold text-orange-600 uppercase mb-2">
        ⚠ Réaffectation suggérée
      </h4>

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
          {error}
        </div>
      )}

      {/* Show existing reassignations */}
      {existingReassignations.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-[10px] font-semibold text-gray-500">Réaffectations en cours :</p>
          {existingReassignations.map((r) => {
            const s = statutLabels[r.statut] ?? statutLabels.en_attente
            return (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded p-1.5">
                <span className="text-[10px]">
                  {r.profile?.prenom} {r.profile?.nom} → {r.bureau?.nom} le {formatDateFr(r.date)}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Available workers per alert day */}
      {availability.map((day) => {
        const dayReassignations = existingReassignations.filter(r => r.date === day.date)
        const alreadyAssignedIds = dayReassignations.map(r => r.travailleur_id)

        return (
          <div key={day.date} className="mb-3">
            <p className="text-[10px] font-bold text-gray-600 mb-1">
              {formatDateFr(day.date)} — {day.bureauNom}
            </p>
            {day.availableWorkers.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">Aucun travailleur disponible</p>
            ) : (
              <div className="space-y-1">
                {day.availableWorkers.map((w) => {
                  const alreadyAssigned = alreadyAssignedIds.includes(w.userId)
                  return (
                    <div key={w.userId} className="flex items-center justify-between bg-gray-50 rounded p-1.5">
                      <div>
                        <span className="text-[10px] font-medium">{w.prenom} {w.nom}</span>
                        {w.currentBureau && (
                          <span className="text-[9px] text-gray-400 ml-1">({w.currentBureau})</span>
                        )}
                      </div>
                      {alreadyAssigned ? (
                        <span className="text-[9px] text-gray-400">Déjà proposé</span>
                      ) : (
                        <button
                          onClick={() => handleReassign(w.userId, day.bureauId, day.date)}
                          disabled={isPending}
                          className="text-[9px] font-bold text-white bg-[#e53e3e] hover:bg-[#c53030] px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                        >
                          Réaffecter
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Create the main CongeApprovalDrawer.tsx**

Create `components/admin/CongeApprovalDrawer.tsx`:

```tsx
'use client'

import { useState, useEffect, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { traiterCongeAction } from '@/lib/conges/admin-actions'
import { getCongeContext, type CongeContext } from '@/lib/conges/context-actions'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'
import ZoneSoldes from '@/components/admin/CongeApprovalDrawer/ZoneSoldes'
import ZoneCouverture from '@/components/admin/CongeApprovalDrawer/ZoneCouverture'
import ZoneReassignation from '@/components/admin/CongeApprovalDrawer/ZoneReassignation'
import type { Conge, Profile } from '@/types/database'

type CongeWithProfile = Conge & { profile?: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conge: CongeWithProfile
  open: boolean
  onClose: () => void
  onDone: () => void
}

export default function CongeApprovalDrawer({ conge, open, onClose, onDone }: Props) {
  const [context, setContext] = useState<CongeContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [isPending, startTransition] = useTransition()

  // Load context when drawer opens
  useEffect(() => {
    if (open && conge.id) {
      setLoading(true)
      setError(null)
      getCongeContext(conge.id).then((result) => {
        if (result.error) setError(result.error)
        else if (result.data) setContext(result.data)
        setLoading(false)
      })
    }
  }, [open, conge.id])

  function refreshContext() {
    getCongeContext(conge.id).then((result) => {
      if (result.data) setContext(result.data)
    })
  }

  function handleDecision(decision: 'approuve' | 'refuse') {
    startTransition(async () => {
      const result = await traiterCongeAction(conge.id, decision, commentaire || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        onDone()
        onClose()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:w-[560px] overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-gray-200 bg-gray-50">
          <SheetTitle className="text-sm font-bold text-[#1a2332]">
            Traitement de congé
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Zone 1 — Résumé */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Demande</h4>
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-[#1a2332]">
                {conge.profile?.prenom} {conge.profile?.nom}
              </p>
              <p className="text-[11px] text-gray-600">
                <span className="font-medium">{labelTypeConge(conge.type)}</span>
                {' · '}
                {formatDateFr(conge.date_debut)} → {formatDateFr(conge.date_fin)}
                {' · '}
                <span className="font-bold">{conge.nb_jours} jour{conge.nb_jours > 1 ? 's' : ''}</span>
              </p>
              {conge.commentaire_travailleur && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-[10px] text-blue-700">{conge.commentaire_travailleur}</p>
                </div>
              )}
              {conge.type === 'maladie' && conge.piece_jointe_url && (
                // NOTE: Use getSignedUrlAdminAction() to generate a signed URL
                // instead of linking directly to the storage path.
                // Call it in useEffect alongside getCongeContext and store in state.
                <a
                  href={signedCertUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-[10px] text-[#e53e3e] underline font-semibold"
                >
                  📎 Certificat médical
                </a>
              )}
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-[#e53e3e] rounded-full mx-auto" />
              <p className="text-[10px] text-gray-400 mt-2">Chargement du contexte...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
              {error}
            </div>
          )}

          {/* Zone 2 — Soldes */}
          {context && <ZoneSoldes soldes={context.soldes} congeType={conge.type} />}

          {/* Zone 3 — Couverture */}
          {context && <ZoneCouverture coverage={context.coverage} />}

          {/* Zone 4 — Réaffectation */}
          {context && (
            <ZoneReassignation
              congeId={conge.id}
              availability={context.availability}
              coverage={context.coverage}
              existingReassignations={context.existingReassignations}
              onReassigned={refreshContext}
            />
          )}
        </div>

        {/* Zone décision — sticky bottom */}
        {conge.statut === 'en_attente' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-3">
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire (optionnel)..."
              rows={2}
              className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision('approuve')}
                disabled={isPending}
                className="flex-1 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? '...' : '✓ Approuver'}
              </button>
              <button
                onClick={() => handleDecision('refuse')}
                disabled={isPending}
                className="flex-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? '...' : '✗ Refuser'}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/sheet.tsx components/admin/CongeApprovalDrawer.tsx components/admin/CongeApprovalDrawer/
git commit -m "feat: create CongeApprovalDrawer with soldes, coverage, and reassignment zones"
```

---

## Task 5: Wire Drawer into CongesTable

**Files:**
- Modify: `components/admin/CongesTable.tsx`

- [ ] **Step 1: Replace CongeApprovalModal with CongeApprovalDrawer in CongesTable.tsx**

In `components/admin/CongesTable.tsx`, replace the import and usage:

```typescript
// Replace:
import CongeApprovalModal from './CongeApprovalModal'
// With:
import CongeApprovalDrawer from './CongeApprovalDrawer'
```

And in the JSX, replace:

```tsx
// Replace:
{selectedConge && (
  <CongeApprovalModal
    conge={selectedConge}
    open={true}
    onClose={() => setSelectedConge(null)}
    onDone={reloadPage}
  />
)}

// With:
{selectedConge && (
  <CongeApprovalDrawer
    conge={selectedConge}
    open={true}
    onClose={() => setSelectedConge(null)}
    onDone={reloadPage}
  />
)}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

Expected: Build succeeds with no new errors.

- [ ] **Step 3: Delete the old CongeApprovalModal.tsx**

```bash
rm components/admin/CongeApprovalModal.tsx
```

Verify no other file imports it. If the dashboard also used it, update those imports too.

- [ ] **Step 4: Commit**

```bash
git add components/admin/CongesTable.tsx && git rm components/admin/CongeApprovalModal.tsx
git commit -m "feat: replace CongeApprovalModal with CongeApprovalDrawer in CongesTable"
```

---

## Task 6: Notifications — Extend counts + banner for reassignments

**Files:**
- Modify: `lib/notifications/counts.ts`
- Modify: `lib/notifications/actions.ts`
- Modify: `components/dashboard/NotificationsBanner.tsx`

- [ ] **Step 1: Extend NotificationCounts in counts.ts**

In `lib/notifications/counts.ts`, add to the `NotificationCounts` interface:

```typescript
// Add these fields:
reassignationsEnAttente: number  // Worker: pending reassignation proposals
reassignationsRefusees: number   // Admin: refused reassignations to review
```

And add the queries in `getNotificationCounts()`:

For worker section:
```typescript
// Reassignations en attente pour le travailleur
const { count: reassignationsEnAttente } = await admin
  .from('reassignations_temporaires')
  .select('*', { count: 'exact', head: true })
  .eq('travailleur_id', user.id)
  .eq('statut', 'en_attente')
```

For admin section:
```typescript
// Reassignations refusées (admin doit en prendre connaissance)
const { count: reassignationsRefusees } = await admin
  .from('reassignations_temporaires')
  .select('*', { count: 'exact', head: true })
  .eq('statut', 'refuse')
```

Update the return object and the badge calculation in Sidebar accordingly.

- [ ] **Step 2: Extend UnreadDecision type in actions.ts**

In `lib/notifications/actions.ts`:

Add to the `UnreadDecision` union type:
```typescript
| { type: 'reassignation'; data: ReassignationTemporaire }
```

In `getUnreadDecisions()`, add a query for pending reassignations:
```typescript
const { data: reassignations } = await supabase
  .from('reassignations_temporaires')
  .select('*, bureau:bureaux!bureau_id(nom, code), conge:conges!conge_id(user_id, profile:profiles!user_id(prenom, nom))')
  .eq('travailleur_id', user.id)
  .eq('statut', 'en_attente')

for (const r of reassignations ?? []) {
  decisions.push({ type: 'reassignation', data: r as ReassignationTemporaire })
}
```

In `markDecisionVue()`, add `'reassignations_temporaires'` to the allowed table union type.

> **IMPORTANT:** The `reassignations_temporaires` table uses `travailleur_id` instead of `user_id`. The existing `markDecisionVue` query uses `.eq('user_id', ...)`. Add a conditional: if `table === 'reassignations_temporaires'`, use `.eq('travailleur_id', user.id)` instead of `.eq('user_id', user.id)`.

```typescript
const column = table === 'reassignations_temporaires' ? 'travailleur_id' : 'user_id'
await admin.from(table).update({ vu_par_travailleur: true }).eq(column, user.id).eq('id', id)
```

In `markAllDecisionsVues()`, add:
```typescript
await admin
  .from('reassignations_temporaires')
  .update({ vu_par_travailleur: true })
  .eq('travailleur_id', user.id)
  .eq('vu_par_travailleur', false)
```

- [ ] **Step 3: Add reassignment card to NotificationsBanner.tsx**

In `components/dashboard/NotificationsBanner.tsx`, add handling for `type === 'reassignation'`:

```tsx
// In the decision mapping, add a case:
if (d.type === 'reassignation') {
  const r = d.data as ReassignationTemporaire
  const congeProfile = (r as any).conge?.profile
  const bureauNom = (r as any).bureau?.nom ?? 'Bureau'
  return (
    <div key={r.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-3">
      <div>
        <p className="text-[11px] font-semibold text-orange-700">
          📋 Demande de réaffectation
        </p>
        <p className="text-[10px] text-orange-600">
          Bureau {bureauNom} le {formatDateFr(r.date)} — remplacer {congeProfile?.prenom ?? ''} {congeProfile?.nom ?? ''}
        </p>
      </div>
      <div className="flex gap-1">
        <button onClick={() => handleAcceptReassignation(r.id)} ...>Accepter</button>
        <button onClick={() => handleRefuseReassignation(r.id)} ...>Refuser</button>
      </div>
    </div>
  )
}
```

Add the accept/refuse handlers using `repondreReassignation()`:
```typescript
import { repondreReassignation } from '@/lib/reassignations/actions'

function handleAcceptReassignation(id: string) {
  startTransition(async () => {
    await repondreReassignation(id, true)
    router.refresh()
  })
}

function handleRefuseReassignation(id: string) {
  startTransition(async () => {
    await repondreReassignation(id, false)
    router.refresh()
  })
}
```

- [ ] **Step 4: Update Sidebar badge calculation**

In `components/layout/Sidebar.tsx`, update the Accueil badge for workers to include `reassignationsEnAttente`:

```typescript
// Worker Accueil badge:
const accueilBadge = counts.decisionsConges + counts.decisionsHS + counts.decisionsCorrections + counts.reassignationsEnAttente

// Admin Congés RH badge:
const congesBadge = counts.congesATraiter + counts.reassignationsRefusees
```

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications/counts.ts lib/notifications/actions.ts components/dashboard/NotificationsBanner.tsx components/layout/Sidebar.tsx
git commit -m "feat: extend notification system with reassignment counts and banner cards"
```

---

## Task 7: Integration Testing + Final Verification

- [ ] **Step 1: Start the dev server and verify no console errors**

```bash
npm run dev
```

Navigate to admin congés page. Click on a pending leave request. Verify:
- Drawer opens (not modal)
- Zone 1 shows request summary
- Zone 2 shows all balances with correct alerts
- Zone 3 shows bureau coverage per day
- Zone 4 appears only if coverage is low

- [ ] **Step 2: Test reassignment flow**

1. Click "Réaffecter" on an available worker
2. Verify the reassignment appears in "Réaffectations en cours" section
3. Log in as the reassigned worker
4. Verify badge appears on Accueil
5. Verify NotificationsBanner shows the reassignment with Accept/Refuse
6. Click Accept → verify `bureau_affectations_temp` entry created
7. Verify badge disappears

- [ ] **Step 3: Test approve/refuse still works**

1. As admin, approve a leave request via the drawer
2. Verify balances updated
3. Verify day_statuses created
4. Verify worker receives notification

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for enriched leave approval drawer"
```
