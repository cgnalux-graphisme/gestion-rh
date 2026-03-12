# Module 3 — Calculateur d'horaires : Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le calcul automatique du pot d'heures (crédit/débit par rapport aux heures théoriques) avec affichage sur le dashboard travailleur, page profil et fiche admin.

**Architecture:** Trigger PostgreSQL sur la table `pointage` recalcule le `pot_heures` de l'année à chaque pointage complet. Les calculs sont toujours en minutes entières. Le frontend lit `pot_heures` via server actions Next.js et affiche en format "Xh Ymin".

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL triggers, RLS, RPC), React Server Components, useFormState (react-dom), Tailwind CSS, shadcn/ui.

---

## File Map

### À créer
- `supabase/migrations/` — 3 fichiers SQL (voir tâches 1-3)
- `lib/horaires/utils.ts` — fonctions pures de calcul (sans I/O)
- `lib/pot-heures/actions.ts` — server actions liées au pot d'heures
- `components/dashboard/SoldeHeuresWidget.tsx` — widget solde pour le dashboard
- `components/profile/HorairesSection.tsx` — section "Mes horaires" pour la page profil
- `components/admin/OptionHoraireAdminSection.tsx` — form admin changement d'option avec validation date
- `components/admin/PotHeuresAdminSection.tsx` — form admin correction manuelle du pot

### À modifier
- `types/database.ts` — ajouter `PotHeures`, `HorairesJour`, `HorairesHebdo`, mettre à jour `Bureau` et `Profile`
- `app/(dashboard)/page.tsx` — remplacer le placeholder "Solde heures" par `SoldeHeuresWidget`
- `app/(dashboard)/profil/page.tsx` — ajouter `HorairesSection`
- `app/(dashboard)/admin/travailleurs/[id]/page.tsx` — ajouter `OptionHoraireAdminSection` + `PotHeuresAdminSection`
- `lib/auth/admin-actions.ts` — ajouter `updateOptionHoraireAction` + `correcterPotHeuresAction`

---

## Chunk 1: Database

### Task 1 — Migration : table `pot_heures`, `jours_feries`, colonne `option_horaire_prochaine`

**Files:**
- Apply via Supabase MCP: `apply_migration` (name: `pot_heures_init`)

- [ ] **Step 1: Appliquer la migration**

```sql
-- Migration: pot_heures_init

-- 1. Ajouter option_horaire_prochaine sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS option_horaire_prochaine text
    CHECK (option_horaire_prochaine IN ('A', 'B'));

-- 2. Créer la table jours_feries (jours non travaillés)
CREATE TABLE IF NOT EXISTS jours_feries (
  date date PRIMARY KEY,
  description text NOT NULL
);

-- Seed jours fériés belges fixes 2025-2027
INSERT INTO jours_feries (date, description) VALUES
  -- 2025 fixes
  ('2025-01-01', 'Jour de l''An'),
  ('2025-05-01', 'Fête du Travail'),
  ('2025-07-21', 'Fête Nationale'),
  ('2025-08-15', 'Assomption'),
  ('2025-11-01', 'Toussaint'),
  ('2025-11-11', 'Armistice'),
  ('2025-12-25', 'Noël'),
  -- 2025 mobiles (Pâques 20/04/2025)
  ('2025-04-21', 'Lundi de Pâques'),
  ('2025-05-29', 'Ascension'),
  ('2025-06-09', 'Lundi de Pentecôte'),
  -- 2026 fixes
  ('2026-01-01', 'Jour de l''An'),
  ('2026-05-01', 'Fête du Travail'),
  ('2026-07-21', 'Fête Nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice'),
  ('2026-12-25', 'Noël'),
  -- 2026 mobiles (Pâques 05/04/2026)
  ('2026-04-06', 'Lundi de Pâques'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecôte'),
  -- 2027 fixes
  ('2027-01-01', 'Jour de l''An'),
  ('2027-05-01', 'Fête du Travail'),
  ('2027-07-21', 'Fête Nationale'),
  ('2027-08-15', 'Assomption'),
  ('2027-11-01', 'Toussaint'),
  ('2027-11-11', 'Armistice'),
  ('2027-12-25', 'Noël'),
  -- 2027 mobiles (Pâques 28/03/2027)
  ('2027-03-29', 'Lundi de Pâques'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-17', 'Lundi de Pentecôte')
ON CONFLICT DO NOTHING;

-- 3. Créer la table pot_heures
CREATE TABLE IF NOT EXISTS pot_heures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  annee smallint NOT NULL,
  solde_minutes int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, annee)
);

-- 4. RLS sur pot_heures
ALTER TABLE pot_heures ENABLE ROW LEVEL SECURITY;

-- Worker voit son propre solde
CREATE POLICY "worker_select_own_pot_heures"
  ON pot_heures FOR SELECT
  USING (auth.uid() = user_id);

-- Admin voit et modifie tout
CREATE POLICY "admin_all_pot_heures"
  ON pot_heures FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin_rh = true
    )
  );
```

