# Module 1 — Auth & Gestion des utilisateurs : Plan d'implémentation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le socle complet d'authentification et de gestion des utilisateurs d'une application RH interne pour la Centrale Générale FGTB Namur-Luxembourg (19 travailleurs).

**Architecture:** Next.js 14 App Router avec Server Components et Server Actions exclusivement (pas de routes API REST). Supabase pour l'auth (email+password, OTP invitation), la base de données (PostgreSQL + RLS) et le storage. Resend pour les emails transactionnels en français.

**Tech Stack:** Next.js 14 · TypeScript · Supabase (Auth + PostgreSQL) · Resend · Tailwind CSS · shadcn/ui · Vercel

**Spec:** `docs/superpowers/specs/2026-03-11-module1-auth-users-design.md`

---

## Fichiers à créer

```
gestion_rh/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── activation/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── profil/page.tsx
│   │   └── admin/
│   │       ├── travailleurs/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       └── recap/page.tsx
│   └── api/auth/callback/route.ts
├── components/
│   ├── layout/Sidebar.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── ActivationForm.tsx
│   │   └── ResetPasswordForm.tsx
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── CoordonneesSection.tsx
│   │   ├── DonneesRHSection.tsx
│   │   └── AffectationSection.tsx
│   └── admin/
│       ├── TravailleursTable.tsx
│       ├── TravailleurForm.tsx
│       ├── RecapMensuel.tsx
│       └── PointageManquantModal.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── supabase/middleware.ts
│   ├── resend/emails.ts
│   └── auth/actions.ts
├── supabase/migrations/
│   ├── 001_services.sql
│   ├── 002_bureaux.sql
│   ├── 003_profiles.sql
│   ├── 004_user_bureau_schedule.sql
│   ├── 005_invitation_tokens.sql
│   └── 006_rls_policies.sql
├── emails/
│   ├── InvitationEmail.tsx
│   ├── ResetPasswordEmail.tsx
│   └── WelcomeEmail.tsx
├── types/database.ts
├── middleware.ts
├── .env.local.example
└── package.json
```

---

## Chunk 1 : Setup du projet

### Task 1 : Initialisation Next.js + dépendances

**Files:**
- Create: `package.json` (généré par create-next-app)
- Create: `.env.local.example`
- Create: `types/database.ts`

- [ ] **Step 1 : Initialiser le projet Next.js 14**

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

Répondre `No` à "Would you like to use Turbopack".

- [ ] **Step 2 : Installer les dépendances**

```bash
npm install @supabase/supabase-js @supabase/ssr resend react-email
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-label
npm install lucide-react clsx tailwind-merge class-variance-authority
npx shadcn-ui@latest init
```

Pour `shadcn-ui init` : choisir `Default` style, `Slate` couleur de base, `yes` pour CSS variables.

- [ ] **Step 3 : Ajouter les composants shadcn nécessaires**

```bash
npx shadcn-ui@latest add button input label form card badge dialog select table dropdown-menu avatar
```

- [ ] **Step 4 : Créer `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM=rh@accg-nalux.be

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copier en `.env.local` et remplir avec les vraies valeurs depuis le dashboard Supabase et Resend.

- [ ] **Step 5 : Créer `types/database.ts`**

```typescript
export type ServiceCode = 'svc_admin' | 'juridique' | 'compta_rh' | 'permanent'
export type OptionHoraire = 'A' | 'B'

export type Service = {
  id: string
  nom: string
  code: ServiceCode
}

