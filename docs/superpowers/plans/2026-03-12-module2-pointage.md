# Module 2 — Pointage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a time-tracking module (pointage) with a worker clock-in widget, a personal monthly recap page, and an interactive admin recap grid with status correction modals.

**Architecture:** Two Supabase tables (`pointage`, `day_statuses`) with RLS; server actions in dedicated files; worker dashboard recreated with 3 widgets; admin recap replaced to show real pointage status instead of bureau assignments; a modal for admin corrections.

**Tech Stack:** Next.js 14 App Router, Supabase (server client + admin client), Server Actions, React Server Components, Tailwind CSS, shadcn/ui (Button, Dialog, Select, DropdownMenu).

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `types/database.ts` | Add `Pointage`, `DayStatusRecord` types |
| Create | `lib/pointage/actions.ts` | Worker server actions: `pointerAction`, fetch today's pointage |
| Create | `lib/pointage/admin-actions.ts` | Admin server actions: `updateDayStatusAction`, `correctPointageAction` |
| Create | `app/(dashboard)/page.tsx` | Worker dashboard (was deleted) — 3 widgets |
| Create | `app/(dashboard)/pointage/page.tsx` | Worker personal monthly recap |
| Modify | `components/admin/RecapMensuel.tsx` | Replace bureau-grid with pointage-status grid |
| Create | `components/admin/PointageManquantModal.tsx` | Modal for missing pointage correction |
| Modify | `app/(dashboard)/admin/recap/page.tsx` | Fetch pointage + day_statuses data |

---

## Chunk 1: Database & Types

### Task 1: Supabase Migration — table `pointage`

**Files:**
- Supabase migration (run via MCP tool)

- [ ] **Step 1: Apply the migration**

```sql
CREATE TABLE pointage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  date date NOT NULL,
  arrivee timestamptz,
  midi_out timestamptz,
  midi_in timestamptz,
  depart timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE pointage ENABLE ROW LEVEL SECURITY;

-- Worker sees only their own rows
CREATE POLICY "worker_own_pointage" ON pointage
  FOR ALL USING (auth.uid() = user_id);

-- Admin sees everything (service role bypasses RLS, but for anon/authenticated admin:)
-- We use service role (createAdminClient) for admin reads, so worker policy is sufficient.
-- Add explicit admin read policy for authenticated admins:
CREATE POLICY "admin_all_pointage" ON pointage
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true
    )
  );
```

- [ ] **Step 2: Verify in Supabase dashboard** — table `pointage` exists with correct columns and constraints.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat(db): add pointage table with RLS"
```

---

### Task 2: Supabase Migration — table `day_statuses`

**Files:**
- Supabase migration (run via MCP tool)

- [ ] **Step 1: Apply the migration**

```sql
CREATE TABLE day_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('P','C','M','R','F','A')),
  commentaire text,
  corrige_par uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE day_statuses ENABLE ROW LEVEL SECURITY;

-- Worker: read only their own rows
CREATE POLICY "worker_read_own_day_statuses" ON day_statuses
  FOR SELECT USING (auth.uid() = user_id);

-- Admin: full access
CREATE POLICY "admin_all_day_statuses" ON day_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true
    )
  );
```

- [ ] **Step 2: Verify** — table `day_statuses` exists.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat(db): add day_statuses table with RLS"
```

---

### Task 3: TypeScript Types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add `Pointage` and `DayStatusRecord` types**

Open `types/database.ts` and append at the end:

```typescript
export type Pointage = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  arrivee: string | null   // ISO timestamptz
  midi_out: string | null
  midi_in: string | null
  depart: string | null
  created_at: string
}

export type DayStatusRecord = {
  id: string
  user_id: string
  date: string          // 'YYYY-MM-DD'
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A'
  commentaire: string | null
  corrige_par: string | null
  created_at: string
}
```

- [ ] **Step 2: Commit**
```bash
git add types/database.ts
git commit -m "feat(types): add Pointage and DayStatusRecord types"
```

---

## Chunk 2: Server Actions

### Task 4: Worker pointage server action