- [ ] **Step 2: Vérifier la migration via Supabase**

```sql
-- Vérifier la structure
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'option_horaire_prochaine';

SELECT count(*) FROM jours_feries; -- doit retourner 31

SELECT table_name FROM information_schema.tables
WHERE table_name = 'pot_heures';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add pot_heures table, jours_feries, option_horaire_prochaine"
```

---

### Task 2 — Migration : trigger PostgreSQL de recalcul automatique

**Files:**
- Apply via Supabase MCP: `apply_migration` (name: `pot_heures_trigger`)

- [ ] **Step 1: Appliquer la migration trigger**

```sql
-- Migration: pot_heures_trigger

-- Fonction utilitaire : recalcule le pot_heures d'un user pour une année donnée
-- SECURITY DEFINER = s'exécute en tant que propriétaire de la table (bypass RLS)
CREATE OR REPLACE FUNCTION recalculer_pot_heures_annee(
  p_user_id uuid,
  p_annee smallint
)
RETURNS void AS $$
DECLARE
  v_nouveau_solde int;
BEGIN
  SELECT COALESCE(
    SUM(
      -- Minutes matin
      EXTRACT(EPOCH FROM (p.midi_out::timestamptz - p.arrivee::timestamptz)) / 60
      -- Minutes après-midi
      + EXTRACT(EPOCH FROM (p.depart::timestamptz - p.midi_in::timestamptz)) / 60
      -- Moins heures théoriques (438 = 7h18 option A, 408 = 6h48 option B)
      - CASE WHEN pr.option_horaire = 'A' THEN 438 ELSE 408 END
    ),
    0
  )::int INTO v_nouveau_solde
  FROM pointage p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.user_id = p_user_id
    AND EXTRACT(YEAR FROM p.date::date) = p_annee
    -- Seulement les pointages complets
    AND p.arrivee   IS NOT NULL
    AND p.midi_out  IS NOT NULL
    AND p.midi_in   IS NOT NULL
    AND p.depart    IS NOT NULL
    -- Exclure week-end (0=dimanche, 6=samedi)
    AND EXTRACT(DOW FROM p.date::date) NOT IN (0, 6)
    -- Exclure jours fériés
    AND p.date NOT IN (
      SELECT date FROM jours_feries
      WHERE EXTRACT(YEAR FROM date) = p_annee
    );

  -- Upsert dans pot_heures
  INSERT INTO pot_heures (user_id, annee, solde_minutes, updated_at)
  VALUES (p_user_id, p_annee, v_nouveau_solde, now())
  ON CONFLICT (user_id, annee)
  DO UPDATE SET
    solde_minutes = EXCLUDED.solde_minutes,
    updated_at    = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de correction manuelle (admin) : ajoute un delta
CREATE OR REPLACE FUNCTION corriger_pot_heures_admin(
  p_user_id uuid,
  p_annee smallint,
  p_delta_minutes int
)
RETURNS void AS $$
BEGIN
  INSERT INTO pot_heures (user_id, annee, solde_minutes, updated_at)
  VALUES (p_user_id, p_annee, p_delta_minutes, now())
  ON CONFLICT (user_id, annee)
  DO UPDATE SET
    solde_minutes = pot_heures.solde_minutes + p_delta_minutes,
    updated_at    = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function sur pointage
CREATE OR REPLACE FUNCTION trigger_recalcul_pot_heures()
RETURNS TRIGGER AS $$
BEGIN
  -- Ignorer les week-ends (pas de pot à mettre à jour)
  IF EXTRACT(DOW FROM NEW.date::date) IN (0, 6) THEN
    RETURN NEW;
  END IF;

  -- Toujours recalculer : gère aussi les cas où un champ redevient NULL
  PERFORM recalculer_pot_heures_annee(
    NEW.user_id,
    EXTRACT(YEAR FROM NEW.date::date)::smallint
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attacher le trigger à la table pointage
-- Cibler uniquement les champs de pointage (pas created_at)
DROP TRIGGER IF EXISTS trg_recalcul_pot_heures ON pointage;
CREATE TRIGGER trg_recalcul_pot_heures
  AFTER INSERT OR UPDATE OF arrivee, midi_out, midi_in, depart
  ON pointage
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalcul_pot_heures();
```

- [ ] **Step 2: Tester le trigger manuellement (Supabase SQL Editor)**

```sql
-- Vérifier que les fonctions existent
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'recalculer_pot_heures_annee',
  'corriger_pot_heures_admin',
  'trigger_recalcul_pot_heures'
);

-- Vérifier le trigger
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trg_recalcul_pot_heures';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add pot_heures trigger and RPC functions"
```

---

### Task 3 — Migration corrective : seed horaires bureaux

**Files:**
- Apply via Supabase MCP: `apply_migration` (name: `bureaux_horaires_seed`)

**Context:** La table `bureaux` a des colonnes `horaires_normaux` et `horaires_ete` en JSONB. Les données peuvent être NULL ou `{}`. Cette migration corrige ça avec des valeurs par défaut.

