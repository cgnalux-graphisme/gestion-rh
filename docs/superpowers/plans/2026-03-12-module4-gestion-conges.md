# Module 4 — Gestion des Congés — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la gestion complète des congés : tables DB, upload Storage, Server Actions worker/admin, emails Resend, pages `/conges` et `/admin/conges`, widget dashboard.

**Architecture:** Les congés approuvés écrivent directement dans `day_statuses`, ce qui intègre automatiquement le RecapMensuel existant sans modification. Le Storage (bucket privé) est manipulé uniquement via Server Actions avec `createAdminClient()` (service role), éliminant le besoin de politiques Storage RLS complexes. Les soldes sont gérés dans `soldes_conges` et mis à jour en même temps que l'approbation.

**Tech Stack:** Next.js 14 Server Actions, Supabase (Postgres + Storage), react-email, Resend, shadcn/ui, Tailwind CSS.

---

## Chunk 1 — Fondations : Migration DB + Types + Utilitaires

### Task 1 : Migration Supabase — tables conges + soldes_conges + bucket storage

**Files:**
- Migration Supabase (via MCP tool `apply_migration`)

> Avant d'exécuter, récupérer le `project_id` actif via `list_projects`.

- [ ] **Step 1 : Appliquer la migration principale**

SQL à exécuter via `apply_migration` (name: `add_conges_module4`) :

```sql
-- Table conges
CREATE TABLE conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL CHECK (type IN ('conge_annuel', 'repos_comp', 'maladie', 'autre')),
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  nb_jours smallint NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
  commentaire_travailleur text,
  commentaire_admin text,
  piece_jointe_url text,
  approuve_par uuid REFERENCES profiles(id),
  approuve_le timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker_own_conges" ON conges
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_all_conges" ON conges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  );

-- Table soldes_conges
CREATE TABLE soldes_conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  annee smallint NOT NULL,
  conges_annuels_total smallint NOT NULL DEFAULT 0,
  conges_annuels_pris smallint NOT NULL DEFAULT 0,
  repos_comp_total smallint NOT NULL DEFAULT 0,
  repos_comp_pris smallint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, annee)
);

ALTER TABLE soldes_conges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker_own_soldes" ON soldes_conges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_all_soldes" ON soldes_conges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  );

-- Storage bucket privé
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificats-medicaux', 'certificats-medicaux', false)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2 : Vérifier la migration**

Via `execute_sql` :
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conges', 'soldes_conges');

SELECT id, name, public FROM storage.buckets WHERE id = 'certificats-medicaux';
```
Expected : 2 tables + 1 bucket.

- [ ] **Step 3 : Commit**
```bash
git add -A
git commit -m "feat(db): add conges, soldes_conges tables + certificats-medicaux bucket"
```

---

### Task 2 : Ajouter les types TypeScript

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1 : Ajouter les types en fin de fichier**

```ts
export type TypeConge = 'conge_annuel' | 'repos_comp' | 'maladie' | 'autre'
export type StatutConge = 'en_attente' | 'approuve' | 'refuse'

export type Conge = {
  id: string
  user_id: string
  type: TypeConge
  date_debut: string    // 'YYYY-MM-DD'
  date_fin: string      // 'YYYY-MM-DD'
  nb_jours: number
  statut: StatutConge
  commentaire_travailleur: string | null
  commentaire_admin: string | null
  piece_jointe_url: string | null
  approuve_par: string | null
  approuve_le: string | null
  created_at: string
  // joins optionnels
  profile?: Pick<Profile, 'prenom' | 'nom' | 'email'>
}

export type SoldeConges = {
  id: string
  user_id: string
  annee: number
  conges_annuels_total: number
  conges_annuels_pris: number
  repos_comp_total: number
  repos_comp_pris: number
  updated_at: string
}
```

- [ ] **Step 2 : Vérifier la compilation**
```bash
npx tsc --noEmit
```
Expected : pas d'erreur.

- [ ] **Step 3 : Commit**
```bash
git add types/database.ts
git commit -m "feat(types): add Conge, SoldeConges, TypeConge, StatutConge types"
```

---

### Task 3 : Créer lib/utils/dates.ts — fonctions pures dates

**Files:**
- Create: `lib/utils/dates.ts`

- [ ] **Step 1 : Créer le fichier**

```ts
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
```

- [ ] **Step 2 : Vérifier compilation**
```bash
npx tsc --noEmit
```
Expected : pas d'erreur.

- [ ] **Step 3 : Commit**
```bash
git add lib/utils/dates.ts
git commit -m "feat(utils): add calcJoursOuvrables, formatDateFr, labelTypeConge helpers"
```

---

## Chunk 2 — Server Actions Worker

### Task 4 : Créer lib/conges/actions.ts

**Files:**
- Create: `lib/conges/actions.ts`

- [ ] **Step 1 : Créer le fichier**

```ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges } from '@/types/database'
import { calcJoursOuvrables } from '@/lib/utils/dates'

/** Récupère les soldes de l'année courante pour l'utilisateur connecté */
export async function getSoldesCongesAction(annee?: number): Promise<SoldeConges | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const targetAnnee = annee ?? new Date().getFullYear()
  const { data } = await supabase
    .from('soldes_conges')
    .select('*')
    .eq('user_id', user.id)
    .eq('annee', targetAnnee)
    .single()
  return data ?? null
}

/** Récupère toutes les demandes du travailleur connecté */
export async function getMesCongesAction(): Promise<Conge[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('conges')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as Conge[]
}

/** Soumet une nouvelle demande de congé */
export async function demanderCongeAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = formData.get('type') as string
  const date_debut = formData.get('date_debut') as string
  const date_fin = formData.get('date_fin') as string
  const commentaire_travailleur = (formData.get('commentaire_travailleur') as string) || null
  const piece_jointe = formData.get('piece_jointe') as File | null

  // Validations basiques
  if (!type || !date_debut || !date_fin) return { error: 'Champs obligatoires manquants' }
  if (date_debut > date_fin) return { error: 'La date de fin doit être après la date de début' }
  const nb_jours = calcJoursOuvrables(date_debut, date_fin)
  if (nb_jours === 0) return { error: 'Aucun jour ouvrable dans la période sélectionnée' }

  // Pièce jointe obligatoire pour maladie
  if (type === 'maladie' && (!piece_jointe || piece_jointe.size === 0)) {
    return { error: 'Un certificat médical est obligatoire pour une absence maladie' }
  }
  // Validation fichier
  if (piece_jointe && piece_jointe.size > 0) {
    if (piece_jointe.size > 5 * 1024 * 1024) {
      return { error: 'Le fichier ne doit pas dépasser 5 MB' }
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(piece_jointe.type)) {
      return { error: 'Seuls les fichiers PDF, JPG et PNG sont acceptés' }
    }
  }

  const admin = createAdminClient()
  let warning: string | undefined

  // Vérifier le solde si congé annuel (warning non-bloquant)
  if (type === 'conge_annuel') {
    const annee = new Date(date_debut).getFullYear()
    const { data: solde } = await admin
      .from('soldes_conges')
      .select('conges_annuels_total, conges_annuels_pris')
      .eq('user_id', user.id)
      .eq('annee', annee)
      .single()
    if (solde) {
      const disponible = solde.conges_annuels_total - solde.conges_annuels_pris
      if (nb_jours > disponible) {
        warning = `Solde insuffisant (${disponible} jour(s) disponible(s)). La demande sera soumise à la décision de l'admin.`
      }
    }
  }

  // Insérer le congé (sans piece_jointe_url pour l'instant)
  const { data: newConge, error: insertError } = await admin
    .from('conges')
    .insert({ user_id: user.id, type, date_debut, date_fin, nb_jours, commentaire_travailleur })
    .select('id')
    .single()

  if (insertError || !newConge) return { error: insertError?.message ?? 'Erreur lors de la création' }

  // Upload pièce jointe si présente
  if (piece_jointe && piece_jointe.size > 0) {
    const ext = piece_jointe.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${user.id}/${newConge.id}.${ext}`
    const buffer = await piece_jointe.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('certificats-medicaux')
      .upload(path, buffer, { contentType: piece_jointe.type, upsert: true })
    if (uploadError) {
      await admin.from('conges').delete().eq('id', newConge.id)
      return { error: `Erreur upload fichier : ${uploadError.message}` }
    }
    await admin.from('conges').update({ piece_jointe_url: path }).eq('id', newConge.id)
  }

  revalidatePath('/conges')
  return { success: true, warning }
}

/** Annule une demande en_attente du travailleur connecté */
export async function annulerCongeAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: conge } = await admin
    .from('conges')
    .select('user_id, statut, piece_jointe_url')
    .eq('id', id)
    .single()

  if (!conge) return { error: 'Demande introuvable' }
  if (conge.user_id !== user.id) return { error: 'Non autorisé' }
  if (conge.statut !== 'en_attente') return { error: 'Seules les demandes en attente peuvent être annulées' }

  // Supprimer la pièce jointe si présente
  if (conge.piece_jointe_url) {
    await admin.storage.from('certificats-medicaux').remove([conge.piece_jointe_url])
  }

  const { error } = await admin.from('conges').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/conges')
  return {}
}

/** Génère une URL signée (1h) pour qu'un travailleur voie son propre certificat */
export async function getSignedUrlWorkerAction(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Vérifier que le path appartient à l'user
  if (!path.startsWith(user.id + '/')) return null
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('certificats-medicaux')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
```

- [ ] **Step 2 : Vérifier compilation**
```bash
npx tsc --noEmit
```
Expected : pas d'erreur.

- [ ] **Step 3 : Commit**
```bash
git add lib/conges/actions.ts
git commit -m "feat(conges): add worker server actions (getSoldes, demanderConge, annulerConge)"
```

---

## Chunk 3 — Server Actions Admin + Emails

### Task 5 : Créer lib/conges/admin-actions.ts

**Files:**
- Create: `lib/conges/admin-actions.ts`

- [ ] **Step 1 : Créer le fichier**

```ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Conge, SoldeConges, Profile } from '@/types/database'
import { getJoursOuvrables } from '@/lib/utils/dates'
import { sendCongeDecisionEmail } from '@/lib/resend/emails'

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

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

/** Toutes les demandes, toutes personnes */
export async function getAllCongesAdmin(): Promise<CongeWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .order('created_at', { ascending: false })
  return (data ?? []) as CongeWithProfile[]
}

/** Demandes en attente uniquement (pour widget dashboard) */
export async function getCongesEnAttenteAdmin(): Promise<CongeWithProfile[]> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
    .limit(5)
  return (data ?? []) as CongeWithProfile[]
}

/** Nombre total de demandes en attente */
export async function getCongesEnAttenteCount(): Promise<number> {
  await assertAdmin()
  const admin = createAdminClient()
  const { count } = await admin
    .from('conges')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'en_attente')
  return count ?? 0
}

/** URL signée (1h) pour voir un certificat médical */
export async function getSignedUrlAdminAction(path: string): Promise<string | null> {
  await assertAdmin()
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('certificats-medicaux')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Récupère les soldes d'un travailleur (vue admin) */
export async function getSoldesCongesWorkerAdmin(
  userId: string,
  annee?: number
): Promise<SoldeConges | null> {
  await assertAdmin()
  const targetAnnee = annee ?? new Date().getFullYear()
  const admin = createAdminClient()
  const { data } = await admin
    .from('soldes_conges')
    .select('*')
    .eq('user_id', userId)
    .eq('annee', targetAnnee)
    .single()
  return data ?? null
}

/** Modifie les soldes annuels d'un travailleur */
export async function updateSoldesCongesAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  await assertAdmin()
  const userId = formData.get('user_id') as string
  const anneeStr = formData.get('annee') as string
  const caTotal = parseInt(formData.get('conges_annuels_total') as string, 10)
  const rcTotal = parseInt(formData.get('repos_comp_total') as string, 10)

  if (!userId || !anneeStr) return { error: 'Paramètres manquants' }
  if (isNaN(caTotal) || isNaN(rcTotal)) return { error: 'Valeurs invalides' }
  if (caTotal < 0 || rcTotal < 0) return { error: 'Les soldes ne peuvent pas être négatifs' }

  const annee = parseInt(anneeStr, 10)
  const admin = createAdminClient()
  const { error } = await admin.from('soldes_conges').upsert(
    { user_id: userId, annee, conges_annuels_total: caTotal, repos_comp_total: rcTotal, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,annee' }
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

/** Approuve ou refuse une demande de congé */
export async function traiterCongeAction(
  id: string,
  decision: 'approuve' | 'refuse',
  commentaire_admin?: string
): Promise<{ error?: string; success?: boolean }> {
  const adminUser = await assertAdmin()
  const admin = createAdminClient()

  // Récupérer le congé + profil travailleur
  const { data: conge } = await admin
    .from('conges')
    .select('*, profile:profiles!user_id(prenom, nom, email)')
    .eq('id', id)
    .single()

  if (!conge) return { error: 'Demande introuvable' }
  if (conge.statut !== 'en_attente') return { error: 'Cette demande a déjà été traitée' }

  // Mettre à jour le statut
  const { error: updateError } = await admin.from('conges').update({
    statut: decision,
    commentaire_admin: commentaire_admin ?? null,
    approuve_par: adminUser.id,
    approuve_le: new Date().toISOString(),
  }).eq('id', id)
  if (updateError) return { error: updateError.message }

  if (decision === 'approuve') {
    const annee = new Date(conge.date_debut).getFullYear()

    // Incrémenter le compteur de jours pris dans soldes_conges
    if (conge.type === 'conge_annuel' || conge.type === 'repos_comp') {
      const { data: solde } = await admin
        .from('soldes_conges')
        .select('conges_annuels_pris, repos_comp_pris')
        .eq('user_id', conge.user_id)
        .eq('annee', annee)
        .single()

      if (solde) {
        const update =
          conge.type === 'conge_annuel'
            ? { conges_annuels_pris: solde.conges_annuels_pris + conge.nb_jours, updated_at: new Date().toISOString() }
            : { repos_comp_pris: solde.repos_comp_pris + conge.nb_jours, updated_at: new Date().toISOString() }
        await admin
          .from('soldes_conges')
          .update(update)
          .eq('user_id', conge.user_id)
          .eq('annee', annee)
      }
    }

    // Écrire les day_statuses pour chaque jour ouvrable du congé
    const statusCode: 'C' | 'M' | 'R' =
      conge.type === 'maladie' ? 'M' :
      conge.type === 'repos_comp' ? 'R' : 'C'

    const joursOuvrables = getJoursOuvrables(conge.date_debut, conge.date_fin)
    if (joursOuvrables.length > 0) {
      const upserts = joursOuvrables.map((date) => ({
        user_id: conge.user_id,
        date,
        status: statusCode,
        commentaire: `Congé approuvé #${id.slice(0, 8)}`,
        corrige_par: adminUser.id,
      }))
      await admin.from('day_statuses').upsert(upserts, { onConflict: 'user_id,date' })
    }
  }

  // Envoyer email au travailleur (non-bloquant)
  const profile = conge.profile as { prenom: string; nom: string; email: string } | null
  if (profile?.email) {
    sendCongeDecisionEmail({
      email: profile.email,
      prenom: profile.prenom,
      decision,
      type: conge.type,
      date_debut: conge.date_debut,
      date_fin: conge.date_fin,
      nb_jours: conge.nb_jours,
      commentaire_admin,
    }).catch(() => {/* email non-bloquant */})
  }

  revalidatePath('/admin/conges')
  revalidatePath('/conges')
  revalidatePath('/admin/recap')
  return { success: true }
}
```

- [ ] **Step 2 : Vérifier compilation** (l'import `sendCongeDecisionEmail` va échouer jusqu'à Task 6 — OK à ce stade)
```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**
```bash
git add lib/conges/admin-actions.ts
git commit -m "feat(conges): add admin server actions (traiterConge, updateSoldes, getAllConges)"
```