**Files:**
- Create: `lib/pointage/actions.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Pointage } from '@/types/database'

export type PointageType = 'arrivee' | 'midi_out' | 'midi_in' | 'depart'

export async function pointerAction(type: PointageType): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  // Round to minute
  now.setSeconds(0, 0)
  const nowIso = now.toISOString()

  const { error } = await supabase.from('pointage').upsert(
    { user_id: user.id, date: today, [type]: nowIso },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function getTodayPointage(): Promise<Pointage | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('pointage')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  return data ?? null
}

export async function getWorkerMonthPointage(
  year: number,
  month: number
): Promise<Pointage[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await supabase
    .from('pointage')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  return data ?? []
}
```

- [ ] **Step 2: Commit**
```bash
git add lib/pointage/actions.ts
git commit -m "feat(pointage): add worker pointage server actions"
```

---

### Task 5: Admin pointage server actions

**Files:**
- Create: `lib/pointage/admin-actions.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DayStatusRecord, Pointage } from '@/types/database'

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

export async function updateDayStatusAction(
  targetUserId: string,
  date: string,
  status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A',
  commentaire?: string
): Promise<{ error?: string }> {
  const admin_user = await assertAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('day_statuses').upsert(
    {
      user_id: targetUserId,
      date,
      status,
      commentaire: commentaire ?? null,
      corrige_par: admin_user.id,
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
  revalidatePath('/admin/recap')
  return {}
}

export async function correctPointageAction(
  targetUserId: string,
  date: string,
  arrivee: string,
  midi_out: string,
  midi_in: string,
  depart: string
): Promise<{ error?: string }> {
  await assertAdmin()
  const admin = createAdminClient()

  // Helper: convert "HH:mm" to full ISO on the given date
  function toIso(date: string, time: string): string | null {
    if (!time) return null
    return new Date(`${date}T${time}:00`).toISOString()
  }

  const { error } = await admin.from('pointage').upsert(
    {
      user_id: targetUserId,
      date,
      arrivee: toIso(date, arrivee),
      midi_out: toIso(date, midi_out),
      midi_in: toIso(date, midi_in),
      depart: toIso(date, depart),
    },
    { onConflict: 'user_id,date' }
  )

  if (error) return { error: error.message }
  revalidatePath('/admin/recap')
  return {}
}

export async function getMonthPointageAdmin(
  year: number,
  month: number
): Promise<Pointage[]> {
  await assertAdmin()
  const admin = createAdminClient()

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await admin
    .from('pointage')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  return data ?? []
}

export async function getMonthDayStatusesAdmin(
  year: number,
  month: number
): Promise<DayStatusRecord[]> {
  await assertAdmin()
  const admin = createAdminClient()

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '00')}`

  const { data } = await admin
    .from('day_statuses')
    .select('*')
    .gte('date', from)
    .lte('date', to)

  return data ?? []
}
```

- [ ] **Step 2: Commit**
```bash
git add lib/pointage/admin-actions.ts
git commit -m "feat(pointage): add admin pointage server actions"
```

---

## Chunk 3: Worker UI

### Task 6: Worker Dashboard (`app/(dashboard)/page.tsx`)

**Context:** This file was deleted in the current branch. We recreate it with 3 widgets.

**Files:**
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Create the worker dashboard**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTodayPointage } from '@/lib/pointage/actions'
import { pointerAction } from '@/lib/pointage/actions'
import { Pointage, UserBureauSchedule, Bureau } from '@/types/database'
import PointageWidget from '@/components/dashboard/PointageWidget'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const dow = today.getDay() as 1 | 2 | 3 | 4 | 5 // Mon=1..Fri=5

  const [pointage, schedulesRes] = await Promise.all([
    getTodayPointage(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .eq('jour', dow)
      .single(),
  ])

  const bureauDuJour = (schedulesRes.data as (UserBureauSchedule & { bureau: Bureau }) | null)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-sm font-bold text-[#1a2332]">Tableau de bord</h1>

      {/* Widget Pointage du jour */}
      <PointageWidget pointage={pointage} />

      {/* Widget Bureau du jour */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          📍 Bureau du jour
        </p>
        <p className="text-sm font-semibold text-[#1a2332]">
          {today.getDay() === 0 || today.getDay() === 6
            ? 'Week-end'
            : bureauDuJour?.bureau?.nom ?? 'Sur la route'}
        </p>
      </div>

      {/* Widget Solde heures — placeholder Module 3 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          ⏱ Solde heures
        </p>
        <p className="text-2xl font-black text-[#1a2332]">0<span className="text-sm font-normal text-gray-400 ml-1">h</span></p>
        <p className="text-[9px] text-gray-400 mt-1">Calcul disponible en Module 3</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the PointageWidget client component**

Create `components/dashboard/PointageWidget.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { pointerAction, PointageType } from '@/lib/pointage/actions'
import { Pointage } from '@/types/database'

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STEPS: { type: PointageType; label: string }[] = [
  { type: 'arrivee', label: 'Arrivée' },
  { type: 'midi_out', label: 'Midi Out' },
  { type: 'midi_in', label: 'Midi In' },
  { type: 'depart', label: 'Départ' },
]