- [ ] **Step 1: Appliquer la migration seed**

```sql
-- Migration: bureaux_horaires_seed
-- Mettre à jour les bureaux sans horaires avec des valeurs par défaut

UPDATE bureaux
SET horaires_normaux = '{
  "1": {"ouverture": "08:00", "fermeture": "17:00", "pause_midi": 60},
  "2": {"ouverture": "08:00", "fermeture": "17:00", "pause_midi": 60},
  "3": {"ouverture": "08:00", "fermeture": "17:00", "pause_midi": 60},
  "4": {"ouverture": "08:00", "fermeture": "17:00", "pause_midi": 60},
  "5": {"ouverture": "08:00", "fermeture": "17:00", "pause_midi": 60}
}'::jsonb
WHERE horaires_normaux IS NULL
   OR horaires_normaux = '{}'::jsonb
   OR NOT (horaires_normaux ? '1');

UPDATE bureaux
SET horaires_ete = '{
  "1": {"ouverture": "08:00", "fermeture": "15:00", "pause_midi": 30},
  "2": {"ouverture": "08:00", "fermeture": "15:00", "pause_midi": 30},
  "3": {"ouverture": "08:00", "fermeture": "15:00", "pause_midi": 30},
  "4": {"ouverture": "08:00", "fermeture": "15:00", "pause_midi": 30},
  "5": {"ouverture": "08:00", "fermeture": "15:00", "pause_midi": 30}
}'::jsonb
WHERE horaires_ete IS NULL
   OR horaires_ete = '{}'::jsonb
   OR NOT (horaires_ete ? '1');
```

- [ ] **Step 2: Vérifier**

```sql
SELECT nom, horaires_normaux->>'1' AS lundi_normal, horaires_ete->>'1' AS lundi_ete
FROM bureaux;
-- Chaque bureau doit afficher des horaires pour le lundi
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "fix(db): seed bureaux horaires_normaux and horaires_ete with defaults"
```

---

## Chunk 2: Types et logique métier

### Task 4 — Mettre à jour `types/database.ts`

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Ajouter les nouveaux types**

Remplacer le contenu de `types/database.ts` :

```typescript
export type ServiceCode = 'svc_admin' | 'juridique' | 'compta_rh' | 'permanent'
export type OptionHoraire = 'A' | 'B'

export type Service = {
  id: string
  nom: string
  code: ServiceCode
}

// Structure d'une journée dans les horaires bureau
export type HorairesJour = {
  ouverture: string   // 'HH:mm'
  fermeture: string   // 'HH:mm'
  pause_midi: number  // minutes
}

// Map jours 1–5 (lundi–vendredi) → HorairesJour
export type HorairesHebdo = {
  '1': HorairesJour
  '2': HorairesJour
  '3': HorairesJour
  '4': HorairesJour
  '5': HorairesJour
}

export type Bureau = {
  id: string
  nom: string
  code: string
  horaires_normaux: HorairesHebdo
  horaires_ete: HorairesHebdo
}

export type Profile = {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string | null
  date_naissance: string | null
  contact_urgence: string | null
  rue: string | null
  numero: string | null
  boite: string | null
  code_postal: string | null
  commune: string | null
  pays: string
  service_id: string
  type_contrat: string | null
  date_entree: string | null
  option_horaire: OptionHoraire | null
  option_horaire_prochaine: OptionHoraire | null  // NEW — pour changement après 15 déc.
  is_admin_rh: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  // joins
  service?: Service
}

export type UserBureauSchedule = {
  id: string
  user_id: string
  bureau_id: string
  jour: 1 | 2 | 3 | 4 | 5
  valide_depuis: string
  bureau?: Bureau
}

export type InvitationToken = {
  id: string
  user_id: string
  expires_at: string
  used_at: string | null
}

export type DayStatus = 'P' | 'C' | 'M' | 'R' | 'F' | 'A' | '?' | 'W' | '-'

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

// Pot d'heures accumulées (crédit/débit vs heures théoriques)
export type PotHeures = {
  id: string
  user_id: string
  annee: number
  solde_minutes: number  // positif = crédit, négatif = débit
  updated_at: string
}
```

- [ ] **Step 2: Vérifier que TypeScript compile**

```bash
cd C:/Users/cgnal/Documents/.Applications/gestion_rh
npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur TypeScript dans ce fichier. Des erreurs temporaires peuvent apparaître dans d'autres fichiers utilisant `Bureau.horaires_normaux` (le type était `Record<string, unknown>` avant).

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): add PotHeures, HorairesJour, HorairesHebdo, option_horaire_prochaine"
```

---

### Task 5 — Créer `lib/horaires/utils.ts` (fonctions pures)

**Files:**
- Create: `lib/horaires/utils.ts`

- [ ] **Step 1: Créer le fichier**