---

### Task 6 : Email templates + sendCongeDecisionEmail

**Files:**
- Create: `emails/CongeApprouveEmail.tsx`
- Create: `emails/CongeRefuseEmail.tsx`
- Modify: `lib/resend/emails.ts`

- [ ] **Step 1 : Créer emails/CongeApprouveEmail.tsx**

```tsx
import {
  Html, Head, Body, Container, Heading, Text, Button, Section, Hr,
} from '@react-email/components'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'

interface Props {
  prenom: string
  type: string
  date_debut: string
  date_fin: string
  nb_jours: number
  commentaire_admin?: string
  appUrl: string
}

export default function CongeApprouveEmail({
  prenom, type, date_debut, date_fin, nb_jours, commentaire_admin, appUrl,
}: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f0f2f8' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-block', background: '#e53e3e', color: '#fff', fontWeight: 900, fontSize: 22, borderRadius: 8, padding: '6px 16px', letterSpacing: 1 }}>CG</div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Centrale Générale FGTB Namur-Luxembourg</div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48 }}>✅</div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20, marginBottom: 8 }}>
            Demande approuvée, {prenom} !
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Votre demande de <strong>{labelTypeConge(type)}</strong> a été approuvée.
          </Text>

          <Section style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px 20px', margin: '20px 0', border: '1px solid #bbf7d0' }}>
            <Text style={{ margin: 0, color: '#166534', fontSize: 14 }}>
              <strong>Du</strong> {formatDateFr(date_debut)} <strong>au</strong> {formatDateFr(date_fin)}
            </Text>
            <Text style={{ margin: '6px 0 0', color: '#166534', fontSize: 14 }}>
              <strong>{nb_jours} jour{nb_jours > 1 ? 's' : ''} ouvrable{nb_jours > 1 ? 's' : ''}</strong>
            </Text>
          </Section>

          {commentaire_admin && (
            <Section style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', margin: '12px 0' }}>
              <Text style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                <strong>Note de l'administration :</strong> {commentaire_admin}
              </Text>
            </Section>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={`${appUrl}/conges`} style={{ background: '#e53e3e', color: '#fff', padding: '13px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Voir mes congés
            </Button>
          </div>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Portail RH — Centrale Générale FGTB Namur-Luxembourg
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2 : Créer emails/CongeRefuseEmail.tsx**

```tsx
import {
  Html, Head, Body, Container, Heading, Text, Button, Section, Hr,
} from '@react-email/components'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'

interface Props {
  prenom: string
  type: string
  date_debut: string
  date_fin: string
  nb_jours: number
  commentaire_admin?: string
  appUrl: string
}