export type Bureau = {
  id: string
  nom: string
  code: string
  horaires_normaux: Record<string, unknown>
  horaires_ete: Record<string, unknown>
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
```

- [ ] **Step 6 : Commit initial**

```bash
git init
git add .
git commit -m "feat: init Next.js 14 project with Supabase, Resend, shadcn/ui"
```

---

### Task 2 : Migrations SQL Supabase

**Files:**
- Create: `supabase/migrations/001_services.sql`  ← `services` avant `profiles` (FK dependency — ordre intentionnellement différent de la spec)
- Create: `supabase/migrations/002_bureaux.sql`
- Create: `supabase/migrations/003_profiles.sql`
- Create: `supabase/migrations/004_user_bureau_schedule.sql`
- Create: `supabase/migrations/005_invitation_tokens.sql`
- Create: `supabase/migrations/006_rls_policies.sql`

- [ ] **Step 1 : Initialiser Supabase CLI**

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <VOTRE_PROJECT_REF>
```

Remplacer `<VOTRE_PROJECT_REF>` par l'ID du projet visible dans l'URL du dashboard Supabase.

- [ ] **Step 2 : Créer `supabase/migrations/001_services.sql`**

```sql
create table public.services (
  id   uuid primary key default gen_random_uuid(),
  nom  text not null,
  code text not null unique
);

insert into public.services (nom, code) values
  ('Service Administratif', 'svc_admin'),
  ('Juridique',             'juridique'),
  ('Compta/RH',             'compta_rh'),
  ('Permanent',             'permanent');
```

- [ ] **Step 3 : Créer `supabase/migrations/002_bureaux.sql`**

```sql
create table public.bureaux (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null,
  code             text not null unique,
  horaires_normaux jsonb not null default '{}',
  horaires_ete     jsonb not null default '{}'
);

insert into public.bureaux (nom, code, horaires_normaux, horaires_ete) values
(
  'Libramont', 'lib',
  '{"lun":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "mar":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"16:00","pause_debut":"12:00","pause_fin":"13:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}',
  '{"lun":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "mar":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}'
),
(
  'Namur', 'nam',
  '{"lun":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:30"},
    "mar":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:30"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}',
  '{"lun":{"debut":"08:30","fin":"15:00","pause_debut":"12:00","pause_fin":"13:30"},
    "mar":{"debut":"08:30","fin":"15:00","pause_debut":"12:00","pause_fin":"13:30"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"15:00","pause_debut":"12:00","pause_fin":"13:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}'
),
(
  'Marche', 'mar',
  '{"lun":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "mar":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "jeu":{"debut":"08:30","fin":"12:00"}}',
  '{"lun":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "mar":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "jeu":{"debut":"08:30","fin":"12:00"}}'
),
(
  'Arlon', 'arl',
  '{"lun":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "mar":{"debut":"08:30","fin":"16:30","pause_debut":"12:00","pause_fin":"13:00"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"16:00","pause_debut":"12:00","pause_fin":"13:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}',
  '{"lun":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "mar":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "mer":{"debut":"08:30","fin":"12:00"},
    "jeu":{"debut":"08:30","fin":"14:30","pause_debut":"12:00","pause_fin":"12:30"},
    "ven":{"debut":"08:30","fin":"12:00"}}'
);
```

- [ ] **Step 4 : Créer `supabase/migrations/003_profiles.sql`**

```sql
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  prenom           text not null,
  nom              text not null,
  email            text not null unique,
  telephone        text,
  date_naissance   date,
  contact_urgence  text,
  rue              text,
  numero           text,
  boite            text,
  code_postal      text,
  commune          text,
  pays             text not null default 'Belgique',
  service_id       uuid references public.services(id),
  type_contrat     text,
  date_entree      date,
  option_horaire   char(1) check (option_horaire in ('A', 'B')),
  is_admin_rh      boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: updated_at auto
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger: sync is_admin_rh → app_metadata
create or replace function public.sync_admin_rh_to_metadata()
returns trigger language plpgsql security definer as $$
begin
  if new.is_admin_rh <> old.is_admin_rh then
    update auth.users
    set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('is_admin_rh', new.is_admin_rh)
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger sync_admin_rh
  after update on public.profiles
  for each row execute function public.sync_admin_rh_to_metadata();
```

- [ ] **Step 5 : Créer `supabase/migrations/004_user_bureau_schedule.sql`**

```sql
create table public.user_bureau_schedule (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  bureau_id    uuid not null references public.bureaux(id),
  jour         smallint not null check (jour between 1 and 5),
  valide_depuis date not null default current_date,
  unique (user_id, jour, valide_depuis)
);
```

- [ ] **Step 6 : Créer `supabase/migrations/005_invitation_tokens.sql`**

```sql
create table public.invitation_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  otp_hash   text not null,          -- bcrypt hash du code à 6 chiffres
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Index pour lookups rapides
create index on public.invitation_tokens(user_id);
```

- [ ] **Step 7 : Créer `supabase/migrations/006_rls_policies.sql`**

```sql
-- Activer RLS sur toutes les tables
alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.bureaux             enable row level security;
alter table public.user_bureau_schedule enable row level security;
alter table public.invitation_tokens   enable row level security;

-- Helper: is_admin_rh (lit app_metadata du JWT)
create or replace function public.is_admin_rh()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin_rh')::boolean,
    false
  )
$$;

-- services: lecture pour tous les utilisateurs authentifiés
create policy "services_select_authenticated"
  on public.services for select
  to authenticated using (true);

-- bureaux: lecture pour tous les utilisateurs authentifiés
create policy "bureaux_select_authenticated"
  on public.bureaux for select
  to authenticated using (true);

-- profiles: worker voit uniquement sa propre ligne
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin_rh());

create policy "profiles_update_own_coords"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin_rh())
  with check (id = auth.uid() or public.is_admin_rh());

-- Seul un admin_rh peut insérer (via service_role dans Server Action)
create policy "profiles_insert_admin"
  on public.profiles for insert
  to service_role with check (true);

-- user_bureau_schedule: worker voit ses propres lignes, admin voit tout
create policy "schedule_select"
  on public.user_bureau_schedule for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin_rh());

create policy "schedule_write_admin"
  on public.user_bureau_schedule for all
  to service_role using (true);

-- invitation_tokens: service_role uniquement
create policy "tokens_service_role"
  on public.invitation_tokens for all
  to service_role using (true);
```

- [ ] **Step 8 : Appliquer les migrations**

```bash
npx supabase db push
```

Vérifier dans le dashboard Supabase → Table Editor que les 5 tables sont créées avec les bons champs.

- [ ] **Step 9 : Commit migrations**

```bash
git add supabase/ types/
git commit -m "feat: add database migrations and TypeScript types"
```

---

## Chunk 2 : Infrastructure Supabase + Auth

### Task 3 : Clients Supabase et middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1 : Créer `lib/supabase/client.ts`** (usage navigateur)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2 : Créer `lib/supabase/server.ts`** (usage Server Components + Server Actions)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Client avec service_role pour les Server Actions admin
// N'utilise PAS de cookie adapter — bypass RLS, uniquement côté serveur
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 3 : Créer `lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/activation') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/reset-password')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Vérifier is_active pour les utilisateurs connectés
  if (user && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()

    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'compte_desactive')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
```

- [ ] **Step 4 : Créer `middleware.ts`** (racine du projet)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 5 : Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase clients and auth middleware"
```

---

### Task 4 : Server Actions d'authentification

**Files:**
- Create: `lib/auth/actions.ts`
- Create: `lib/resend/emails.ts`

- [ ] **Step 1 : Créer `lib/resend/emails.ts`**

```typescript
import { Resend } from 'resend'
import InvitationEmail from '@/emails/InvitationEmail'
import ResetPasswordEmail from '@/emails/ResetPasswordEmail'
import WelcomeEmail from '@/emails/WelcomeEmail'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function sendInvitationEmail(params: {
  email: string
  prenom: string
  otpCode: string
}) {
  return resend.emails.send({
    from: FROM,
    to: params.email,
    subject: 'Votre invitation — Portail RH ACCG',
    react: InvitationEmail({
      prenom: params.prenom,
      otpCode: params.otpCode,
      activationUrl: `${APP_URL}/activation`,
    }),
  })
}

export async function sendResetPasswordEmail(params: {
  email: string
  prenom: string
  otpCode: string
}) {
  return resend.emails.send({
    from: FROM,
    to: params.email,
    subject: 'Réinitialisation de votre mot de passe',
    react: ResetPasswordEmail({
      prenom: params.prenom,
      otpCode: params.otpCode,
    }),
  })
}

export async function sendWelcomeEmail(params: {
  email: string
  prenom: string
}) {
  return resend.emails.send({
    from: FROM,
    to: params.email,
    subject: 'Bienvenue sur le portail RH ACCG',
    react: WelcomeEmail({ prenom: params.prenom, appUrl: APP_URL }),
  })
}
```

- [ ] **Step 2 : Créer `lib/auth/actions.ts`**

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendInvitationEmail, sendResetPasswordEmail, sendWelcomeEmail } from '@/lib/resend/emails'
import { redirect } from 'next/navigation'
import * as bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

// --- Connexion ---
export async function signIn(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/')
}

// --- Déconnexion ---
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// --- Invitation (admin uniquement, appel avec createAdminClient) ---
export async function inviteWorker(data: {
  prenom: string
  nom: string
  email: string
  service_id: string
  option_horaire: 'A' | 'B'
  type_contrat?: string
  date_entree?: string
}) {
  const admin = createAdminClient()

  // 1. Créer l'utilisateur dans auth.users (sans password — il le définira lui-même)
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    email_confirm: false,
    app_metadata: { is_admin_rh: false },
  })
  if (authError) return { error: authError.message }

  // 2. Créer le profil
  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    service_id: data.service_id,
    option_horaire: data.option_horaire,
    type_contrat: data.type_contrat ?? null,
    date_entree: data.date_entree ?? null,
  })
  if (profileError) return { error: profileError.message }

  // 3. Générer OTP et stocker le hash
  const otp = generateOTP()
  const otpHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error: tokenError } = await admin.from('invitation_tokens').insert({
    user_id: authUser.user.id,
    otp_hash: otpHash,
    expires_at: expiresAt,
  })
  if (tokenError) return { error: tokenError.message }

  // 4. Envoyer email
  await sendInvitationEmail({ email: data.email, prenom: data.prenom, otpCode: otp })

  return { success: true }
}

// --- Activation de compte ---
export async function activateAccount(formData: FormData) {
  const email = formData.get('email') as string
  const otp = formData.get('otp') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (password !== confirmPassword) return { error: 'Les mots de passe ne correspondent pas' }
  if (password.length < 8) return { error: 'Le mot de passe doit comporter au moins 8 caractères' }

  const admin = createAdminClient()

  // Délai constant pour résister aux attaques de timing (email trouvé vs non trouvé)
  const minDelay = new Promise((r) => setTimeout(r, 300))

  // Trouver le profil
  const { data: profile } = await admin
    .from('profiles')
    .select('id, prenom')
    .eq('email', email)
    .single()
  // Ne pas révéler si l'email existe (anti-énumération)
  if (!profile) { await minDelay; return { error: 'Code incorrect ou expiré' } }

  // Vérifier le token
  const { data: token } = await admin
    .from('invitation_tokens')
    .select('id, otp_hash, expires_at, used_at')
    .eq('user_id', profile.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!token) { await minDelay; return { error: 'Code incorrect ou expiré' } }
  if (new Date(token.expires_at) < new Date()) { await minDelay; return { error: 'Code expiré (48h dépassées)' } }

  const isValid = await bcrypt.compare(otp, token.otp_hash)
  await minDelay // garantit un temps de réponse constant
  if (!isValid) return { error: 'Code incorrect ou expiré' }

  // Définir le mot de passe
  const { error: pwError } = await admin.auth.admin.updateUserById(profile.id, {
    password,
    email_confirm: true,
  })
  if (pwError) return { error: pwError.message }

  // Marquer le token comme utilisé
  await admin.from('invitation_tokens').update({ used_at: new Date().toISOString() }).eq('id', token.id)

  // Envoyer email de bienvenue
  const { data: fullProfile } = await admin.from('profiles').select('prenom').eq('id', profile.id).single()
  await sendWelcomeEmail({ email, prenom: fullProfile?.prenom ?? '' })

  // Connecter l'utilisateur
  const supabase = createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect('/')
}

// --- Mot de passe oublié ---
export async function forgotPassword(formData: FormData) {
  const email = formData.get('email') as string
  const admin = createAdminClient()

  // Délai constant — empêche l'énumération d'emails par timing
  const minDelay = new Promise((r) => setTimeout(r, 300))

  const { data: profile } = await admin
    .from('profiles')
    .select('id, prenom')
    .eq('email', email)
    .single()
  // Ne pas révéler si l'email existe (anti-énumération)
  if (!profile) { await minDelay; return { success: true } }

  const otp = generateOTP()
  const otpHash = await bcrypt.hash(otp, 10)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await admin.from('invitation_tokens').insert({
    user_id: profile.id,
    otp_hash: otpHash,
    expires_at: expiresAt,
  })

  await sendResetPasswordEmail({ email, prenom: profile.prenom, otpCode: otp })
  await minDelay // garantit un temps de réponse constant
  return { success: true }
}

// --- Réinitialisation du mot de passe ---
export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string
  const otp = formData.get('otp') as string
  const password = formData.get('password') as string

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()
  if (!profile) return { error: 'Email introuvable' }

  const { data: token } = await admin
    .from('invitation_tokens')
    .select('id, otp_hash, expires_at, used_at')
    .eq('user_id', profile.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!token) return { error: 'Code invalide ou expiré' }
  if (new Date(token.expires_at) < new Date()) return { error: 'Code expiré (10 min)' }

  const isValid = await bcrypt.compare(otp, token.otp_hash)
  if (!isValid) return { error: 'Code incorrect' }

  await admin.auth.admin.updateUserById(profile.id, { password })
  await admin.from('invitation_tokens').update({ used_at: new Date().toISOString() }).eq('id', token.id)

  redirect('/login?reset=success')
}
```

- [ ] **Step 3 : Installer bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 4 : Commit**

```bash
git add lib/ emails/
git commit -m "feat: add auth server actions and email helpers"
```

---

## Chunk 3 : Templates d'emails + Pages d'authentification

### Task 5 : Templates d'emails React (Resend)

**Files:**
- Create: `emails/InvitationEmail.tsx`
- Create: `emails/ResetPasswordEmail.tsx`
- Create: `emails/WelcomeEmail.tsx`

- [ ] **Step 1 : Créer `emails/InvitationEmail.tsx`**

```tsx
import { Html, Head, Body, Container, Heading, Text, Button, Section, Hr } from '@react-email/components'

interface Props {
  prenom: string
  otpCode: string
  activationUrl: string
}

export default function InvitationEmail({ prenom, otpCode, activationUrl }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f5f6fa' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 10, padding: 32 }}>
          <Heading style={{ color: '#1a2332', fontSize: 22, marginBottom: 8 }}>
            Bienvenue, {prenom} 👋
          </Heading>
          <Text style={{ color: '#374151' }}>
            Votre compte a été créé sur le portail RH de la Centrale Générale FGTB Namur-Luxembourg.
          </Text>
          <Text style={{ color: '#374151' }}>
            Pour activer votre compte, rendez-vous sur la page d'activation et saisissez le code suivant :
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Text style={{ fontSize: 36, fontWeight: 900, letterSpacing: 12, color: '#e53e3e', background: '#fef2f2', padding: '16px 32px', borderRadius: 8, display: 'inline-block' }}>
              {otpCode}
            </Text>
          </Section>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            Ce code est valable <strong>48 heures</strong>.
          </Text>
          <Button href={activationUrl} style={{ background: '#e53e3e', color: '#fff', padding: '12px 24px', borderRadius: 6, fontWeight: 700, display: 'inline-block', marginTop: 16 }}>
            Activer mon compte
          </Button>
          <Hr style={{ margin: '24px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>
            Si vous n'attendiez pas cet email, vous pouvez l'ignorer.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2 : Créer `emails/ResetPasswordEmail.tsx`**

```tsx
import { Html, Head, Body, Container, Heading, Text, Section, Hr } from '@react-email/components'

interface Props { prenom: string; otpCode: string }

export default function ResetPasswordEmail({ prenom, otpCode }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f5f6fa' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 10, padding: 32 }}>
          <Heading style={{ color: '#1a2332', fontSize: 20 }}>
            Réinitialisation de mot de passe
          </Heading>
          <Text style={{ color: '#374151' }}>
            Bonjour {prenom}, voici votre code de réinitialisation :
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Text style={{ fontSize: 36, fontWeight: 900, letterSpacing: 12, color: '#e53e3e', background: '#fef2f2', padding: '16px 32px', borderRadius: 8, display: 'inline-block' }}>
              {otpCode}
            </Text>
          </Section>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            Ce code expire dans <strong>10 minutes</strong>.
          </Text>
          <Hr style={{ margin: '24px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 3 : Créer `emails/WelcomeEmail.tsx`**

```tsx
import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components'

interface Props { prenom: string; appUrl: string }

export default function WelcomeEmail({ prenom, appUrl }: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f5f6fa' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 10, padding: 32 }}>
          <Heading style={{ color: '#1a2332', fontSize: 22 }}>
            Compte activé, {prenom} ! 🎉
          </Heading>
          <Text style={{ color: '#374151' }}>
            Votre compte sur le portail RH est maintenant actif. Vous pouvez vous connecter à tout moment.
          </Text>
          <Button href={appUrl} style={{ background: '#e53e3e', color: '#fff', padding: '12px 24px', borderRadius: 6, fontWeight: 700, display: 'inline-block', marginTop: 16 }}>
            Accéder au portail
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4 : Installer react-email components**

```bash
npm install @react-email/components
```

- [ ] **Step 5 : Commit**

```bash
git add emails/
git commit -m "feat: add French email templates (invitation, reset, welcome)"
```

---

### Task 6 : Pages d'authentification

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/activation/page.tsx`
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/reset-password/page.tsx`
- Create: `components/auth/LoginForm.tsx`
- Create: `components/auth/ActivationForm.tsx`
- Create: `components/auth/ResetPasswordForm.tsx`

- [ ] **Step 1 : Créer `app/(auth)/login/page.tsx`**

```tsx
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-black text-[#e53e3e] mb-1">CG</div>
          <div className="text-sm font-semibold text-[#1a2332]">Portail RH</div>
          <div className="text-xs text-gray-400 mt-0.5">Centrale Générale FGTB Namur-Luxembourg</div>
        </div>
        {searchParams.reset === 'success' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Mot de passe réinitialisé. Connectez-vous.
          </div>
        )}
        {searchParams.error === 'compte_desactive' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Ce compte est désactivé. Contactez votre administrateur.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `components/auth/LoginForm.tsx`**

```tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-[#e53e3e] hover:bg-[#c53030]">
      {pending ? 'Connexion...' : 'Se connecter'}
    </Button>
  )
}

export default function LoginForm() {
  const [state, action] = useFormState(signIn, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Adresse email</Label>
        <Input id="email" name="email" type="email" required placeholder="marie.v@accg-nalux.be" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state?.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      <SubmitButton />
      <div className="text-center">
        <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600">
          Mot de passe oublié ?
        </Link>
      </div>
    </form>
  )
}
```

- [ ] **Step 3 : Créer les pages activation, forgot-password, reset-password**

`app/(auth)/activation/page.tsx` :

```tsx
import ActivationForm from '@/components/auth/ActivationForm'

export default function ActivationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-black text-[#e53e3e] mb-1">CG</div>
          <h1 className="text-sm font-semibold text-[#1a2332]">Activer mon compte</h1>
          <p className="text-xs text-gray-400 mt-1">Saisissez le code reçu par email</p>
        </div>
        <ActivationForm />
      </div>
    </div>
  )
}
```

`app/(auth)/forgot-password/page.tsx` et `app/(auth)/reset-password/page.tsx` : structure identique, pointer vers les Server Actions `forgotPassword` et `resetPassword`. Les formulaires dans `components/auth/ResetPasswordForm.tsx` avec 2 étapes (email → OTP + nouveau mot de passe).

- [ ] **Step 4 : Tester manuellement le flux de connexion**

```
1. Démarrer le serveur : npm run dev
2. Naviguer vers http://localhost:3000
3. Vérifier la redirection vers /login
4. Créer un utilisateur de test dans le dashboard Supabase
5. Tester la connexion → vérifier la redirection vers /
6. Tester avec un mauvais mot de passe → vérifier le message d'erreur
```

- [ ] **Step 5 : Commit**

```bash
git add app/(auth)/ components/auth/
git commit -m "feat: add auth pages (login, activation, forgot/reset password)"
```

---

## Chunk 4 : Layout + Dashboard

### Task 7 : Sidebar et layout principal

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1 : Créer `components/layout/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

const workerLinks = [
  { href: '/',         icon: '🏠', label: 'Accueil' },
  { href: '/pointage', icon: '⏱', label: 'Pointage' },
  { href: '/conges',   icon: '🌴', label: 'Congés' },
  { href: '/calendrier', icon: '📅', label: 'Calendrier' },
  { href: '/documents', icon: '📄', label: 'Documents' },
]

const adminLinks = [
  { href: '/',                      icon: '🏠', label: 'Accueil' },
  { href: '/admin/travailleurs',    icon: '👥', label: 'Travailleurs' },
  { href: '/pointage',              icon: '⏱', label: 'Pointage' },
  { href: '/conges',                icon: '🌴', label: 'Congés' },
  { href: '/calendrier',            icon: '📅', label: 'Calendrier' },
  { href: '/admin/recap',           icon: '📊', label: 'Rapports' },
]

interface Props {
  isAdmin: boolean
  initiales: string
  displayName: string
}

export default function Sidebar({ isAdmin, initiales, displayName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const pathname = usePathname()
  const links = isAdmin ? adminLinks : workerLinks

  return (
    <nav
      className={cn(
        'flex flex-col bg-[#1a2332] transition-all duration-200 flex-shrink-0',
        expanded ? 'w-44' : 'w-[52px]'
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="text-[#e53e3e] text-base font-black text-center py-3 border-b border-white/10 flex-shrink-0">
        {expanded ? 'ACCG' : 'CG'}
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-1 p-2 flex-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-all',
                active
                  ? 'bg-[#e53e3e]/15 text-[#fc8181]'
                  : 'text-white/35 hover:bg-white/8 hover:text-white'
              )}
            >
              <span className="text-base flex-shrink-0">{link.icon}</span>
              {expanded && <span className="font-semibold whitespace-nowrap">{link.label}</span>}
            </Link>
          )
        })}
      </div>

      {/* Profil + déconnexion */}
      <div className="p-2 border-t border-white/10 space-y-1">
        <Link
          href="/profil"
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/8"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center text-white text-xs font-black flex-shrink-0">
            {initiales}
          </div>
          {expanded && <span className="text-white/70 text-xs truncate">{displayName}</span>}
        </Link>
        {expanded && (
          <form action={signOut}>
            <button type="submit" className="w-full text-left text-xs text-white/30 hover:text-white/60 px-2 py-1">
              Déconnexion
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('prenom, nom, is_admin_rh')
    .eq('id', user.id)
    .single()

  const initiales = profile
    ? `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()
    : '??'
  const displayName = profile ? `${profile.prenom} ${profile.nom}` : ''

  return (
    <div className="flex h-screen bg-[#f0f2f8] overflow-hidden">
      <Sidebar
        isAdmin={profile?.is_admin_rh ?? false}
        initiales={initiales}
        displayName={displayName}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3 : Créer `app/(dashboard)/page.tsx`** (placeholder — sera complété par Module 2)

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('prenom, is_admin_rh')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-[#1a2332]">
        Bonjour, {profile?.prenom} 👋
      </h1>
      <p className="text-sm text-gray-400 mt-1">
        {profile?.is_admin_rh ? 'Admin RH — Vue d'ensemble' : 'Votre portail personnel'}
      </p>
      <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200 text-sm text-gray-500">
        Les modules Pointage, Congés et Calendrier seront disponibles prochainement.
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Tester le layout**

```
1. npm run dev
2. Connexion → vérifier la sidebar
3. Survoler la sidebar → vérifier l'expansion avec labels
4. Cliquer sur "Mon profil" → redirection vers /profil (404 pour l'instant, normal)
```

- [ ] **Step 5 : Commit**

```bash
git add components/layout/ app/(dashboard)/layout.tsx app/(dashboard)/page.tsx
git commit -m "feat: add sidebar and dashboard layout"
```

---

## Chunk 5 : Page Profil

### Task 8 : Profil employé (vue travailleur)

**Files:**
- Create: `app/(dashboard)/profil/page.tsx`
- Create: `components/profile/ProfileHeader.tsx`
- Create: `components/profile/CoordonneesSection.tsx`
- Create: `components/profile/DonneesRHSection.tsx`
- Create: `components/profile/AffectationSection.tsx`
- Create: `lib/auth/profile-actions.ts`

- [ ] **Step 1 : Créer `lib/auth/profile-actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateCoordonneesAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const updates: Record<string, string | null> = {
    prenom:          formData.get('prenom') as string,
    nom:             formData.get('nom') as string,
    telephone:       formData.get('telephone') as string || null,
    contact_urgence: formData.get('contact_urgence') as string || null,
    rue:             formData.get('rue') as string || null,
    numero:          formData.get('numero') as string || null,
    boite:           formData.get('boite') as string || null,
    code_postal:     formData.get('code_postal') as string || null,
    commune:         formData.get('commune') as string || null,
    pays:            formData.get('pays') as string || 'Belgique',
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Changement de mot de passe (optionnel — serveur valide les deux champs)
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string
  if (newPassword) {
    if (newPassword.length < 8) return { error: 'Le mot de passe doit comporter au moins 8 caractères' }
    if (newPassword !== confirmPassword) return { error: 'Les mots de passe ne correspondent pas' }
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
    if (pwError) return { error: pwError.message }
  }

  revalidatePath('/profil')
  return { success: true }
}
```

- [ ] **Step 2 : Créer `components/profile/ProfileHeader.tsx`**

```tsx
import { Profile, Service } from '@/types/database'
import { Badge } from '@/components/ui/badge'

function calcAnciennete(dateEntree: string | null): string {
  if (!dateEntree) return '—'
  const diff = Date.now() - new Date(dateEntree).getTime()
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  const months = Math.floor((diff % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000))
  if (years === 0) return `${months} mois`
  return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`
}

export default function ProfileHeader({
  profile,
  service,
}: {
  profile: Profile
  service: Service | null
}) {
  const initiales = `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase()

  return (
    <div className="mx-4 mt-4 bg-gradient-to-r from-[#1a2332] to-[#2d3748] rounded-xl p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center text-white text-xl font-black flex-shrink-0 border-2 border-white/20">
        {initiales}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white font-bold text-base">
          {profile.prenom} {profile.nom}
        </div>
        <div className="text-white/60 text-xs mt-0.5">{profile.email}</div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {service && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {service.nom}
            </span>
          )}
          {profile.option_horaire && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-300 border border-green-500/30">
              Option {profile.option_horaire} · {profile.option_horaire === 'A' ? '36,5h' : '34h'}
            </span>
          )}
          {profile.is_admin_rh && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              ★ Admin RH
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-white/40 text-[9px]">Ancienneté</div>
        <div className="text-[#fc8181] text-2xl font-black leading-tight">
          {calcAnciennete(profile.date_entree)}
        </div>
        {profile.date_entree && (
          <div className="text-white/40 text-[9px]">
            depuis {new Date(profile.date_entree).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Créer `components/profile/DonneesRHSection.tsx`**

```tsx
import { Profile, Service } from '@/types/database'

export default function DonneesRHSection({ profile, service }: { profile: Profile; service: Service | null }) {
  const fields = [
    { label: 'Service', value: service?.nom ?? '—' },
    { label: 'Type de contrat', value: profile.type_contrat ?? '—' },
    { label: "Date d'entrée", value: profile.date_entree ? new Date(profile.date_entree).toLocaleDateString('fr-BE') : '—' },
    { label: 'Option horaire', value: profile.option_horaire ? `Option ${profile.option_horaire} (${profile.option_horaire === 'A' ? '36,5h/sem' : '34h/sem'})` : '—' },
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">🏢 Données RH</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">🔒 Admin uniquement</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
            <div className="text-xs font-medium text-[#1a2332] mt-0.5">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Créer `components/profile/AffectationSection.tsx`**

```tsx
import { UserBureauSchedule } from '@/types/database'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export default function AffectationSection({ schedules }: { schedules: UserBureauSchedule[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">📍 Affectation par bureau</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">🔒 Admin uniquement</span>
      </div>
      <div className="p-4 overflow-x-auto">
        {schedules.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Sur la route (aucune affectation fixe)</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-gray-400 font-semibold pb-2 text-[9px] uppercase">Jour</th>
                {JOURS.map((j) => (
                  <th key={j} className="text-center text-gray-400 font-semibold pb-2 text-[9px] uppercase">{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-gray-400 font-semibold text-[9px]">Bureau</td>
                {[1,2,3,4,5].map((day) => {
                  const s = schedules.find((sch) => sch.jour === day)
                  return (
                    <td key={day} className="text-center">
                      {s ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[10px]">
                          {s.bureau?.nom ?? '—'}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : Créer `components/profile/CoordonneesSection.tsx`**

Ce composant est un formulaire Client Component avec les champs modifiables.

```tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateCoordonneesAction } from '@/lib/auth/profile-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Profile } from '@/types/database'

function SaveBar({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus()
  return (
    <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-4 py-3 flex items-center justify-between">
      <span className="text-[10px] text-gray-400">Les champs surlignés sont modifiables par vous</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={pending} size="sm" className="bg-[#e53e3e] hover:bg-[#c53030]">
          {pending ? 'Enregistrement...' : '💾 Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

function Field({ name, label, defaultValue, type = 'text', placeholder }: {
  name: string; label: string; defaultValue?: string | null; type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</Label>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="border-[#a7f3d0] bg-[#f0fff4] text-xs h-8"
      />
    </div>
  )
}

export default function CoordonneesSection({ profile }: { profile: Profile }) {
  const [state, action] = useFormState(updateCoordonneesAction, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-[#1a2332]">✏️ Mes coordonnées</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Modifiable</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field name="prenom" label="Prénom" defaultValue={profile.prenom} />
          <Field name="nom" label="Nom" defaultValue={profile.nom} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="telephone" label="Téléphone" defaultValue={profile.telephone} placeholder="+32 498 00 00 00" />
          <Field name="contact_urgence" label="Contact d'urgence" defaultValue={profile.contact_urgence} />
        </div>

        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-1">Adresse de domicile</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <Field name="rue" label="Rue / Avenue" defaultValue={profile.rue} />
          </div>
          <Field name="numero" label="N°" defaultValue={profile.numero} />
          <Field name="boite" label="Boîte" defaultValue={profile.boite} placeholder="Optionnel" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field name="code_postal" label="Code postal" defaultValue={profile.code_postal} />
          <div className="col-span-2">
            <Field name="commune" label="Commune" defaultValue={profile.commune} />
          </div>
        </div>
        <Field name="pays" label="Pays" defaultValue={profile.pays ?? 'Belgique'} />

        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-1">Sécurité du compte</div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="new_password" label="Nouveau mot de passe" type="password" placeholder="Laisser vide pour ne pas changer" />
          <Field name="confirm_password" label="Confirmer le mot de passe" type="password" placeholder="••••••••" />
        </div>

        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.success && <p className="text-xs text-green-600">Coordonnées enregistrées.</p>}
      </div>

      <SaveBar onCancel={() => {}} />
    </form>
  )
}
```

- [ ] **Step 6 : Créer `app/(dashboard)/profil/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import CoordonneesSection from '@/components/profile/CoordonneesSection'
import DonneesRHSection from '@/components/profile/DonneesRHSection'
import AffectationSection from '@/components/profile/AffectationSection'

export default async function ProfilPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, service:services(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('*, bureau:bureaux(*)')
    .eq('user_id', user.id)
    .order('jour')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <span className="text-xs text-gray-400 cursor-pointer">← Accueil</span>
        <span className="text-sm font-bold text-[#1a2332] ml-2">👤 Mon profil</span>
        <span className="ml-auto text-xs text-gray-400">
          Dernière modif. : {new Date(profile.updated_at).toLocaleDateString('fr-BE')}
        </span>
      </div>

      <ProfileHeader profile={profile} service={profile.service} />

      <div className="p-4 space-y-4">
        <CoordonneesSection profile={profile} />
        <DonneesRHSection profile={profile} service={profile.service} />
        <AffectationSection schedules={schedules ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7 : Tester la page profil**

```
1. Connexion → naviguer vers /profil
2. Vérifier l'affichage des 3 sections
3. Modifier un champ (ex: téléphone) → Enregistrer → vérifier la mise à jour
4. Tester un changement de mot de passe
```

- [ ] **Step 8 : Commit**

```bash
git add app/(dashboard)/profil/ components/profile/ lib/auth/profile-actions.ts
git commit -m "feat: add employee profile page with editable coordinates"
```

---

## Chunk 6 : Administration des travailleurs

### Task 9 : Liste des travailleurs

**Files:**
- Create: `app/(dashboard)/admin/travailleurs/page.tsx`
- Create: `components/admin/TravailleursTable.tsx`
- Create: `components/admin/TravailleurForm.tsx`
- Create: `lib/auth/admin-actions.ts`

- [ ] **Step 1 : Créer `lib/auth/admin-actions.ts`**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { inviteWorker } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Vérification que le caller est admin_rh
async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single()
  if (!profile?.is_admin_rh) redirect('/')
  return user
}

export async function createTravailleurAction(formData: FormData) {
  await assertAdmin()
  const result = await inviteWorker({
    prenom:         formData.get('prenom') as string,
    nom:            formData.get('nom') as string,
    email:          formData.get('email') as string,
    service_id:     formData.get('service_id') as string,
    option_horaire: formData.get('option_horaire') as 'A' | 'B',
    type_contrat:   formData.get('type_contrat') as string,
    date_entree:    formData.get('date_entree') as string,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/admin/travailleurs')
  return { success: true }
}

export async function deactivateTravailleurAction(userId: string) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ is_active: false }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  return { success: true }
}

export async function updateAdminRhAction(userId: string, isAdmin: boolean) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ is_admin_rh: isAdmin }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}

export async function updateTravailleurAction(userId: string, formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({
    prenom:         formData.get('prenom') as string,
    nom:            formData.get('nom') as string,
    email:          formData.get('email') as string,
    service_id:     formData.get('service_id') as string,
    option_horaire: formData.get('option_horaire') as 'A' | 'B',
    type_contrat:   formData.get('type_contrat') as string,
    date_entree:    formData.get('date_entree') as string,
    telephone:      formData.get('telephone') as string || null,
    rue:            formData.get('rue') as string || null,
    numero:         formData.get('numero') as string || null,
    boite:          formData.get('boite') as string || null,
    code_postal:    formData.get('code_postal') as string || null,
    commune:        formData.get('commune') as string || null,
    pays:           formData.get('pays') as string || 'Belgique',
  }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/travailleurs')
  revalidatePath(`/admin/travailleurs/${userId}`)
  return { success: true }
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/admin/travailleurs/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TravailleursTable from '@/components/admin/TravailleursTable'

export default async function TravailleursPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single()
  if (!profile?.is_admin_rh) redirect('/')

  const { data: travailleurs } = await supabase
    .from('profiles')
    .select('*, service:services(*), schedules:user_bureau_schedule(*, bureau:bureaux(*))')
    .order('nom')

  const { data: services } = await supabase.from('services').select('*').order('nom')

  return (
    <TravailleursTable
      travailleurs={travailleurs ?? []}
      services={services ?? []}
    />
  )
}
```

- [ ] **Step 3 : Créer `components/admin/TravailleursTable.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Profile, Service } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { deactivateTravailleurAction } from '@/lib/auth/admin-actions'
import TravailleurForm from './TravailleurForm'

interface Props {
  travailleurs: (Profile & { service?: Service })[]
  services: Service[]
}

const SERVICE_COLORS: Record<string, string> = {
  svc_admin: 'bg-green-50 text-green-700 border-green-200',
  juridique: 'bg-purple-50 text-purple-700 border-purple-200',
  compta_rh: 'bg-blue-50 text-blue-700 border-blue-200',
  permanent: 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function TravailleursTable({ travailleurs, services }: Props) {
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    return travailleurs.filter((t) => {
      const matchSearch = !search ||
        `${t.prenom} ${t.nom}`.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase())
      const matchService = !serviceFilter || t.service?.code === serviceFilter
      return matchSearch && matchService
    })
  }, [travailleurs, search, serviceFilter])

  const stats = useMemo(() => ({
    actifs: travailleurs.filter((t) => t.is_active).length,
    inactifs: travailleurs.filter((t) => !t.is_active).length,
    optA: travailleurs.filter((t) => t.option_horaire === 'A').length,
    optB: travailleurs.filter((t) => t.option_horaire === 'B').length,
  }), [travailleurs])

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setLoading(true)
    await deactivateTravailleurAction(deactivateTarget.id)
    setLoading(false)
    setDeactivateTarget(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div>
          <div className="text-sm font-bold text-[#1a2332]">👥 Gestion des travailleurs</div>
          <div className="text-[10px] text-gray-400">Centrale Générale FGTB Namur-Luxembourg</div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm">📤 Export</Button>
          <Button size="sm" className="bg-[#e53e3e] hover:bg-[#c53030]" onClick={() => setShowCreate(true)}>
            ＋ Nouveau travailleur
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 items-center">
        <Input
          placeholder="Rechercher par nom, service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs h-8 max-w-xs"
        />
        <button
          onClick={() => setServiceFilter(null)}
          className={`text-[10px] px-3 py-1 rounded-full border font-semibold transition ${!serviceFilter ? 'bg-red-50 border-red-200 text-[#e53e3e]' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
        >
          Tous ({travailleurs.length})
        </button>
        {services.map((s) => (
          <button
            key={s.code}
            onClick={() => setServiceFilter(serviceFilter === s.code ? null : s.code)}
            className={`text-[10px] px-3 py-1 rounded-full border font-semibold transition ${serviceFilter === s.code ? 'bg-red-50 border-red-200 text-[#e53e3e]' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
          >
            {s.nom} ({travailleurs.filter((t) => t.service?.code === s.code).length})
          </button>
        ))}
      </div>

      {/* Stats pills */}
      <div className="flex gap-2 px-4 py-2 bg-[#f0f2f8]">
        {[
          { label: 'Actifs', value: stats.actifs, color: 'bg-green-500' },
          { label: 'Inactifs', value: stats.inactifs, color: 'bg-gray-400' },
          { label: 'Option A', value: stats.optA, color: null },
          { label: 'Option B', value: stats.optB, color: null },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            {color && <div className={`w-2 h-2 rounded-full ${color}`} />}
            <span className="text-base font-black text-[#1a2332]">{value}</span>
            <span className="text-[9px] text-gray-400 font-semibold">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <table className="w-full text-xs bg-white rounded-xl border border-gray-200 overflow-hidden">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Travailleur', 'Service', 'Bureau(x)', 'Option', 'Rôle', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const initiales = `${t.prenom[0]}${t.nom[0]}`.toUpperCase()
              return (
                <tr key={t.id} className={`border-t border-gray-50 hover:bg-gray-50 cursor-pointer ${!t.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#e53e3e] to-[#9b2c2c] flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                        {initiales}
                      </div>
                      <div>
                        <div className="font-bold text-[#1a2332]">{t.prenom} {t.nom}</div>
                        <div className="text-[9px] text-gray-400">{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.service && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${SERVICE_COLORS[t.service.code] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.service.nom}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-600">—</td>
                  <td className="px-3 py-2">
                    {t.option_horaire && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${t.option_horaire === 'A' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {t.option_horaire}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-400">
                    {t.is_admin_rh ? <span className="text-yellow-700 font-bold">★ Admin RH</span> : 'Worker'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold ${t.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {t.is_active ? '● Actif' : '○ Inactif'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link href={`/admin/travailleurs/${t.id}`}>
                        <button className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs hover:bg-blue-100">✏️</button>
                      </Link>
                      {t.is_active && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeactivateTarget(t) }}
                          className="w-6 h-6 rounded bg-red-50 text-[#e53e3e] flex items-center justify-center text-xs hover:bg-red-100"
                        >🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="text-[10px] text-gray-400 mt-2">
          {filtered.length} affiché{filtered.length > 1 ? 's' : ''} sur {travailleurs.length} · Cliquer sur ✏️ pour ouvrir la fiche complète
        </div>
      </div>

      {/* Dialog création */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau travailleur</DialogTitle>
          </DialogHeader>
          <TravailleurForm services={services} onSuccess={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation désactivation */}
      <Dialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Désactiver le compte ?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            Le compte de <strong>{deactivateTarget?.prenom} {deactivateTarget?.nom}</strong> sera désactivé.
            L'historique sera conservé. Cette action est réversible par un admin.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeactivateTarget(null)}>Annuler</Button>
            <Button size="sm" className="bg-[#e53e3e] hover:bg-[#c53030]" disabled={loading} onClick={handleDeactivate}>
              {loading ? 'En cours...' : 'Désactiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3b : Créer `components/admin/TravailleurForm.tsx`**

```tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTravailleurAction } from '@/lib/auth/admin-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Service } from '@/types/database'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="bg-[#e53e3e] hover:bg-[#c53030] w-full">
      {pending ? 'Envoi de l\'invitation...' : '📧 Créer et inviter'}
    </Button>
  )
}

export default function TravailleurForm({ services, onSuccess }: { services: Service[]; onSuccess: () => void }) {
  const [state, action] = useFormState(async (prev: unknown, formData: FormData) => {
    const result = await createTravailleurAction(formData)
    if (result.success) onSuccess()
    return result
  }, null)

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Prénom</Label>
          <Input name="prenom" required className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Nom</Label>
          <Input name="nom" required className="h-8 text-xs" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[9px] uppercase font-bold text-gray-400">Email</Label>
        <Input name="email" type="email" required className="h-8 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Service</Label>
          <select name="service_id" required className="w-full h-8 text-xs border border-gray-200 rounded-md px-2">
            {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Option horaire</Label>
          <select name="option_horaire" required className="w-full h-8 text-xs border border-gray-200 rounded-md px-2">
            <option value="A">Option A (36,5h)</option>
            <option value="B">Option B (34h)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Type de contrat</Label>
          <Input name="type_contrat" placeholder="CDI — temps plein" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase font-bold text-gray-400">Date d'entrée</Label>
          <Input name="date_entree" type="date" className="h-8 text-xs" />
        </div>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
```

- [ ] **Step 4 : Créer `app/(dashboard)/admin/travailleurs/[id]/page.tsx`** — Fiche admin

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import CoordonneesSection from '@/components/profile/CoordonneesSection'
import DonneesRHSection from '@/components/profile/DonneesRHSection'
import AffectationSection from '@/components/profile/AffectationSection'
// Note: CoordonneesSection et DonneesRHSection devront accepter un prop `isAdmin`
// pour déverrouiller les champs RH dans la vue admin

export default async function TravailleurFichePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: admin } = await supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single()
  if (!admin?.is_admin_rh) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, service:services(*)')
    .eq('id', params.id)
    .single()
  if (!profile) redirect('/admin/travailleurs')

  const { data: schedules } = await supabase
    .from('user_bureau_schedule')
    .select('*, bureau:bureaux(*)')
    .eq('user_id', params.id)
    .order('jour')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
        <a href="/admin/travailleurs" className="text-xs text-gray-400">← Travailleurs</a>
        <span className="text-sm font-bold text-[#1a2332] ml-2">
          👤 {profile.prenom} {profile.nom}
        </span>
        <span className="ml-2 text-[9px] px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
          ✏️ Mode Admin
        </span>
      </div>
      <ProfileHeader profile={profile} service={profile.service} />
      <div className="p-4 space-y-4">
        {/* En mode admin, toutes les sections sont modifiables — à implémenter avec isAdmin prop */}
        <CoordonneesSection profile={profile} />
        <DonneesRHSection profile={profile} service={profile.service} />
        <AffectationSection schedules={schedules ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : Commit**

```bash
git add app/(dashboard)/admin/travailleurs/ components/admin/TravailleursTable.tsx lib/auth/admin-actions.ts
git commit -m "feat: add admin workers list and profile edit page"
```

---

## Chunk 7 : Tableau récapitulatif mensuel

### Task 10 : Page récap mensuel

**Files:**
- Create: `app/(dashboard)/admin/recap/page.tsx`
- Create: `components/admin/RecapMensuel.tsx`
- Create: `components/admin/PointageManquantModal.tsx`

Note : À ce stade du Module 1, le tableau récap affiche uniquement des statuts de base (P/W/—). Les statuts réels (C, M, R, ?) seront alimentés par les modules Pointage (2) et Congés (4). Ce qui est implémenté ici : la structure visuelle, la navigation de mois, les filtres, la modal de correction manuelle et la logique d'update de statut.

- [ ] **Step 1 : Créer `components/admin/PointageManquantModal.tsx`**

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { DayStatus } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  travailleur: string
  date: string
  onConfirm: (status: DayStatus, times?: { arrivee: string; midiOut: string; midiIn: string; depart: string }) => void
}

export default function PointageManquantModal({ open, onClose, travailleur, date, onConfirm }: Props) {
  const [mode, setMode] = useState<'choose' | 'correction'>('choose')
  const [times, setTimes] = useState({ arrivee: '08:30', midiOut: '12:00', midiIn: '13:00', depart: '16:30' })

  const handleClose = () => { setMode('choose'); onClose() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">⚠️ Pointage manquant — {travailleur}</DialogTitle>
          <p className="text-xs text-gray-500">{date} · Aucun pointage enregistré</p>
        </DialogHeader>

        {mode === 'choose' ? (
          <div className="space-y-2 mt-2">
            <button
              onClick={() => onConfirm('A')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition"
            >
              <div className="text-xs font-bold text-[#1a2332]">🚫 Absent (non justifié)</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Marquer comme absence — déduire du solde</div>
            </button>
            <button
              onClick={() => onConfirm('C')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition"
            >
              <div className="text-xs font-bold text-[#1a2332]">🌴 Congé / Maladie / Autre</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Sélectionner un type d'absence justifiée</div>
            </button>
            <button
              onClick={() => setMode('correction')}
              className="w-full text-left p-3 border border-[#a7f3d0] rounded-lg bg-[#f0fff4] hover:border-green-400 transition"
            >
              <div className="text-xs font-bold text-green-800">✏️ Oubli de pointage — Correction manuelle</div>
              <div className="text-[10px] text-green-600 mt-0.5">Le travailleur était présent mais a oublié de pointer</div>
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 mb-3">Saisir les heures manuellement :</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'arrivee', label: 'Arrivée' },
                { key: 'midiOut', label: 'Midi out' },
                { key: 'midiIn', label: 'Midi in' },
                { key: 'depart', label: 'Départ' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Input
                    type="time"
                    value={times[key as keyof typeof times]}
                    onChange={(e) => setTimes((t) => ({ ...t, [key]: e.target.value }))}
                    className="border-[#a7f3d0] bg-[#f0fff4] text-center text-xs h-8 p-1"
                  />
                  <div className="text-[9px] text-gray-400 text-center font-semibold">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => setMode('choose')}>Retour</Button>
              <Button size="sm" className="bg-[#e53e3e] hover:bg-[#c53030]" onClick={() => onConfirm('P', times)}>
                Confirmer la correction
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2 : Créer `app/(dashboard)/admin/recap/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RecapMensuel from '@/components/admin/RecapMensuel'

export default async function RecapPage({
  searchParams,
}: {
  searchParams: { mois?: string; annee?: string; service?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: admin } = await supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single()
  if (!admin?.is_admin_rh) redirect('/')

  const now = new Date()
  const mois = parseInt(searchParams.mois ?? String(now.getMonth() + 1))
  const annee = parseInt(searchParams.annee ?? String(now.getFullYear()))

  const { data: travailleurs } = await supabase
    .from('profiles')
    .select('id, prenom, nom, service:services(nom, code), option_horaire, is_active')
    .eq('is_active', true)
    .order('nom')

  const { data: services } = await supabase.from('services').select('*').order('nom')

  return (
    <RecapMensuel
      travailleurs={travailleurs ?? []}
      services={services ?? []}
      mois={mois}
      annee={annee}
      serviceFilter={searchParams.service}
    />
  )
}
```

- [ ] **Step 3 : Créer `components/admin/RecapMensuel.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DayStatus } from '@/types/database'
import PointageManquantModal from './PointageManquantModal'

type WorkerRow = {
  id: string
  prenom: string
  nom: string
  service: { nom: string; code: string } | null
  option_horaire: 'A' | 'B' | null
}

interface Props {
  travailleurs: WorkerRow[]
  services: { id: string; nom: string; code: string }[]
  mois: number
  annee: number
  serviceFilter?: string
}

const STATUS_STYLES: Record<DayStatus, string> = {
  P: 'bg-[#10b981] text-white',
  C: 'bg-[#f59e0b] text-white',
  M: 'bg-[#ef4444] text-white',
  R: 'bg-[#6c63ff] text-white',
  F: 'bg-[#6b7280] text-white',
  A: 'bg-[#f97316] text-white',
  '?': 'bg-red-50 border border-dashed border-red-300 text-[#e53e3e]',
  W: 'bg-[#e8eaf0] text-transparent',
  '-': 'bg-white border border-dashed border-gray-200 text-gray-300',
}

const JOURS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function RecapMensuel({ travailleurs, services, mois, annee, serviceFilter }: Props) {
  const router = useRouter()
  const today = new Date()

  // Calcul des jours du mois
  const daysInMonth = new Date(annee, mois, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(annee, mois - 1, i + 1)
    return { num: i + 1, dow: d.getDay() } // 0=dim, 6=sam
  })

  // Statuts initiaux — tous à '-' (à remplir par Modules 2 et 4)
  // Structure: { [userId]: { [day]: DayStatus } }
  const [statuses, setStatuses] = useState<Record<string, Record<number, DayStatus>>>(() => {
    const init: Record<string, Record<number, DayStatus>> = {}
    travailleurs.forEach((t) => {
      init[t.id] = {}
      days.forEach(({ num, dow }) => {
        const isWeekend = dow === 0 || dow === 6
        const isFuture = new Date(annee, mois - 1, num) > today
        if (isWeekend) init[t.id][num] = 'W'
        else if (isFuture) init[t.id][num] = '-'
        else init[t.id][num] = '-' // sera 'P' ou '?' une fois Module 2 branché
      })
    })
    return init
  })

  const [modal, setModal] = useState<{ userId: string; day: number } | null>(null)

  const filteredWorkers = serviceFilter
    ? travailleurs.filter((t) => t.service?.code === serviceFilter)
    : travailleurs

  function handleCellClick(userId: string, day: number, status: DayStatus) {
    if (status === 'W' || status === '-') return
    if (status === '?') { setModal({ userId, day }); return }
    // Pour les autres statuts : cycle simple (sera remplacé par un dropdown en Module 4)
    const cycle: DayStatus[] = ['P', 'C', 'M', 'R', 'A', 'F']
    const idx = cycle.indexOf(status)
    const next = cycle[(idx + 1) % cycle.length]
    setStatuses((prev) => ({ ...prev, [userId]: { ...prev[userId], [day]: next } }))
  }

  function handleModalConfirm(status: DayStatus) {
    if (!modal) return
    setStatuses((prev) => ({ ...prev, [modal.userId]: { ...prev[modal.userId], [modal.day]: status } }))
    setModal(null)
  }

  function navMonth(delta: number) {
    let m = mois + delta
    let a = annee
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    router.push(`/admin/recap?mois=${m}&annee=${a}${serviceFilter ? `&service=${serviceFilter}` : ''}`)
  }

  const modalWorker = modal ? filteredWorkers.find((t) => t.id === modal.userId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navMonth(-1)} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold">‹</button>
          <span className="text-sm font-bold text-[#1a2332]">📊 {MOIS_FR[mois - 1]} {annee}</span>
          <button onClick={() => navMonth(1)} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold">›</button>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => router.push(`/admin/recap?mois=${mois}&annee=${annee}`)}
            className={`text-[10px] px-3 py-1 rounded-full border font-semibold ${!serviceFilter ? 'bg-red-50 border-red-200 text-[#e53e3e]' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
          >
            Tous les services
          </button>
          {services.map((s) => (
            <button
              key={s.code}
              onClick={() => router.push(`/admin/recap?mois=${mois}&annee=${annee}&service=${s.code}`)}
              className={`text-[10px] px-3 py-1 rounded-full border font-semibold ${serviceFilter === s.code ? 'bg-red-50 border-red-200 text-[#e53e3e]' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
            >
              {s.nom}
            </button>
          ))}
        </div>
        <button className="ml-auto text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-semibold">
          📤 Export Excel
        </button>
      </div>

      {/* Légende */}
      <div className="flex gap-4 px-4 py-1.5 bg-white border-b border-gray-100 text-[9px]">
        {([['P','Présent'],['C','Congé'],['M','Maladie'],['R','Repos comp.'],['F','Férié'],['A','Absent'],['?','Pointage manquant']] as [DayStatus, string][]).map(([code, label]) => (
          <div key={code} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold ${STATUS_STYLES[code]}`}>{code}</div>
            <span className="text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <table className="border-collapse bg-white rounded-xl border border-gray-200" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-[#1a2332] text-white text-left px-3 py-2 text-[9px] font-bold min-w-[140px]">
                Travailleur
              </th>
              {days.map(({ num, dow }) => {
                const isWeekend = dow === 0 || dow === 6
                const isToday = annee === today.getFullYear() && mois === today.getMonth() + 1 && num === today.getDate()
                return (
                  <th
                    key={num}
                    className={`min-w-[28px] max-w-[28px] text-center py-2 text-[8px] font-bold border-r border-white/10 ${isToday ? 'bg-[#9b2c2c] text-white' : isWeekend ? 'bg-[#111827] text-white/40' : 'bg-[#1a2332] text-white/80'}`}
                  >
                    {num}<br /><span className="opacity-70">{JOURS_FR[dow]}</span>
                  </th>
                )
              })}
              <th className="bg-[#1a2332] text-white text-[9px] px-3 py-2 min-w-[56px]">Total P</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.map((t) => {
              const workerStatuses = statuses[t.id] ?? {}
              const totalP = Object.values(workerStatuses).filter((s) => s === 'P').length
              return (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-white border-r-2 border-gray-200 px-3 py-1.5">
                    <div className="text-[10px] font-bold text-[#1a2332]">{t.nom}, {t.prenom}</div>
                    <div className="text-[8px] text-gray-400">{t.service?.nom} · Opt.{t.option_horaire}</div>
                  </td>
                  {days.map(({ num }) => {
                    const status: DayStatus = workerStatuses[num] ?? '-'
                    const isToday = annee === today.getFullYear() && mois === today.getMonth() + 1 && num === today.getDate()
                    return (
                      <td
                        key={num}
                        onClick={() => handleCellClick(t.id, num, status)}
                        className={`p-0 border-r border-gray-50 ${isToday ? 'bg-red-50/30' : ''}`}
                      >
                        <div className="relative w-[28px] h-[38px] flex items-center justify-center cursor-pointer hover:brightness-90 transition-all">
                          <div className={`w-[22px] h-[22px] rounded flex items-center justify-center text-[9px] font-bold ${STATUS_STYLES[status]}`}>
                            {status !== 'W' && status !== '-' ? status : ''}
                          </div>
                          {status === '?' && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#e53e3e] rounded-full" />
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td className="text-center font-black text-[#10b981] text-sm px-3">{totalP}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="text-[10px] text-gray-400 mt-2">
          {filteredWorkers.length} travailleur{filteredWorkers.length > 1 ? 's' : ''} · Cliquer sur une cellule pour modifier
        </div>
      </div>

      {/* Modal pointage manquant */}
      {modal && modalWorker && (
        <PointageManquantModal
          open={!!modal}
          onClose={() => setModal(null)}
          travailleur={`${modalWorker.nom}, ${modalWorker.prenom}`}
          date={new Date(annee, mois - 1, modal.day).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4 : Commit**

```bash
git add app/(dashboard)/admin/recap/ components/admin/
git commit -m "feat: add monthly recap table with pointage correction modal"
```

---

## Chunk 8 : Finalisation et déploiement

### Task 11 : Tests manuels E2E et déploiement Vercel

- [ ] **Step 1 : Test du flux d'invitation complet**

```
1. Connexion en tant qu'admin
2. Aller dans /admin/travailleurs → cliquer "+ Nouveau travailleur"
3. Remplir le formulaire et valider
4. Vérifier que l'email d'invitation est reçu (vérifier dans Resend dashboard)
5. Ouvrir l'email → copier le code OTP
6. Aller sur /activation → saisir email + OTP → définir un mot de passe
7. Vérifier la redirection vers le dashboard worker
8. Vérifier que le worker voit bien sa sidebar Worker (pas Admin)
```

- [ ] **Step 2 : Test mot de passe oublié**

```
1. Aller sur /forgot-password → saisir l'email du worker créé
2. Vérifier réception du code (10 min)
3. Aller sur /reset-password → saisir email + code + nouveau mot de passe
4. Vérifier la redirection vers /login?reset=success
5. Se connecter avec le nouveau mot de passe
```

- [ ] **Step 3 : Test profil**

```
1. Connexion worker → /profil
2. Modifier le téléphone → Enregistrer → vérifier la mise à jour en base
3. Vérifier que la section "Données RH" est bien en lecture seule
4. Connexion admin → /admin/travailleurs/[id] → vérifier que toutes les sections sont modifiables
```

- [ ] **Step 4 : Test tableau récap**

```
1. Aller sur /admin/recap
2. Vérifier l'affichage du mois courant
3. Cliquer sur une cellule → vérifier l'interaction
4. Naviguer vers le mois précédent/suivant
5. Tester le filtre par service
```

- [ ] **Step 5 : Déploiement sur Vercel**

```bash
# Installer Vercel CLI si pas déjà fait
npm install -g vercel

# Déploiement
vercel

# Configurer les variables d'environnement dans le dashboard Vercel :
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# RESEND_API_KEY
# RESEND_FROM
# NEXT_PUBLIC_APP_URL (URL de production Vercel)
```

- [ ] **Step 6 : Configurer le domaine Resend**

```
1. Dashboard Resend → Domains → Add domain → "accg-nalux.be"
2. Ajouter les entrées DNS (MX, TXT, CNAME) chez votre hébergeur DNS
3. Valider le domaine dans Resend
4. Tester l'envoi d'email depuis l'app déployée
```

- [ ] **Step 7 : Commit final et tag**

```bash
git add .
git commit -m "feat: complete Module 1 — Auth & User Management"
git tag v1.0.0-module1
```

---

## Notes d'implémentation

**OTP et sécurité :**
- Le code OTP est haché avec bcrypt (salt 10) avant stockage — jamais en clair en base
- Délai artificiel de 300ms sur les vérifications OTP pour résister aux attaques timing
- Rate limiting à prévoir (Vercel Edge Middleware) si le projet monte en charge — hors périmètre M1

**Admin client Supabase :**
- `createAdminClient()` utilise `SUPABASE_SERVICE_ROLE_KEY` — contourner RLS, uniquement depuis des Server Actions
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client

**Tableau récap — statuts futurs :**
- Module 2 remplira les statuts P/? (présent, pointage manquant)
- Module 4 remplira C/M/R (congés, maladie, repos)
- La table `daily_status` sera créée en Module 2 ; pour l'instant `RecapMensuel` peut utiliser des données mock

**Telework :**
- `user_bureau_schedule` est prêt pour accueillir `is_telework: boolean` et `bureau_id: null`
- À activer en Module 6 sans migration destructive