```typescript
// lib/horaires/utils.ts
// Fonctions pures — aucun I/O, testables sans DB

import { OptionHoraire, HorairesJour, HorairesHebdo } from '@/types/database'

/** Minutes théoriques par jour selon l'option horaire */
export function minutesParJour(option: OptionHoraire): number {
  return option === 'A' ? 438 : 408  // A = 7h18 = 438min, B = 6h48 = 408min
}

/** Formate des minutes en "Xh Ymin" (ex: 90 → "1h 30min", -45 → "-45min") */
export function formatMinutes(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes)
  const sign = totalMinutes < 0 ? '-' : ''
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${sign}${m}min`
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h ${m}min`
}

/** Retourne true si la date est en période été (juillet ou août) */
export function isEte(date: Date): boolean {
  const month = date.getMonth() + 1  // getMonth() = 0-indexed
  return month === 7 || month === 8
}

/** Retourne les horaires du jour (1=lundi..5=vendredi) depuis un objet HorairesHebdo */
export function getHorairesJour(
  horaires: HorairesHebdo,
  jour: 1 | 2 | 3 | 4 | 5
): HorairesJour {
  return horaires[String(jour) as keyof HorairesHebdo]
}

/** Détermine si on est après la deadline de changement d'option (15 décembre) */
export function isApresDeadlineChangementOption(date: Date = new Date()): boolean {
  return date.getMonth() === 11 && date.getDate() > 15  // mois 11 = décembre (0-indexed)
}

/**
 * Calcule le label complet d'une option horaire.
 * Ex: 'A' → 'Option A — 36,5h/semaine (7h18/jour)'
 */
export function labelOptionHoraire(option: OptionHoraire): string {
  if (option === 'A') return 'Option A — 36,5h/semaine (7h18/jour)'
  return 'Option B — 34h/semaine (6h48/jour)'
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "lib/horaires"
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/horaires/utils.ts
git commit -m "feat(horaires): add pure utility functions for time calculations"
```

---

### Task 6 — Créer `lib/pot-heures/actions.ts`

**Files:**
- Create: `lib/pot-heures/actions.ts`

- [ ] **Step 1: Créer le fichier**

```typescript
// lib/pot-heures/actions.ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PotHeures } from '@/types/database'

/** Récupère le solde de l'année courante pour l'utilisateur connecté */
export async function getSoldeHeuresAction(annee?: number): Promise<PotHeures | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const targetAnnee = annee ?? new Date().getFullYear()

  const { data } = await supabase
    .from('pot_heures')
    .select('*')
    .eq('user_id', user.id)
    .eq('annee', targetAnnee)
    .single()

  return data ?? null
}

/** (Admin) Récupère le solde d'un travailleur pour une année */
export async function getSoldeHeuresWorkerAction(
  userId: string,
  annee?: number
): Promise<PotHeures | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const targetAnnee = annee ?? new Date().getFullYear()
  const admin = createAdminClient()

  const { data } = await admin
    .from('pot_heures')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', targetAnnee)
    .single()

  return data ?? null
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "lib/pot-heures"
```

- [ ] **Step 3: Commit**

```bash
git add lib/pot-heures/actions.ts
git commit -m "feat(pot-heures): add getSoldeHeures server actions"
```

---

## Chunk 3: UI Travailleur

### Task 7 — Créer `components/dashboard/SoldeHeuresWidget.tsx`

**Files:**
- Create: `components/dashboard/SoldeHeuresWidget.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/dashboard/SoldeHeuresWidget.tsx
// Composant server — reçoit le solde en minutes, affiche en Xh Ymin

import { formatMinutes } from '@/lib/horaires/utils'

export default function SoldeHeuresWidget({ solde }: { solde: number | null }) {
  const minutesValue = solde ?? 0
  const isPositif = minutesValue >= 0
  const isZero = minutesValue === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        ⏱ Solde heures
      </p>

      {solde === null ? (
        <p className="text-xs text-gray-400 italic">Aucun pointage enregistré cette année</p>
      ) : (
        <>
          <p
            className={`text-2xl font-black ${
              isZero
                ? 'text-gray-400'
                : isPositif
                ? 'text-green-600'
                : 'text-red-600'
            }`}
            title="Heures supplémentaires accumulées cette année"
          >
            {isPositif && !isZero ? '+' : ''}
            {formatMinutes(minutesValue)}
          </p>
          <p className="text-[9px] text-gray-400 mt-1">
            {isPositif && !isZero
              ? 'Crédit heures — année en cours'
              : isZero
              ? 'Solde équilibré'
              : 'Débit heures — année en cours'}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "SoldeHeuresWidget"
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/SoldeHeuresWidget.tsx
git commit -m "feat(dashboard): add SoldeHeuresWidget component"
```

---

### Task 8 — Mettre à jour `app/(dashboard)/page.tsx`

**Files:**
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Remplacer le placeholder par le vrai widget**