export default function PointageWidget({ pointage }: { pointage: Pointage | null }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Determine which step is next
  const fields: (keyof Pointage)[] = ['arrivee', 'midi_out', 'midi_in', 'depart']
  const nextIndex = fields.findIndex((f) => !pointage?.[f])
  // nextIndex === -1 means all done

  function handleClick(type: PointageType) {
    setError(null)
    startTransition(async () => {
      const result = await pointerAction(type)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        🕐 Pointage du jour
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map(({ type, label }, idx) => {
          const value = pointage?.[type as keyof Pointage] as string | null | undefined
          const isDone = Boolean(value)
          const isActive = !isDone && idx === nextIndex

          return (
            <button
              key={type}
              onClick={() => isActive && handleClick(type)}
              disabled={!isActive || isPending}
              className={[
                'flex flex-col items-center justify-center rounded-lg py-3 px-2 text-xs font-bold transition-all',
                isDone
                  ? 'bg-[#10b981] text-white cursor-default'
                  : isActive
                  ? 'bg-[#e53e3e] text-white hover:bg-[#c53030] cursor-pointer shadow-md'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed',
              ].join(' ')}
            >
              <span className="text-[10px] font-normal opacity-80">{label}</span>
              {isDone && (
                <span className="mt-0.5 text-[11px] font-black">{formatTime(value!)}</span>
              )}
              {!isDone && isActive && (
                <span className="mt-0.5 text-[10px] opacity-70">
                  {isPending ? '…' : 'Cliquer'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-red-600 bg-red-50 rounded p-1.5">{error}</p>
      )}
      {nextIndex === -1 && (
        <p className="mt-2 text-[10px] text-green-600 text-center">✓ Journée complète</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and verify dashboard renders**

Run: `npm run dev`
Navigate to `/` after login as a worker. Confirm 3 widgets visible.

- [ ] **Step 4: Commit**
```bash
git add app/(dashboard)/page.tsx components/dashboard/PointageWidget.tsx
git commit -m "feat(dashboard): recreate worker dashboard with 3 widgets"
```

---

### Task 7: Worker Personal Pointage Page (`/pointage`)

**Files:**
- Create: `app/(dashboard)/pointage/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWorkerMonthPointage } from '@/lib/pointage/actions'
import Link from 'next/link'
import { Pointage } from '@/types/database'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getAllDaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default async function PointagePage({
  searchParams,
}: {
  searchParams: { mois?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (searchParams.mois) {
    const [y, m] = searchParams.mois.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) { year = y; month = m }
  }

  const pointages = await getWorkerMonthPointage(year, month)
  const byDate: Record<string, Pointage> = {}
  for (const p of pointages) byDate[p.date] = p

  const days = getAllDaysOfMonth(year, month)
  const today = now.toISOString().slice(0, 10)

  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-[#1a2332]">
          ⏱ Mon pointage — {MOIS_FR[month - 1]} {year}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/pointage?mois=${prevParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            ← Précédent
          </Link>
          <Link
            href={`/pointage?mois=${nextParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#1a2332] text-white text-[10px]">
              <th className="text-left px-3 py-2 font-semibold">Date</th>
              <th className="text-center px-2 py-2">Arrivée</th>
              <th className="text-center px-2 py-2">Midi Out</th>
              <th className="text-center px-2 py-2">Midi In</th>
              <th className="text-center px-2 py-2">Départ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {days.map((d) => {
              const dow = d.getDay()
              const isWeekend = dow === 0 || dow === 6
              const dateStr = d.toISOString().slice(0, 10)
              const isToday = dateStr === today
              const p = byDate[dateStr]
              const DOW_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

              return (
                <tr
                  key={dateStr}
                  className={[
                    isWeekend ? 'bg-gray-50 text-gray-300' : 'hover:bg-gray-50',
                    isToday ? 'bg-red-50' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-1.5 font-medium text-[#1a2332]">
                    <span className="text-[9px] text-gray-400 mr-1">{DOW_FR[dow]}</span>
                    {d.getDate()}
                  </td>
                  {isWeekend ? (
                    <td colSpan={4} className="text-center text-gray-200 text-[9px]">—</td>
                  ) : (
                    <>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.arrivee ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.midi_out ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.midi_in ?? null)}</td>
                      <td className="text-center px-2 py-1.5 text-[#1a2332]">{formatTime(p?.depart ?? null)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — navigate to `/pointage` as a worker. Table renders with all days of the month.

- [ ] **Step 3: Commit**
```bash
git add app/(dashboard)/pointage/page.tsx
git commit -m "feat(pointage): add worker personal monthly pointage page"
```

---

## Chunk 4: Admin Recap & Modal

### Task 8: PointageManquantModal

**Files:**
- Create: `components/admin/PointageManquantModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateDayStatusAction, correctPointageAction } from '@/lib/pointage/admin-actions'

type Mode = 'choice' | 'absence' | 'conge' | 'correction'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  date: string          // 'YYYY-MM-DD'
  workerName: string
}

export default function PointageManquantModal({
  open,
  onClose,
  userId,
  date,
  workerName,
}: Props) {
  const [mode, setMode] = useState<Mode>('choice')
  const [congeType, setCongeType] = useState<'C' | 'M' | 'R'>('C')
  const [arrivee, setArrivee] = useState('09:00')
  const [midiOut, setMidiOut] = useState('12:30')
  const [midiIn, setMidiIn] = useState('13:30')
  const [depart, setDepart] = useState('17:30')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setMode('choice')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleAbsent() {
    setError(null)
    startTransition(async () => {
      const res = await updateDayStatusAction(userId, date, 'A', 'Absent non justifié')
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  function handleConge() {
    setError(null)
    startTransition(async () => {
      const res = await updateDayStatusAction(userId, date, congeType)
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  function handleCorrection() {
    setError(null)
    startTransition(async () => {
      const res = await correctPointageAction(userId, date, arrivee, midiOut, midiIn, depart)
      if (res?.error) { setError(res.error); return }
      handleClose()
    })
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Pointage manquant
          </DialogTitle>
          <p className="text-[10px] text-gray-500">{workerName} — {dateLabel}</p>
        </DialogHeader>

        {error && (
          <p className="text-[10px] text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        {mode === 'choice' && (
          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('absence')}
            >
              🚫 Absent non justifié
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('conge')}
            >
              🌴 Congé / Maladie / Autre
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setMode('correction')}
            >
              ✏️ Correction manuelle
            </Button>
          </div>
        )}

        {mode === 'absence' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-600">
              Marquer comme absent non justifié (A) ?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>Retour</Button>
              <Button
                size="sm"
                className="bg-[#e53e3e] text-white text-xs hover:bg-[#c53030]"
                onClick={handleAbsent}
                disabled={isPending}
              >
                {isPending ? '…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'conge' && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-600">Type</p>
              <div className="flex gap-2">
                {(['C', 'M', 'R'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCongeType(t)}
                    className={[
                      'flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors',
                      congeType === t
                        ? 'bg-[#1a2332] text-white border-[#1a2332]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                    ].join(' ')}
                  >
                    {t === 'C' ? '🌴 Congé' : t === 'M' ? '🏥 Maladie' : '📌 Autre'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>Retour</Button>
              <Button
                size="sm"
                className="bg-[#1a2332] text-white text-xs"
                onClick={handleConge}
                disabled={isPending}
              >
                {isPending ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'correction' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Arrivée', value: arrivee, set: setArrivee },
                { label: 'Midi Out', value: midiOut, set: setMidiOut },
                { label: 'Midi In', value: midiIn, set: setMidiIn },
                { label: 'Départ', value: depart, set: setDepart },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-[10px] text-gray-500">{label}</label>
                  <input
                    type="time"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode('choice')}>Retour</Button>
              <Button
                size="sm"
                className="bg-[#1a2332] text-white text-xs"
                onClick={handleCorrection}
                disabled={isPending}
              >
                {isPending ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add components/admin/PointageManquantModal.tsx
git commit -m "feat(admin): add PointageManquantModal for missing pointage correction"
```

---

### Task 9: New RecapMensuel with pointage statuses

**Files:**
- Modify: `components/admin/RecapMensuel.tsx` (full replacement)

The component receives real pointage + day_statuses data and computes derived status per cell.

**Status computation logic:**
- `isWeekend(d)` → `'W'`
- `isFuture(d)` → `'-'`
- `day_statuses[userId][date]` exists → use that status
- `pointage[userId][date]` has all 4 fields → `'P'`
- Otherwise → `'?'`

**Color map:**
```
P → #10b981 (green), C → #f59e0b (amber), M → #ef4444 (red),
R → #6c63ff (violet), F → #6b7280 (gray), A → #f97316 (orange),
? → red dashed, W → gray-100, - → dotted gray
```

- [ ] **Step 1: Replace the component**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Profile, Service, UserBureauSchedule, Pointage, DayStatusRecord, DayStatus } from '@/types/database'
import { updateDayStatusAction } from '@/lib/pointage/admin-actions'
import PointageManquantModal from '@/components/admin/PointageManquantModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type WorkerRow = Profile & { service?: Service }

interface Props {
  workers: WorkerRow[]
  year: number
  month: number
  allPointages: Pointage[]
  allDayStatuses: DayStatusRecord[]
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const STATUS_LABELS: Record<string, string> = {
  P: 'Présent', C: 'Congé', M: 'Maladie', R: 'Récup.', F: 'Férié', A: 'Absent',
}

const STATUS_BG: Record<DayStatus, string> = {
  P: 'bg-[#10b981] text-white',
  C: 'bg-[#f59e0b] text-white',
  M: 'bg-[#ef4444] text-white',
  R: 'bg-[#6c63ff] text-white',
  F: 'bg-[#6b7280] text-white',
  A: 'bg-[#f97316] text-white',
  '?': 'bg-white text-red-600 border border-red-400 border-dashed',
  W: 'bg-gray-100 text-gray-300',
  '-': 'bg-white text-gray-200 border border-dotted border-gray-200',
}

function getAllWeekdays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    if (d.getDay() >= 1 && d.getDay() <= 5) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function computeStatus(
  userId: string,
  dateStr: string,
  date: Date,
  today: Date,
  pointageMap: Record<string, Record<string, Pointage>>,
  statusMap: Record<string, Record<string, DayStatusRecord>>
): DayStatus {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return 'W'
  if (date > today) return '-'

  const ds = statusMap[userId]?.[dateStr]
  if (ds) return ds.status as DayStatus

  const p = pointageMap[userId]?.[dateStr]
  if (p && p.arrivee && p.midi_out && p.midi_in && p.depart) return 'P'

  return '?'
}

export default function RecapMensuel({
  workers,
  year,
  month,
  allPointages,
  allDayStatuses,
}: Props) {
  const weekdays = getAllWeekdays(year, month)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build lookup maps
  const pointageMap: Record<string, Record<string, Pointage>> = {}
  for (const p of allPointages) {
    if (!pointageMap[p.user_id]) pointageMap[p.user_id] = {}
    pointageMap[p.user_id][p.date] = p
  }
  const statusMap: Record<string, Record<string, DayStatusRecord>> = {}
  for (const ds of allDayStatuses) {
    if (!statusMap[ds.user_id]) statusMap[ds.user_id] = {}
    statusMap[ds.user_id][ds.date] = ds
  }

  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

  // Modal state
  const [modal, setModal] = useState<{ userId: string; date: string; workerName: string } | null>(null)

  async function handleStatusChange(userId: string, date: string, status: 'P' | 'C' | 'M' | 'R' | 'F' | 'A') {
    await updateDayStatusAction(userId, date, status)
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#1a2332]">
          📅 Pointage mensuel — {MOIS_FR[month - 1]} {year}
        </h2>
        <div className="flex gap-2 items-center">
          <Link
            href={`/admin/recap?mois=${prevParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            ← Précédent
          </Link>
          <Link
            href={`/admin/recap?mois=${nextParam}`}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Suivant →
          </Link>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-xs italic">
          Aucun travailleur actif
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="text-[10px] border-collapse w-full">
            <thead>
              <tr className="bg-[#1a2332] text-white">
                <th className="text-left px-3 py-2 font-semibold w-40 sticky left-0 bg-[#1a2332] z-10">
                  Travailleur
                </th>
                {weekdays.map((d) => {
                  const isToday = d.getTime() === today.getTime()
                  const dow = ['L', 'M', 'Me', 'J', 'V'][d.getDay() - 1]
                  return (
                    <th
                      key={d.toISOString()}
                      className={`text-center px-1 py-2 font-medium w-10 min-w-[2.5rem] ${isToday ? 'bg-[#e53e3e]' : ''}`}
                    >
                      <div className="text-white/60 text-[8px]">{dow}</div>
                      <div>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 sticky left-0 bg-white border-r border-gray-100 z-10">
                    <div className="font-semibold text-[#1a2332] truncate max-w-[9rem]">
                      {w.prenom} {w.nom}
                    </div>
                    <div className="text-[8px] text-gray-400 truncate">{w.service?.nom}</div>
                  </td>
                  {weekdays.map((d) => {
                    const dateStr = d.toISOString().slice(0, 10)
                    const isToday = d.getTime() === today.getTime()
                    const status = computeStatus(w.id, dateStr, d, today, pointageMap, statusMap)
                    const bgClass = STATUS_BG[status]
                    const isMissing = status === '?'
                    const isPast = d <= today && d.getDay() >= 1 && d.getDay() <= 5

                    const cell = (
                      <span
                        className={[
                          'inline-flex items-center justify-center w-7 h-5 rounded text-[9px] font-bold',
                          bgClass,
                        ].join(' ')}
                      >
                        {status === '-' ? '' : status}
                      </span>
                    )

                    return (
                      <td
                        key={dateStr}
                        className={`text-center px-1 py-1.5 ${isToday ? 'bg-red-50' : ''}`}
                      >
                        {isMissing ? (
                          <button
                            onClick={() =>
                              setModal({
                                userId: w.id,
                                date: dateStr,
                                workerName: `${w.prenom} ${w.nom}`,
                              })
                            }
                            className="cursor-pointer"
                            title="Pointage manquant — cliquer pour corriger"
                          >
                            {cell}
                          </button>
                        ) : isPast && status !== 'W' && status !== '-' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="cursor-pointer" title="Changer le statut">
                                {cell}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="text-[10px]">
                              {(['P', 'C', 'M', 'R', 'F', 'A'] as const).map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  className="text-[10px]"
                                  onClick={() => handleStatusChange(w.id, dateStr, s)}
                                >
                                  {STATUS_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          cell
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {Object.entries(STATUS_LABELS).map(([s, label]) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`inline-flex w-5 h-4 rounded text-[8px] font-bold items-center justify-center ${STATUS_BG[s as DayStatus]}`}>
              {s}
            </span>
            <span className="text-[9px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {modal && (
        <PointageManquantModal
          open={true}
          onClose={() => setModal(null)}
          userId={modal.userId}
          date={modal.date}
          workerName={modal.workerName}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add components/admin/RecapMensuel.tsx
git commit -m "feat(admin): replace RecapMensuel with pointage-status grid"
```

---

### Task 10: Update Admin Recap Page

**Files:**
- Modify: `app/(dashboard)/admin/recap/page.tsx`

The page now needs to fetch pointage + day_statuses for the month and pass them to `RecapMensuel`.

- [ ] **Step 1: Update the page**

Replace the content with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Profile, Service } from '@/types/database'
import RecapMensuel from '@/components/admin/RecapMensuel'
import { getMonthPointageAdmin, getMonthDayStatusesAdmin } from '@/lib/pointage/admin-actions'

export default async function RecapPage({
  searchParams,
}: {
  searchParams: { mois?: string }
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

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (searchParams.mois) {
    const parts = searchParams.mois.split('-')
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) { year = y; month = m }
    }
  }

  const [workersRes, allPointages, allDayStatuses] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, service:services(*)')
      .eq('is_active', true)
      .order('nom'),
    getMonthPointageAdmin(year, month),
    getMonthDayStatusesAdmin(year, month),
  ])

  const workers = (workersRes.data ?? []) as (Profile & { service?: Service })[]

  return (
    <div className="max-w-full mx-auto p-4">
      <RecapMensuel
        workers={workers}
        year={year}
        month={month}
        allPointages={allPointages}
        allDayStatuses={allDayStatuses}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add app/(dashboard)/admin/recap/page.tsx
git commit -m "feat(admin): update recap page to fetch real pointage data"
```

---

## Chunk 5: Integration & Verification

### Task 11: End-to-end verification

- [ ] **Step 1: Run dev server**
```bash
npm run dev
```
Expected: server starts on port 3000 with no errors.

- [ ] **Step 2: Test worker pointage flow**
  1. Login as a worker
  2. Dashboard (`/`) shows PointageWidget — first button "Arrivée" is red
  3. Click "Arrivée" → button turns green with time, "Midi Out" becomes red
  4. Click through all 4 → all green, "Journée complète" message appears
  5. Refresh page → state persists from DB

- [ ] **Step 3: Test worker /pointage page**
  1. Navigate to `/pointage`
  2. Current month table shows today's pointage times
  3. Past days without pointage show `—`

- [ ] **Step 4: Test admin recap**
  1. Login as admin, navigate to `/admin/recap`
  2. Grid shows today's worker as `P` (if fully clocked in) or `?`
  3. Click a `?` cell → PointageManquantModal opens
  4. Choose "Absent non justifié" → cell changes to `A` (orange)
  5. Click a `P` cell → dropdown menu appears with status options
  6. Choose "Congé" → cell changes to `C` (amber)

- [ ] **Step 5: Test PointageManquantModal correction manuelle**
  1. Click a `?` cell → modal opens
  2. Choose "Correction manuelle"
  3. Adjust times → click "Enregistrer"
  4. Cell changes to `P` (green)

- [ ] **Step 6: Final commit**
```bash
git add -A
git commit -m "feat(module2): complete pointage module - worker widget, recap pages, admin grid"
```

---

## Potential Issues & Notes

1. **`RecapMensuel` is now a Client Component** — it uses `useState` for modal and dropdown interactivity. The parent page remains a Server Component that fetches data and passes it as props. `updateDayStatusAction` is called directly from the client component as a Server Action (valid in Next.js 14).

2. **`PointageWidget` requires router refresh** — `pointerAction` calls `revalidatePath('/')` but since PointageWidget is a Client Component embedded in a Server Component page, Next.js will re-render the server component after the action completes. No `router.refresh()` is needed.

3. **`getMonthPointageAdmin` / `getMonthDayStatusesAdmin`** call `assertAdmin()` which itself calls a Server Action-level redirect — ensure these are only called from server contexts (Server Components or other Server Actions). They are called from the RSC page, so this is fine.

4. **RLS conflict** — both worker and admin policies exist on `pointage`. Supabase evaluates RLS with `OR` between policies by default. Admin queries via `createAdminClient()` (service role) bypass RLS entirely, so no conflict.

5. **`mid_out` typo** — field is `midi_out` (with 'i'). Verify spelling matches the SQL migration in all places.