export default function CongeRefuseEmail({
  prenom, type, date_debut, date_fin, nb_jours, commentaire_admin, appUrl,
}: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f0f2f8' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-block', background: '#e53e3e', color: '#fff', fontWeight: 900, fontSize: 22, borderRadius: 8, padding: '6px 16px', letterSpacing: 1 }}>CG</div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Centrale Générale FGTB Namur-Luxembourg</div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48 }}>❌</div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20, marginBottom: 8 }}>
            Demande non accordée, {prenom}
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Votre demande de <strong>{labelTypeConge(type)}</strong> n'a malheureusement pas pu être accordée.
          </Text>

          <Section style={{ background: '#fff5f5', borderRadius: 8, padding: '16px 20px', margin: '20px 0', border: '1px solid #fed7d7' }}>
            <Text style={{ margin: 0, color: '#9b2c2c', fontSize: 14 }}>
              <strong>Du</strong> {formatDateFr(date_debut)} <strong>au</strong> {formatDateFr(date_fin)}
            </Text>
            <Text style={{ margin: '6px 0 0', color: '#9b2c2c', fontSize: 14 }}>
              <strong>{nb_jours} jour{nb_jours > 1 ? 's' : ''} ouvrable{nb_jours > 1 ? 's' : ''}</strong>
            </Text>
          </Section>

          {commentaire_admin && (
            <Section style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', margin: '12px 0' }}>
              <Text style={{ margin: 0, color: '#374151', fontSize: 13 }}>
                <strong>Motif :</strong> {commentaire_admin}
              </Text>
            </Section>
          )}

          <Text style={{ color: '#6b7280', lineHeight: 1.6, fontSize: 13 }}>
            Pour toute question, n'hésitez pas à contacter l'administration RH.
          </Text>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={`${appUrl}/conges`} style={{ background: '#e53e3e', color: '#fff', padding: '13px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Voir mes congés
            </Button>
          </div>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Portail RH — Centrale Générale FGTB Namur-Luxembourg
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 3 : Ajouter sendCongeDecisionEmail dans lib/resend/emails.ts**

Ajouter les imports en haut du fichier (après les imports existants) :
```ts
import CongeApprouveEmail from '@/emails/CongeApprouveEmail'
import CongeRefuseEmail from '@/emails/CongeRefuseEmail'
```

Ajouter la fonction en fin de fichier :
```ts
export async function sendCongeDecisionEmail(params: {
  email: string
  prenom: string
  decision: 'approuve' | 'refuse'
  type: string
  date_debut: string
  date_fin: string
  nb_jours: number
  commentaire_admin?: string
}) {
  const FROM = process.env.RESEND_FROM!
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
  const commonProps = {
    prenom: params.prenom,
    type: params.type,
    date_debut: params.date_debut,
    date_fin: params.date_fin,
    nb_jours: params.nb_jours,
    commentaire_admin: params.commentaire_admin,
    appUrl: APP_URL,
  }
  return getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: params.decision === 'approuve'
      ? 'Votre demande de congé a été approuvée'
      : 'Votre demande de congé n\'a pas été accordée',
    react: params.decision === 'approuve'
      ? CongeApprouveEmail(commonProps)
      : CongeRefuseEmail(commonProps),
  })
}
```

- [ ] **Step 4 : Vérifier compilation**
```bash
npx tsc --noEmit
```
Expected : aucune erreur.

- [ ] **Step 5 : Commit**
```bash
git add emails/CongeApprouveEmail.tsx emails/CongeRefuseEmail.tsx lib/resend/emails.ts
git commit -m "feat(emails): add CongeApprouve + CongeRefuse email templates and sendCongeDecisionEmail"
```

---

## Chunk 4 — UI Travailleur : Page /conges

### Task 7 : Créer components/conges/SoldesCongesWidget.tsx

**Files:**
- Create: `components/conges/SoldesCongesWidget.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
import { SoldeConges } from '@/types/database'

interface Props {
  soldes: SoldeConges | null
}

function ProgressBar({ label, pris, total }: { label: string; pris: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((pris / total) * 100)) : 0
  const disponible = Math.max(0, total - pris)
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-semibold text-[#1a2332]">{label}</span>
        <span className="text-[10px] text-gray-500">
          <span className="font-bold text-[#1a2332]">{disponible}</span>/{total} jour{total > 1 ? 's' : ''} disponible{disponible > 1 ? 's' : ''}
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#10b981]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5">{pris} jour{pris !== 1 ? 's' : ''} pris</div>
    </div>
  )
}

export default function SoldesCongesWidget({ soldes }: Props) {
  const annee = new Date().getFullYear()

  if (!soldes) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
          🌴 Soldes congés {annee}
        </p>
        <p className="text-[11px] text-gray-400 italic">Aucun solde configuré pour cette année.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">
        🌴 Soldes congés {annee}
      </p>
      <div className="space-y-4">
        <ProgressBar
          label="Congés annuels"
          pris={soldes.conges_annuels_pris}
          total={soldes.conges_annuels_total}
        />
        <ProgressBar
          label="Repos compensatoires"
          pris={soldes.repos_comp_pris}
          total={soldes.repos_comp_total}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add components/conges/SoldesCongesWidget.tsx
git commit -m "feat(ui): add SoldesCongesWidget with progress bars"
```

---

### Task 8 : Créer components/conges/DemandeCongeForm.tsx

**Files:**
- Create: `components/conges/DemandeCongeForm.tsx`

> Composant client (`'use client'`) pour le calcul temps-réel des jours ouvrables et l'affichage conditionnel du champ pièce jointe.

- [ ] **Step 1 : Créer le fichier**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { demanderCongeAction } from '@/lib/conges/actions'
import { calcJoursOuvrables } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

const TYPE_OPTIONS = [
  { value: 'conge_annuel', label: 'Congé annuel' },
  { value: 'repos_comp', label: 'Repos compensatoire' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'autre', label: 'Autre' },
]

interface Props {
  onSuccess?: () => void
}

export default function DemandeCongeForm({ onSuccess }: Props) {
  const [state, formAction] = useFormState(demanderCongeAction, null)
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState('conge_annuel')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const nbJours = dateDebut && dateFin && dateFin >= dateDebut
    ? calcJoursOuvrables(dateDebut, dateFin)
    : 0

  // Réinitialiser + notifier parent si succès
  if (state?.success && onSuccess) {
    onSuccess()
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      {/* Type */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type de congé *</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#1a2332] focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
          required
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date de début *</label>
          <input
            type="date"
            name="date_debut"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date de fin *</label>
          <input
            type="date"
            name="date_fin"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            min={dateDebut}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            required
          />
        </div>
      </div>

      {/* Nb jours calculé */}
      {nbJours > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] text-blue-700 font-semibold">
          📅 {nbJours} jour{nbJours > 1 ? 's' : ''} ouvrable{nbJours > 1 ? 's' : ''}
        </div>
      )}

      {/* Pièce jointe — obligatoire si maladie */}
      {type === 'maladie' && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Certificat médical <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            name="piece_jointe"
            accept=".pdf,.jpg,.jpeg,.png"
            required
            className="w-full text-[11px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
          />
          <p className="text-[10px] text-gray-400 mt-1">PDF, JPG ou PNG — max 5 MB</p>
        </div>
      )}

      {type !== 'maladie' && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Pièce jointe (optionnel)
          </label>
          <input
            type="file"
            name="piece_jointe"
            accept=".pdf,.jpg,.jpeg,.png"
            className="w-full text-[11px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
          />
        </div>
      )}

      {/* Commentaire */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Commentaire (optionnel)</label>
        <textarea
          name="commentaire_travailleur"
          rows={3}
          placeholder="Informations complémentaires..."
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
        />
      </div>

      {/* Erreur / succès */}
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600">
          {state.error}
        </div>
      )}
      {state?.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700">
          ⚠️ {state.warning}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-[11px] text-green-700">
          ✅ Demande envoyée avec succès.
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || nbJours === 0}
        className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white text-[12px] h-9"
      >
        {isPending ? 'Envoi en cours...' : 'Envoyer la demande'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add components/conges/DemandeCongeForm.tsx
git commit -m "feat(ui): add DemandeCongeForm with real-time day calculation and file upload"
```

---

### Task 9 : Créer components/conges/ListeDemandesWorker.tsx

**Files:**
- Create: `components/conges/ListeDemandesWorker.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
'use client'

import { useState } from 'react'
import { Conge } from '@/types/database'
import { annulerCongeAction } from '@/lib/conges/actions'
import { formatDateFr, labelTypeConge, labelStatutConge } from '@/lib/utils/dates'

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

interface Props {
  conges: Conge[]
}

export default function ListeDemandesWorker({ conges }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleAnnuler(id: string) {
    if (!confirm('Confirmer l\'annulation de cette demande ?')) return
    setLoadingId(id)
    const result = await annulerCongeAction(id)
    if (result.error) setErrors((prev) => ({ ...prev, [id]: result.error! }))
    setLoadingId(null)
  }

  if (conges.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-xs italic">
        Aucune demande de congé
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-50">
        {conges.map((c) => (
          <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-semibold text-[#1a2332]">
                  {labelTypeConge(c.type)}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                  {labelStatutConge(c.statut)}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)} — <strong>{c.nb_jours} j</strong>
              </div>
              {c.commentaire_admin && (
                <div className="text-[10px] text-gray-400 mt-1 italic">
                  Note admin : {c.commentaire_admin}
                </div>
              )}
              {errors[c.id] && (
                <div className="text-[10px] text-red-500 mt-1">{errors[c.id]}</div>
              )}
            </div>
            {c.statut === 'en_attente' && (
              <button
                onClick={() => handleAnnuler(c.id)}
                disabled={loadingId === c.id}
                className="flex-shrink-0 text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 transition-colors disabled:opacity-50"
              >
                {loadingId === c.id ? '...' : 'Annuler'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add components/conges/ListeDemandesWorker.tsx
git commit -m "feat(ui): add ListeDemandesWorker with cancel support"
```

---

### Task 10 : Créer app/(dashboard)/conges/page.tsx

**Files:**
- Create: `app/(dashboard)/conges/page.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Conge, SoldeConges } from '@/types/database'
import { getSoldesCongesAction, getMesCongesAction } from '@/lib/conges/actions'
import SoldesCongesWidget from '@/components/conges/SoldesCongesWidget'
import DemandeCongeForm from '@/components/conges/DemandeCongeForm'
import ListeDemandesWorker from '@/components/conges/ListeDemandesWorker'

// Note: on utilise 'use client' car on a besoin d'un formulaire interactif
// Les données initiales sont chargées via Server Actions
export default function CongesPage() {
  const [soldes, setSoldes] = useState<SoldeConges | null>(null)
  const [conges, setConges] = useState<Conge[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [s, c] = await Promise.all([getSoldesCongesAction(), getMesCongesAction()])
    setSoldes(s)
    setConges(c)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  function handleFormSuccess() {
    setShowForm(false)
    reload()
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-xs text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-[#1a2332]">Mes congés</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-semibold px-3 py-1.5 bg-[#e53e3e] text-white rounded-lg hover:bg-[#c53030] transition-colors"
        >
          {showForm ? '✕ Fermer' : '+ Demander un congé'}
        </button>
      </div>

      <SoldesCongesWidget soldes={soldes} />

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-[12px] font-bold text-[#1a2332] mb-4">Nouvelle demande</h2>
          <DemandeCongeForm onSuccess={handleFormSuccess} />
        </div>
      )}

      <div>
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Mes demandes
        </h2>
        <ListeDemandesWorker conges={conges} />
      </div>
    </div>
  )
}
```

> **Note architectural :** La page est `'use client'` avec appels de Server Actions depuis le client. Cela fonctionne car les Server Actions sont toujours exécutées côté serveur. Alternative possible : RSC avec Suspense, mais le pattern actuel est plus cohérent avec la mise à jour dynamique après soumission.

- [ ] **Step 2 : Démarrer le serveur et tester**
```bash
npm run dev
```
Naviguer vers `/conges`. Vérifier :
- Le widget soldes s'affiche (ou message "Aucun solde")
- Le bouton "Demander un congé" affiche le formulaire
- Le calcul de jours s'affiche en temps réel
- La liste des demandes s'affiche

- [ ] **Step 3 : Commit**
```bash
git add app/\(dashboard\)/conges/page.tsx
git commit -m "feat(pages): add /conges worker page with form, soldes widget, and list"
```

---

## Chunk 5 — UI Admin : Page /admin/conges + Fiche travailleur

### Task 11 : Créer components/admin/CongesEnAttenteWidget.tsx

**Files:**
- Create: `components/admin/CongesEnAttenteWidget.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
import Link from 'next/link'
import { Conge, Profile } from '@/types/database'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conges: CongeWithProfile[]
}

export default function CongesEnAttenteWidget({ conges }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          🌴 Congés en attente
          {conges.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {conges.length}
            </span>
          )}
        </p>
        <Link
          href="/admin/conges"
          className="text-[10px] text-[#e53e3e] font-semibold hover:underline"
        >
          Voir tout →
        </Link>
      </div>

      {conges.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">Aucune demande en attente.</p>
      ) : (
        <div className="space-y-2">
          {conges.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#1a2332] truncate">
                  {c.profile.prenom} {c.profile.nom}
                </div>
                <div className="text-[10px] text-gray-400">
                  {labelTypeConge(c.type)} — {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)} ({c.nb_jours}j)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add components/admin/CongesEnAttenteWidget.tsx
git commit -m "feat(admin): add CongesEnAttenteWidget for dashboard"
```

---

### Task 12 : Créer components/admin/CongesTable.tsx + CongeApprovalModal.tsx

**Files:**
- Create: `components/admin/CongesTable.tsx`
- Create: `components/admin/CongeApprovalModal.tsx`

- [ ] **Step 1 : Créer components/admin/CongeApprovalModal.tsx**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Conge, Profile } from '@/types/database'
import { traiterCongeAction, getSignedUrlAdminAction } from '@/lib/conges/admin-actions'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

interface Props {
  conge: CongeWithProfile
  open: boolean
  onClose: () => void
  onDone: () => void
}

export default function CongeApprovalModal({ conge, open, onClose, onDone }: Props) {
  const [commentaire, setCommentaire] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [certUrl, setCertUrl] = useState<string | null>(null)
  const [loadingCert, setLoadingCert] = useState(false)

  async function handleVoirCertificat() {
    if (!conge.piece_jointe_url) return
    setLoadingCert(true)
    const url = await getSignedUrlAdminAction(conge.piece_jointe_url)
    if (url) window.open(url, '_blank')
    setLoadingCert(false)
  }

  function handleDecision(decision: 'approuve' | 'refuse') {
    setError(null)
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#1a2332]">
            Traiter la demande de congé
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-[12px]">
          {/* Infos demande */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Travailleur</span>
              <span className="font-semibold text-[#1a2332]">{conge.profile.prenom} {conge.profile.nom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold">{labelTypeConge(conge.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Période</span>
              <span className="font-semibold">{formatDateFr(conge.date_debut)} → {formatDateFr(conge.date_fin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Durée</span>
              <span className="font-semibold">{conge.nb_jours} jour{conge.nb_jours > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Commentaire travailleur */}
          {conge.commentaire_travailleur && (
            <div className="bg-blue-50 rounded-lg p-3 text-[11px] text-blue-700">
              <strong>Note du travailleur :</strong> {conge.commentaire_travailleur}
            </div>
          )}

          {/* Pièce jointe */}
          {conge.piece_jointe_url && (
            <div>
              <button
                onClick={handleVoirCertificat}
                disabled={loadingCert}
                className="text-[11px] text-[#e53e3e] font-semibold hover:underline disabled:opacity-50"
              >
                {loadingCert ? 'Chargement...' : '📎 Voir le certificat'}
              </button>
            </div>
          )}

          {/* Commentaire admin */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Commentaire admin (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Motif de refus, remarque..."
              className="w-full text-[11px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => handleDecision('approuve')}
              disabled={isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[11px] h-8"
            >
              ✅ Approuver
            </Button>
            <Button
              onClick={() => handleDecision('refuse')}
              disabled={isPending}
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-[11px] h-8"
            >
              ❌ Refuser
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-[11px] h-7 text-gray-400"
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2 : Créer components/admin/CongesTable.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Conge, Profile } from '@/types/database'
import { formatDateFr, labelTypeConge, labelStatutConge } from '@/lib/utils/dates'
import CongeApprovalModal from '@/components/admin/CongeApprovalModal'

type CongeWithProfile = Conge & { profile: Pick<Profile, 'prenom' | 'nom' | 'email'> }

const STATUT_STYLE: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}

interface Props {
  initialConges: CongeWithProfile[]
}

export default function CongesTable({ initialConges }: Props) {
  const [conges, setConges] = useState(initialConges)
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterMois, setFilterMois] = useState<string>('')
  const [selectedConge, setSelectedConge] = useState<CongeWithProfile | null>(null)

  function reloadPage() {
    // Server revalidation via revalidatePath dans l'action — on reload la page
    window.location.reload()
  }

  const filtered = conges.filter((c) => {
    if (filterStatut !== 'tous' && c.statut !== filterStatut) return false
    if (filterMois && !c.date_debut.startsWith(filterMois)) return false
    return true
  })

  // Options de mois (de toutes les demandes)
  const moisOptions = [...new Set(conges.map((c) => c.date_debut.slice(0, 7)))].sort().reverse()

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex gap-3 items-center flex-wrap">
        <div>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#1a2332]"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="approuve">Approuvés</option>
            <option value="refuse">Refusés</option>
          </select>
        </div>
        {moisOptions.length > 0 && (
          <div>
            <select
              value={filterMois}
              onChange={(e) => setFilterMois(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[#1a2332]"
            >
              <option value="">Tous les mois</option>
              {moisOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <span className="text-[10px] text-gray-400">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs italic">Aucune demande</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#1a2332] text-white">
                <th className="text-left px-3 py-2 font-semibold">Travailleur</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Période</th>
                <th className="text-center px-3 py-2 font-semibold">Jours</th>
                <th className="text-center px-3 py-2 font-semibold">Statut</th>
                <th className="text-center px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => c.statut === 'en_attente' && setSelectedConge(c)}
                >
                  <td className="px-3 py-2 font-semibold text-[#1a2332]">
                    {c.profile.prenom} {c.profile.nom}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{labelTypeConge(c.type)}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-[#1a2332]">{c.nb_jours}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUT_STYLE[c.statut]}`}>
                      {labelStatutConge(c.statut)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.statut === 'en_attente' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedConge(c) }}
                        className="text-[10px] text-[#e53e3e] font-semibold hover:underline"
                      >
                        Traiter
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal approbation */}
      {selectedConge && (
        <CongeApprovalModal
          conge={selectedConge}
          open={true}
          onClose={() => setSelectedConge(null)}
          onDone={reloadPage}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Commit**
```bash
git add components/admin/CongeApprovalModal.tsx components/admin/CongesTable.tsx
git commit -m "feat(admin): add CongesTable with filters and CongeApprovalModal"
```

---

### Task 13 : Créer app/(dashboard)/admin/conges/page.tsx

**Files:**
- Create: `app/(dashboard)/admin/conges/page.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllCongesAdmin } from '@/lib/conges/admin-actions'
import CongesTable from '@/components/admin/CongesTable'

export default async function AdminCongesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('is_admin_rh')
    .eq('id', user.id)
    .single()
  if (!myProfile?.is_admin_rh) redirect('/')

  const conges = await getAllCongesAdmin()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-sm font-bold text-[#1a2332] mb-4">
        🌴 Gestion des congés
      </h1>
      <CongesTable initialConges={conges} />
    </div>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add app/\(dashboard\)/admin/conges/page.tsx
git commit -m "feat(pages): add /admin/conges page with filterable table"
```

---

### Task 14 : Créer components/admin/SoldesCongesAdminSection.tsx

**Files:**
- Create: `components/admin/SoldesCongesAdminSection.tsx`

- [ ] **Step 1 : Créer le fichier**

```tsx
'use client'

import { useFormState } from 'react-dom'
import { SoldeConges } from '@/types/database'
import { updateSoldesCongesAction } from '@/lib/conges/admin-actions'
import { Button } from '@/components/ui/button'

interface Props {
  userId: string
  soldes: SoldeConges | null
  annee: number
}

export default function SoldesCongesAdminSection({ userId, soldes, annee }: Props) {
  const [state, formAction] = useFormState(updateSoldesCongesAction, null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
        🌴 Soldes congés {annee}
      </h3>

      {soldes && (
        <div className="grid grid-cols-2 gap-3 mb-3 text-[11px] text-gray-500">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="font-semibold text-[#1a2332]">Congés annuels</div>
            <div>{soldes.conges_annuels_pris}/{soldes.conges_annuels_total} jours pris</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="font-semibold text-[#1a2332]">Repos compensatoires</div>
            <div>{soldes.repos_comp_pris}/{soldes.repos_comp_total} jours pris</div>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="annee" value={annee} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Total congés annuels
            </label>
            <input
              type="number"
              name="conges_annuels_total"
              min={0}
              max={365}
              defaultValue={soldes?.conges_annuels_total ?? 0}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Total repos comp.
            </label>
            <input
              type="number"
              name="repos_comp_total"
              min={0}
              max={365}
              defaultValue={soldes?.repos_comp_total ?? 0}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e53e3e]/30"
              required
            />
          </div>
        </div>

        {state?.error && (
          <div className="text-[11px] text-red-500">{state.error}</div>
        )}
        {state?.success && (
          <div className="text-[11px] text-green-600">✅ Soldes mis à jour</div>
        )}

        <Button type="submit" size="sm" className="text-[11px] h-8 bg-[#1a2332] hover:bg-[#2d3f55] text-white">
          Sauvegarder les soldes
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**
```bash
git add components/admin/SoldesCongesAdminSection.tsx
git commit -m "feat(admin): add SoldesCongesAdminSection for travailleur fiche"
```

---

### Task 15 : Mettre à jour app/(dashboard)/admin/travailleurs/[id]/page.tsx

**Files:**
- Modify: `app/(dashboard)/admin/travailleurs/[id]/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

En haut du fichier, après les imports existants :
```ts
import SoldesCongesAdminSection from '@/components/admin/SoldesCongesAdminSection'
import { getSoldesCongesWorkerAdmin } from '@/lib/conges/admin-actions'
```

- [ ] **Step 2 : Ajouter la récupération des soldes dans Promise.all**

Modifier la ligne `const [profileRes, schedulesRes, bureauxRes, servicesRes, potHeuresRes] = await Promise.all([` pour inclure les soldes :

```ts
const [profileRes, schedulesRes, bureauxRes, servicesRes, potHeuresRes, soldesCongesRes] = await Promise.all([
  supabase.from('profiles').select('*, service:services(*)').eq('id', params.id).single(),
  supabase.from('user_bureau_schedule').select('*, bureau:bureaux(*)').eq('user_id', params.id).order('jour'),
  supabase.from('bureaux').select('*').order('nom'),
  supabase.from('services').select('*').order('nom'),
  admin.from('pot_heures').select('*').eq('user_id', params.id).eq('annee', annee).single(),
  getSoldesCongesWorkerAdmin(params.id, annee),
])
```

- [ ] **Step 3 : Récupérer la valeur**

Après `const potHeures = potHeuresRes.data as PotHeures | null` :
```ts
const soldesConges = soldesCongesRes
```

- [ ] **Step 4 : Ajouter le composant dans le JSX**

Après `<PotHeuresAdminSection userId={profile.id} potHeures={potHeures} />` :
```tsx
<SoldesCongesAdminSection userId={profile.id} soldes={soldesConges} annee={annee} />
```

- [ ] **Step 5 : Vérifier compilation**
```bash
npx tsc --noEmit
```
Expected : pas d'erreur.

- [ ] **Step 6 : Commit**
```bash
git add app/\(dashboard\)/admin/travailleurs/\[id\]/page.tsx
git commit -m "feat(admin): add SoldesCongesAdminSection to travailleur fiche"
```

---

## Chunk 6 — Intégration Dashboard + Navigation

### Task 16 : Mettre à jour app/(dashboard)/page.tsx — widget admin

**Files:**
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

```ts
import CongesEnAttenteWidget from '@/components/admin/CongesEnAttenteWidget'
import { getCongesEnAttenteAdmin } from '@/lib/conges/admin-actions'
```

- [ ] **Step 2 : Modifier la fonction DashboardPage**

Ajouter la récupération du profil admin et des congés en attente :

```ts
export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const dow = today.getDay()

  const [pointage, schedulesRes, soldeData, profileRes] = await Promise.all([
    getTodayPointage(),
    supabase.from('user_bureau_schedule').select('*, bureau:bureaux(*)').eq('user_id', user.id).eq('jour', dow).single(),
    getSoldeHeuresAction(),
    supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single(),
  ])

  const bureauDuJour = schedulesRes.data as (UserBureauSchedule & { bureau: Bureau }) | null
  const isAdmin = profileRes.data?.is_admin_rh ?? false

  // Congés en attente — uniquement si admin
  const congesEnAttente = isAdmin ? await getCongesEnAttenteAdmin() : []

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-sm font-bold text-[#1a2332]">Tableau de bord</h1>

      <PointageWidget pointage={pointage} />

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          📍 Bureau du jour
        </p>
        <p className="text-sm font-semibold text-[#1a2332]">
          {dow === 0 || dow === 6 ? 'Week-end' : bureauDuJour?.bureau?.nom ?? 'Sur la route'}
        </p>
      </div>

      <SoldeHeuresWidget solde={soldeData?.solde_minutes ?? null} />

      {isAdmin && <CongesEnAttenteWidget conges={congesEnAttente} />}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier compilation**
```bash
npx tsc --noEmit
```
Expected : pas d'erreur.

- [ ] **Step 4 : Commit**
```bash
git add app/\(dashboard\)/page.tsx
git commit -m "feat(dashboard): add CongesEnAttenteWidget for admin users"
```

---

### Task 17 : Mettre à jour components/layout/Sidebar.tsx — lien admin/conges

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1 : Mettre à jour adminLinks**

Remplacer le lien `/conges` dans `adminLinks` par `/admin/conges` :

```ts
const adminLinks = [
  { href: '/', icon: '🏠', label: 'Accueil' },
  { href: '/admin/travailleurs', icon: '👥', label: 'Travailleurs' },
  { href: '/admin/conges', icon: '🌴', label: 'Congés RH' },
  { href: '/pointage', icon: '⏱', label: 'Pointage' },
  { href: '/calendrier', icon: '📅', label: 'Calendrier' },
  { href: '/admin/recap', icon: '📊', label: 'Rapports' },
]
```

> Les workers gardent `/conges` dans `workerLinks`. Les admins accèdent à leur vue personnelle des congés via `/admin/conges` (qui affiche toutes les demandes). Si un admin veut voir ses propres congés, il peut utiliser la page `/conges` directement.

- [ ] **Step 2 : Commit**
```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(nav): update admin sidebar to link /admin/conges instead of /conges"
```

---

### Task 18 : Vérification finale — build complet

- [ ] **Step 1 : Build de production**
```bash
npm run build
```
Expected : aucune erreur TypeScript ou Next.js. Des warnings sont acceptables.

- [ ] **Step 2 : Test fonctionnel rapide — prévisualiser l'app**

Démarrer le serveur :
```bash
npm run dev
```

Vérifier les parcours :

**Parcours Travailleur :**
1. `/conges` — widget soldes + bouton formulaire
2. Clic "Demander un congé" → formulaire avec calcul temps-réel
3. Choisir type "Maladie" → champ pièce jointe devient obligatoire
4. Sélectionner des dates → vérifier que nb_jours s'affiche
5. Soumettre → message succès + rechargement liste

**Parcours Admin :**
1. `/` (dashboard) → widget "Congés en attente" visible si demandes existent
2. Clic "Voir tout" → `/admin/conges`
3. Filtrer par statut "En attente"
4. Clic "Traiter" sur une ligne → modal s'ouvre
5. Approuver → vérifier que le statut change dans le tableau
6. `/admin/recap` → vérifier que les jours de congé approuvés montrent le bon code (C/M/R)
7. `/admin/travailleurs/{id}` → section "Soldes congés" présente avec formulaire d'édition

- [ ] **Step 3 : Commit final**
```bash
git add -A
git commit -m "feat(module4): complete conges module - worker/admin UI, storage, emails"
```

---

## Récapitulatif des fichiers

### Créés (14 fichiers)
| Fichier | Rôle |
|---------|------|
| `lib/utils/dates.ts` | Fonctions pures : calcJoursOuvrables, formatDateFr, labelTypeConge |
| `lib/conges/actions.ts` | Server Actions worker : getSoldes, demanderConge, annulerConge |
| `lib/conges/admin-actions.ts` | Server Actions admin : traiterConge, updateSoldes, getAllConges |
| `emails/CongeApprouveEmail.tsx` | Template email approbation |
| `emails/CongeRefuseEmail.tsx` | Template email refus |
| `app/(dashboard)/conges/page.tsx` | Page travailleur /conges |
| `app/(dashboard)/admin/conges/page.tsx` | Page admin /admin/conges |
| `components/conges/SoldesCongesWidget.tsx` | Widget barres de progression soldes |
| `components/conges/DemandeCongeForm.tsx` | Formulaire demande avec calcul temps-réel |
| `components/conges/ListeDemandesWorker.tsx` | Liste demandes travailleur avec annulation |
| `components/admin/CongesEnAttenteWidget.tsx` | Widget dashboard admin demandes en attente |
| `components/admin/CongesTable.tsx` | Tableau filtrable toutes demandes |
| `components/admin/CongeApprovalModal.tsx` | Modal traitement demande |
| `components/admin/SoldesCongesAdminSection.tsx` | Section soldes sur fiche travailleur |

### Modifiés (5 fichiers)
| Fichier | Modification |
|---------|-------------|
| `types/database.ts` | +Conge, +SoldeConges, +TypeConge, +StatutConge |
| `lib/resend/emails.ts` | +sendCongeDecisionEmail |
| `app/(dashboard)/page.tsx` | +CongesEnAttenteWidget pour admin |
| `app/(dashboard)/admin/travailleurs/[id]/page.tsx` | +SoldesCongesAdminSection |
| `components/layout/Sidebar.tsx` | admin: /conges → /admin/conges |

> **Note intégration RecapMensuel :** Aucune modification nécessaire. Lorsque `traiterCongeAction` approuve une demande, il écrit directement dans `day_statuses` (C/M/R). `computeStatus` dans RecapMensuel donne déjà la priorité à `day_statuses` sur le pointage. L'intégration est donc automatique.