Modifier le fichier pour importer et utiliser `SoldeHeuresWidget` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTodayPointage } from '@/lib/pointage/actions'
import { getSoldeHeuresAction } from '@/lib/pot-heures/actions'
import { UserBureauSchedule, Bureau } from '@/types/database'
import PointageWidget from '@/components/dashboard/PointageWidget'
import SoldeHeuresWidget from '@/components/dashboard/SoldeHeuresWidget'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const dow = today.getDay()

  const [pointage, schedulesRes, soldeData] = await Promise.all([
    getTodayPointage(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .eq('jour', dow)
      .single(),
    getSoldeHeuresAction(),
  ])

  const bureauDuJour = schedulesRes.data as (UserBureauSchedule & { bureau: Bureau }) | null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-sm font-bold text-[#1a2332]">Tableau de bord</h1>

      <PointageWidget pointage={pointage} />

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          📍 Bureau du jour
        </p>
        <p className="text-sm font-semibold text-[#1a2332]">
          {dow === 0 || dow === 6
            ? 'Week-end'
            : bureauDuJour?.bureau?.nom ?? 'Sur la route'}
        </p>
      </div>

      <SoldeHeuresWidget solde={soldeData?.solde_minutes ?? null} />
    </div>
  )
}
```

- [ ] **Step 2: Vérifier le rendu**

```bash
# Démarrer le serveur de dev
npm run dev
# Naviguer sur http://localhost:3000
# Le widget "Solde heures" doit afficher "Aucun pointage enregistré" ou un solde réel
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/page.tsx
git commit -m "feat(dashboard): wire SoldeHeuresWidget to real pot_heures data"
```

---

### Task 9 — Créer `components/profile/HorairesSection.tsx`

**Files:**
- Create: `components/profile/HorairesSection.tsx`

**Context:** Ce composant affiche l'option horaire active, les heures théoriques, et les horaires du bureau par jour de la semaine. Lecture seule pour le travailleur.

- [ ] **Step 1: Créer le composant**

```tsx
// components/profile/HorairesSection.tsx

import { Profile, UserBureauSchedule } from '@/types/database'
import { minutesParJour, formatMinutes, isEte, labelOptionHoraire } from '@/lib/horaires/utils'

const JOURS: { label: string; jour: 1 | 2 | 3 | 4 | 5 }[] = [
  { label: 'Lundi',    jour: 1 },
  { label: 'Mardi',    jour: 2 },
  { label: 'Mercredi', jour: 3 },
  { label: 'Jeudi',    jour: 4 },
  { label: 'Vendredi', jour: 5 },
]

export default function HorairesSection({
  profile,
  schedules,
}: {
  profile: Profile
  schedules: UserBureauSchedule[]
}) {
  const option = profile.option_horaire
  const minutesJour = option ? minutesParJour(option) : null
  const today = new Date()
  const ete = isEte(today)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🕐 Mes horaires</span>
        {ete && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
            ☀️ Horaires été
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Option horaire */}
        {option && minutesJour ? (
          <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Option active
              </div>
              <div className="text-xs font-semibold text-[#1a2332]">
                {labelOptionHoraire(option)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Heures théoriques / jour
              </div>
              <div className="text-xs font-semibold text-[#1a2332]">
                {formatMinutes(minutesJour)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Option horaire non définie</p>
        )}

        {/* Horaires par jour */}
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Horaires par jour
          </div>
          <div className="space-y-1.5">
            {JOURS.map(({ label, jour }) => {
              const sch = schedules.find((s) => s.jour === jour)
              const bureau = sch?.bureau
              const horairesHebdo = bureau
                ? (ete ? bureau.horaires_ete : bureau.horaires_normaux)
                : null
              const h = horairesHebdo
                ? horairesHebdo[String(jour) as keyof typeof horairesHebdo]
                : null

              return (
                <div
                  key={jour}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-500 w-20 font-medium">{label}</span>
                  <span className="text-[#1a2332] flex-1">
                    {bureau?.nom ?? (
                      <span className="text-gray-300 italic">Sur la route</span>
                    )}
                  </span>
                  <span className="text-gray-400 text-[11px]">
                    {h ? `${h.ouverture} – ${h.fermeture}` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Option prochaine année */}
        {profile.option_horaire_prochaine && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-[10px] text-yellow-700 font-semibold">
              ⚠️ Changement planifié pour l'année prochaine : Option{' '}
              {profile.option_horaire_prochaine} (
              {profile.option_horaire_prochaine === 'A' ? '36,5h/sem' : '34h/sem'})
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "HorairesSection"
```

- [ ] **Step 3: Commit**

```bash
git add components/profile/HorairesSection.tsx
git commit -m "feat(profile): add HorairesSection component (read-only schedule view)"
```

---

### Task 10 — Mettre à jour `app/(dashboard)/profil/page.tsx`

**Files:**
- Modify: `app/(dashboard)/profil/page.tsx`

- [ ] **Step 1: Ajouter HorairesSection dans la page**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import CoordonneesSection from '@/components/profile/CoordonneesSection'
import DonneesRHSection from '@/components/profile/DonneesRHSection'
import AffectationSection from '@/components/profile/AffectationSection'
import HorairesSection from '@/components/profile/HorairesSection'
import { Profile, Service, UserBureauSchedule } from '@/types/database'

export default async function ProfilPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileRes, schedulesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, service:services(*)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', user.id)
      .order('jour'),
  ])

  if (profileRes.error || !profileRes.data) redirect('/login')

  const profile = profileRes.data as Profile & { service: Service | null }
  const schedules = (schedulesRes.data ?? []) as UserBureauSchedule[]

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <ProfileHeader profile={profile} service={profile.service ?? null} />
      <div className="p-4 space-y-4">
        <CoordonneesSection profile={profile} />
        <DonneesRHSection profile={profile} service={profile.service ?? null} />
        <AffectationSection schedules={schedules} />
        <HorairesSection profile={profile} schedules={schedules} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tester visuellement**

Naviguer sur `/profil`. La section "Mes horaires" doit apparaître en bas avec :
- L'option horaire et heures théoriques
- La liste lundi–vendredi avec bureau + horaires
- Le badge "Horaires été" si on est en juillet/août

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/profil/page.tsx
git commit -m "feat(profil): add HorairesSection to worker profile page"
```

---

## Chunk 4: UI Admin

### Task 11 — Ajouter `updateOptionHoraireAction` dans `lib/auth/admin-actions.ts`

**Files:**
- Modify: `lib/auth/admin-actions.ts`

- [ ] **Step 1: Ajouter l'action en bas du fichier**

```typescript
export async function updateOptionHoraireAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const newOption = formData.get('option_horaire') as 'A' | 'B'
  if (!userId || !newOption) return { error: 'Paramètres manquants' }

  const admin = createAdminClient()
  const today = new Date()
  // Deadline : après le 15 décembre → seule l'année suivante est modifiable
  const isApresDeadline = today.getMonth() === 11 && today.getDate() > 15

  if (isApresDeadline) {
    // Stocker dans option_horaire_prochaine (ne change pas l'option courante)
    const { error } = await admin
      .from('profiles')
      .update({ option_horaire_prochaine: newOption })
      .eq('id', userId)
    if (error) return { error: error.message }
    revalidatePath(`/admin/travailleurs/${userId}`)
    return {
      success: true,
      warning: `Après le 15 décembre, le changement est planifié pour ${today.getFullYear() + 1}. L'option actuelle reste inchangée jusqu'au 1er janvier.`,
    }
  }

  // Cas normal : mettre à jour option_horaire + recalculer le pot de l'année courante
  const { error } = await admin
    .from('profiles')
    .update({ option_horaire: newOption, option_horaire_prochaine: null })
    .eq('id', userId)
  if (error) return { error: error.message }

  // Recalculer le pot_heures de l'année courante (les heures théoriques ont changé)
  await admin.rpc('recalculer_pot_heures_annee', {
    p_user_id: userId,
    p_annee: today.getFullYear(),
  })

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function correcterPotHeuresAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const deltaStr = formData.get('delta_minutes') as string
  const anneeStr = formData.get('annee') as string
  if (!userId || !deltaStr || !anneeStr) return { error: 'Paramètres manquants' }

  const delta = parseInt(deltaStr, 10)
  const annee = parseInt(anneeStr, 10)
  if (isNaN(delta) || isNaN(annee)) return { error: 'Valeurs invalides' }
  if (delta === 0) return { error: 'La correction doit être non-nulle' }

  const admin = createAdminClient()
  const { error } = await admin.rpc('corriger_pot_heures_admin', {
    p_user_id: userId,
    p_annee: annee,
    p_delta_minutes: delta,
  })
  if (error) return { error: error.message }

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "admin-actions"
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth/admin-actions.ts
git commit -m "feat(admin): add updateOptionHoraireAction and correcterPotHeuresAction"
```

---

### Task 12 — Créer `components/admin/OptionHoraireAdminSection.tsx`

**Files:**
- Create: `components/admin/OptionHoraireAdminSection.tsx`

**Context:** Formulaire séparé pour changer l'option horaire. Affiche un avertissement si on est après le 15 décembre. Utilise `useFormState`.

- [ ] **Step 1: Créer le composant**

```tsx
// components/admin/OptionHoraireAdminSection.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateOptionHoraireAction } from '@/lib/auth/admin-actions'
import { Profile } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApresDeadlineChangementOption } from '@/lib/horaires/utils'
import { useState } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      className="bg-[#e53e3e] hover:bg-[#c53030] text-white text-xs"
    >
      {pending ? 'Enregistrement…' : '💾 Enregistrer l'option'}
    </Button>
  )
}

export default function OptionHoraireAdminSection({ profile }: { profile: Profile }) {
  const [state, action] = useFormState(updateOptionHoraireAction, null)
  const [option, setOption] = useState(profile.option_horaire ?? '')
  const apresDeadline = isApresDeadlineChangementOption()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🕐 Option horaire</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          ★ Admin
        </span>
      </div>

      <div className="p-4 space-y-3">
        {apresDeadline && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-[10px] text-orange-700 font-semibold">
              ⚠️ Après le 15 décembre, le changement sera appliqué à partir du 1er janvier{' '}
              {new Date().getFullYear() + 1}. L'option actuelle reste en vigueur jusqu'à cette date.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Option actuelle
            </div>
            <div className="text-xs font-semibold text-[#1a2332]">
              {profile.option_horaire
                ? `Option ${profile.option_horaire} (${profile.option_horaire === 'A' ? '36,5h/sem' : '34h/sem'})`
                : '—'}
            </div>
          </div>
          {profile.option_horaire_prochaine && (
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Planifié {new Date().getFullYear() + 1}
              </div>
              <div className="text-xs font-semibold text-orange-600">
                Option {profile.option_horaire_prochaine}
              </div>
            </div>
          )}
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="user_id" value={profile.id} />

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              {apresDeadline ? `Nouvelle option (à partir du 1er jan. ${new Date().getFullYear() + 1})` : 'Modifier l'option'}
            </Label>
            <Select value={option} onValueChange={(v) => setOption(v ?? '')}>
              <SelectTrigger className="text-xs h-8 max-w-xs">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A" className="text-xs">A — 36,5h/sem (7h18/jour)</SelectItem>
                <SelectItem value="B" className="text-xs">B — 34h/sem (6h48/jour)</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="option_horaire" value={option} />
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
          )}
          {state?.warning && (
            <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md">
              ⚠️ {state.warning}
            </p>
          )}
          {state?.success && !state.warning && (
            <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
              ✓ Option horaire mise à jour.
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "OptionHoraireAdminSection"
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/OptionHoraireAdminSection.tsx
git commit -m "feat(admin): add OptionHoraireAdminSection with Dec-15 deadline guard"
```

---

### Task 13 — Créer `components/admin/PotHeuresAdminSection.tsx`

**Files:**
- Create: `components/admin/PotHeuresAdminSection.tsx`

**Context:** Section admin sur la fiche travailleur. Affiche le solde actuel et permet une correction manuelle (+/- N minutes) avec un commentaire. Utilise `useFormState`.

- [ ] **Step 1: Créer le composant**

```tsx
// components/admin/PotHeuresAdminSection.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { correcterPotHeuresAction } from '@/lib/auth/admin-actions'
import { PotHeures } from '@/types/database'
import { formatMinutes } from '@/lib/horaires/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      size="sm"
      variant="outline"
      className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
    >
      {pending ? 'Correction…' : '✏️ Appliquer la correction'}
    </Button>
  )
}

export default function PotHeuresAdminSection({
  userId,
  potHeures,
}: {
  userId: string
  potHeures: PotHeures | null
}) {
  const [state, action] = useFormState(correcterPotHeuresAction, null)
  const annee = new Date().getFullYear()
  const solde = potHeures?.solde_minutes ?? 0
  const isPositif = solde >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">⏱ Pot d'heures {annee}</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
          ★ Admin
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Solde actuel */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Solde actuel
            </div>
            <div
              className={`text-xl font-black ${
                solde === 0 ? 'text-gray-400' : isPositif ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositif && solde !== 0 ? '+' : ''}
              {formatMinutes(solde)}
            </div>
          </div>
          <div className="text-[9px] text-gray-400">
            {potHeures
              ? `Mis à jour le ${new Date(potHeures.updated_at).toLocaleDateString('fr-BE')}`
              : 'Aucun pointage complet cette année'}
          </div>
        </div>

        {/* Formulaire correction */}
        <form action={action} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="annee" value={annee} />

          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            Correction manuelle
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Delta (minutes)
              </Label>
              <Input
                name="delta_minutes"
                type="number"
                placeholder="ex: 30 ou -60"
                className="text-xs h-8"
                required
              />
              <p className="text-[9px] text-gray-400">
                Positif = ajouter, négatif = soustraire
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Commentaire (non enregistré)
              </Label>
              <Input
                name="commentaire"
                type="text"
                placeholder="Raison de la correction…"
                className="text-xs h-8"
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{state.error}</p>
          )}
          {state?.success && (
            <p className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
              ✓ Correction appliquée.
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "PotHeuresAdminSection"
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/PotHeuresAdminSection.tsx
git commit -m "feat(admin): add PotHeuresAdminSection with manual correction form"
```

---

### Task 14 — Mettre à jour la fiche travailleur admin

**Files:**
- Modify: `app/(dashboard)/admin/travailleurs/[id]/page.tsx`

- [ ] **Step 1: Ajouter les imports et les nouvelles sections**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Profile, Service, UserBureauSchedule, Bureau, PotHeures } from '@/types/database'
import ProfileHeader from '@/components/profile/ProfileHeader'
import TravailleurEditForm from '@/components/admin/TravailleurEditForm'
import BureauScheduleEditor from '@/components/admin/BureauScheduleEditor'
import OptionHoraireAdminSection from '@/components/admin/OptionHoraireAdminSection'
import PotHeuresAdminSection from '@/components/admin/PotHeuresAdminSection'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deactivateTravailleurAction } from '@/lib/auth/admin-actions'

async function DeactivateButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  if (!isActive) {
    return (
      <span className="text-[9px] px-3 py-1.5 rounded-md bg-gray-100 text-gray-400 font-medium">
        Compte désactivé
      </span>
    )
  }
  async function doDeactivate() {
    'use server'
    await deactivateTravailleurAction(userId)
    redirect('/admin/travailleurs')
  }
  return (
    <form action={doDeactivate}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
      >
        Désactiver ce travailleur
      </Button>
    </form>
  )
}

export default async function TravailleurFichePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const annee = new Date().getFullYear()

  const [profileRes, schedulesRes, bureauxRes, servicesRes, potHeuresRes] = await Promise.all([
    supabase.from('profiles').select('*, service:services(*)').eq('id', params.id).single(),
    supabase
      .from('user_bureau_schedule')
      .select('*, bureau:bureaux(*)')
      .eq('user_id', params.id)
      .order('jour'),
    supabase.from('bureaux').select('*').order('nom'),
    supabase.from('services').select('*').order('nom'),
    supabase
      .from('pot_heures')
      .select('*')
      .eq('user_id', params.id)
      .eq('annee', annee)
      .single(),
  ])

  if (profileRes.error || !profileRes.data) redirect('/admin/travailleurs')

  const profile = profileRes.data as Profile & { service: Service | null }
  const schedules = (schedulesRes.data ?? []) as UserBureauSchedule[]
  const bureaux = (bureauxRes.data ?? []) as Bureau[]
  const services = (servicesRes.data ?? []) as Service[]
  const potHeures = potHeuresRes.data as PotHeures | null

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <div className="flex items-center gap-2">
          <Link href="/admin/travailleurs">
            <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 h-7 px-2">
              ← Retour
            </Button>
          </Link>
          <span className="text-[9px] text-gray-400">
            / {profile.prenom} {profile.nom}
          </span>
        </div>
        <DeactivateButton userId={profile.id} isActive={profile.is_active} />
      </div>

      <ProfileHeader profile={profile} service={profile.service ?? null} />

      <div className="p-4 space-y-4">
        <TravailleurEditForm profile={profile} services={services} />
        <OptionHoraireAdminSection profile={profile} />
        <BureauScheduleEditor
          userId={profile.id}
          bureaux={bureaux}
          schedules={schedules}
        />
        <PotHeuresAdminSection userId={profile.id} potHeures={potHeures} />
      </div>
    </div>
  )
}
```

**Note importante :** Le champ `option_horaire` dans `TravailleurEditForm` reste présent (il fait partie du formulaire général). Mais dorénavant la modification de l'option horaire passe par `OptionHoraireAdminSection` (avec validation date). Pour éviter la duplication, il faudra **retirer le select `option_horaire` de `TravailleurEditForm`** et le laisser uniquement dans `OptionHoraireAdminSection`. Voir step 2.

- [ ] **Step 2: Retirer option_horaire de TravailleurEditForm**

Dans `components/admin/TravailleurEditForm.tsx`, supprimer :
- La ligne `const [optionHoraire, setOptionHoraire] = useState(profile.option_horaire ?? '')`
- Le bloc `<div className="space-y-1">` contenant le Select option_horaire (lignes 126–144)
- L'input hidden `option_horaire`

Et dans `lib/auth/admin-actions.ts` > `updateTravailleurAction`, retirer la ligne :
```typescript
option_horaire: formData.get('option_horaire') as 'A' | 'B',
```

- [ ] **Step 3: Vérifier TypeScript + build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 4: Tester visuellement**

Naviguer sur `/admin/travailleurs/[id]`. Vérifier :
- Section "Option horaire" avec le Select et le warning si après 15 déc.
- Section "Pot d'heures" avec le solde et le formulaire de correction

- [ ] **Step 5: Commit final**

```bash
git add app/(dashboard)/admin/travailleurs/[id]/page.tsx \
        components/admin/TravailleurEditForm.tsx \
        lib/auth/admin-actions.ts
git commit -m "feat(admin): add OptionHoraireAdminSection and PotHeuresAdminSection to worker detail page"
```

---

## Règles métier — rappel de référence

| Option | h/sem | h/jour | min/jour |
|--------|-------|--------|----------|
| A      | 36,5h | 7h18   | 438      |
| B      | 34h   | 6h48   | 408      |

**Calcul d'un pointage :**
```
minutes_matin     = midi_out - arrivee  (en minutes)
minutes_apm       = depart   - midi_in  (en minutes)
minutes_travail   = minutes_matin + minutes_apm
delta             = minutes_travail - minutes_theoriques_jour
```

**Exclusions du calcul :**
- Week-end (DOW 0 et 6)
- Jours fériés belges (table `jours_feries`)

**Règle deadline changement d'option :**
- Avant le 15 décembre : modification directe de `option_horaire` + recalcul `pot_heures`
- Après le 15 décembre : modification de `option_horaire_prochaine` uniquement, `option_horaire` reste inchangé
