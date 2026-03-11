# Spec — Module 1 : Auth & Gestion des utilisateurs

**Date :** 2026-03-11
**Projet :** Gestion RH — Centrale Générale FGTB Namur-Luxembourg
**Stack :** Next.js 14 (App Router) · TypeScript · Supabase (Auth + PostgreSQL + Storage) · Resend · Tailwind CSS + shadcn/ui · Vercel
**Langue :** Français uniquement
**Appareils :** Desktop-first, responsive mobile

---

## 1. Périmètre du module

Ce module couvre :
- Création et activation de comptes utilisateurs (invitation admin → OTP → mot de passe)
- Connexion quotidienne (email + mot de passe)
- Réinitialisation de mot de passe (OTP par email)
- Gestion centralisée des travailleurs (liste admin, création, désactivation)
- Profil employé (coordonnées modifiables par le travailleur, données RH et affectation en lecture seule)
- Rôles et permissions (admin_rh vs worker)
- Tableau récapitulatif mensuel (statuts par jour, correction manuelle)

---

## 2. Modèle de données

### Table `profiles` (étend `auth.users` de Supabase)

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Référence `auth.users.id` |
| `prenom` | `text` NOT NULL | |
| `nom` | `text` NOT NULL | |
| `email` | `text` NOT NULL UNIQUE | Identifiant de connexion |
| `telephone` | `text` | |
| `date_naissance` | `date` | |
| `contact_urgence` | `text` | Ex : "Jean V. — 0477 98 76 54" |
| `rue` | `text` | |
| `numero` | `text` | |
| `boite` | `text` | Optionnel |
| `code_postal` | `text` | |
| `commune` | `text` | |
| `pays` | `text` | Défaut : "Belgique" |
| `service_id` | `uuid` FK → `services` | |
| `type_contrat` | `text` | Ex : "CDI — temps plein" |
| `date_entree` | `date` | Pour calcul ancienneté |
| `option_horaire` | `char(1)` CHECK ('A','B') | Option annuelle |
| `is_admin_rh` | `boolean` DEFAULT false | Rôle cumulable avec worker |
| `is_active` | `boolean` DEFAULT true | Désactivation logique (jamais supprimé) |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

### Table `services`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `nom` | `text` NOT NULL | Ex : "Juridique", "Svc Admin" |
| `code` | `text` UNIQUE | Ex : "juridique", "svc_admin" |

Services initiaux : Service Admin (6), Juridique (5), Compta/RH (2), Permanent (6).

### Table `bureaux`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `nom` | `text` NOT NULL | Ex : "Libramont", "Namur" |
| `code` | `text` UNIQUE | Ex : "lib", "nam", "mar", "arl" |
| `horaires_normaux` | `jsonb` | Horaires par jour (sem. standard) |
| `horaires_ete` | `jsonb` | Horaires juillet-août |

Bureaux : Libramont (siège), Namur, Marche, Arlon.

### Table `user_bureau_schedule`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles` | |
| `bureau_id` | `uuid` FK → `bureaux` | |
| `jour` | `smallint` | 1=Lundi … 5=Vendredi |
| `valide_depuis` | `date` | Permet historisation |

Un permanent (type "sur la route") n'a pas de lignes dans cette table — affiché comme "Sur la route".

### Table `invitation_tokens`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles` | |
| `otp_code` | `char(6)` | Code numérique, haché en base |
| `expires_at` | `timestamptz` | +48h après création |
| `used_at` | `timestamptz` | NULL si non utilisé |

---

## 3. Rôles et sécurité (RLS)

Deux rôles applicatifs, cumulables :

| Rôle | Accès |
|---|---|
| `worker` | Ses propres données seulement (profil, pointages, congés) |
| `admin_rh` | Toutes les données de tous les travailleurs |

Les policies RLS Supabase implémentent :
- `SELECT/UPDATE` sur `profiles` : worker ne voit/modifie que sa propre ligne
- `SELECT/UPDATE` sur `profiles` par admin : `is_admin_rh = true` dans JWT claims
- `INSERT` sur `profiles` : interdit côté client, uniquement via Server Action
- Le flag `is_admin_rh` est stocké dans `app_metadata` du JWT Supabase (non modifiable par le client)

---

## 4. Flux d'authentification

### 4.1 Invitation (création de compte)

1. Admin RH remplit le formulaire de création (prénom, nom, email, service, option A/B, bureaux par jour)
2. Server Action : crée la ligne `profiles` + `invitation_tokens` (OTP 6 chiffres, 48h)
3. Resend envoie un email en français avec le code OTP et le lien d'activation
4. Le travailleur ouvre la page `/activation` → entre son email + OTP
5. Validation du token → formulaire de définition du mot de passe
6. Supabase Auth : compte activé, session créée, redirection vers dashboard

### 4.2 Connexion quotidienne

- Page `/login` : email + mot de passe
- `supabase.auth.signInWithPassword()`
- Redirection selon rôle : dashboard worker ou dashboard admin

### 4.3 Mot de passe oublié

1. Page `/forgot-password` : saisie email
2. Server Action : génère nouveau OTP 6 chiffres (10 min), envoi Resend
3. Page `/reset-password` : email + OTP + nouveau mot de passe + confirmation
4. `supabase.auth.updateUser()` après validation OTP

---

## 5. Navigation

Sidebar icon gauche fixe, rétractable au survol (survol → labels texte apparaissent).

**Vue Worker :**
- 🏠 Accueil (dashboard personnel)
- ⏱ Pointage
- 🌴 Congés
- 📅 Calendrier
- 📄 Documents
- *(avatar initiales en bas)*

**Vue Admin RH :**
- 🏠 Accueil (dashboard admin)
- 👥 Travailleurs
- ⏱ Pointage
- 🌴 Congés
- 📅 Calendrier
- 📊 Rapports
- *(avatar initiales en bas)*

Un admin_rh peut accéder aux deux vues via un switch dans la sidebar.

---

## 6. Écrans

### 6.1 Dashboard Worker

- Widget pointage du jour (4 points : arrivée, midi out, midi in, départ)
- Solde congés (congés annuels, repos compensatoires, pot d'heures)
- Mini calendrier du mois avec statuts
- Indicateur "bureau du jour"

### 6.2 Dashboard Admin

- Compteur présents/absents aujourd'hui avec avatars
- Liste des demandes de congé en attente
- Stats du mois (congés approuvés, certificats reçus, heures sup)

### 6.3 Profil employé (vue travailleur)

Page unique sans onglets, scroll vertical. Trois sections :

**En-tête** (lecture seule) : avatar initiales, nom, email, badges service/option/rôle, ancienneté calculée dynamiquement depuis `date_entree`.

**Section 1 — Mes coordonnées** (modifiable, champs fond vert) :
- Prénom, nom
- Téléphone, contact d'urgence
- Adresse : rue, numéro, boîte (optionnel), code postal, commune, pays
- Changement de mot de passe (nouveau + confirmation, laisser vide pour ne pas changer)

**Section 2 — Données RH** (lecture seule, badge 🔒) :
- Service, type de contrat, date d'entrée, ancienneté calculée
- Option horaire (A/B) + date limite de changement
- Solde congés annuels, repos compensatoires, jours fériés

**Section 3 — Affectation par bureau** (lecture seule, badge 🔒) :
- Tableau lundi–vendredi avec bureau assigné par jour
- Permanents : affichage "Sur la route"

Barre de sauvegarde sticky en bas : "Annuler" + "💾 Enregistrer".

### 6.4 Profil employé — vue Admin RH

Même page, mais toutes les sections sont modifiables. Badge "Admin" visible. Accès depuis la liste des travailleurs (clic sur une ligne ou bouton ✏️).

### 6.5 Liste des travailleurs (Admin)

Tableau avec colonnes : Travailleur (avatar + nom + email), Service, Bureau(x), Option A/B, Rôle app, Statut.

- Filtres par service + barre de recherche
- Stats pills : Actifs / En congé / Malades / Option A count / Option B count
- Actions par ligne : ✏️ Modifier la fiche | 🗑 Désactiver (confirmation dialog, historique conservé)
- Rôle admin_rh : géré uniquement dans la fiche du travailleur
- Bouton "+ Nouveau travailleur" (ouvre formulaire de création = même que fiche en mode création)

### 6.6 Tableau récapitulatif mensuel

Accessible depuis le dashboard admin (section Rapports ou lien direct).

**Structure :**
- Colonne gauche sticky : Nom, Prénom · Service · Option
- Colonnes : tous les jours du mois (en-tête : numéro + abréviation jour)
- Week-ends : fond sombre, cellule grise neutre
- Jour actuel : colonne surlignée en rouge foncé
- Colonne droite : Total "P" (présences du mois)

**Statuts des cellules (28×38px, cliquables) :**

| Code | Couleur | Signification |
|---|---|---|
| P | Vert `#10b981` | Présent |
| C | Ambre `#f59e0b` | Congé |
| M | Rouge `#ef4444` | Maladie |
| R | Violet `#6c63ff` | Repos compensatoire |
| F | Gris `#6b7280` | Jour férié |
| A | Orange `#f97316` | Absent non justifié |
| ? | Rouge dashed + badge | Pointage manquant |
| W | Gris clair | Week-end |
| — | Pointillés | Jours futurs |

**Interaction — clic sur une cellule :**
- Statut normal → dropdown de sélection de statut
- Statut "?" (pointage manquant) → **modal d'alerte** avec 3 options :
  1. 🚫 Absent non justifié → marquer A, déduire du solde
  2. 🌴 Congé / Maladie / Autre → sélecteur de type d'absence
  3. ✏️ Oubli de pointage — Correction manuelle → 4 champs heure (arrivée, midi out, midi in, départ) pré-remplis avec valeurs estimées

**Contrôles :**
- Navigation mois (← Mars 2026 →)
- Filtre par service
- Bouton "Export Excel"

---

## 7. Emails (Resend)

Trois templates en français :

| Email | Déclencheur | Contenu |
|---|---|---|
| Invitation | Création compte admin | Bonjour + code OTP 6 chiffres + lien activation (48h) |
| Réinitialisation | Mot de passe oublié | Code OTP 6 chiffres (10 min) |
| Confirmation | Après activation compte | Bienvenue + lien vers l'app |

Expéditeur : `rh@accg-nalux.be` (domaine à configurer dans Resend).

---

## 8. Architecture technique

```
gestion_rh/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── activation/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← sidebar + auth guard
│   │   ├── page.tsx            ← dashboard (worker ou admin selon rôle)
│   │   ├── profil/page.tsx
│   │   └── admin/
│   │       ├── travailleurs/
│   │       │   ├── page.tsx    ← liste
│   │       │   └── [id]/page.tsx ← fiche complète (admin edit mode)
│   │       └── recap/page.tsx  ← tableau récapitulatif mensuel
│   └── api/
│       └── auth/callback/route.ts
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── ActivationForm.tsx
│   │   └── ResetPasswordForm.tsx
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── CoordoneesSection.tsx
│   │   ├── DonneesRHSection.tsx
│   │   └── AffectationSection.tsx
│   └── admin/
│       ├── TravailleursTable.tsx
│       ├── RecapMensuel.tsx
│       └── PointageManquantModal.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── resend/
│   │   └── emails.ts
│   └── auth/
│       └── actions.ts          ← Server Actions
├── supabase/
│   └── migrations/
│       ├── 001_profiles.sql
│       ├── 002_services.sql
│       ├── 003_bureaux.sql
│       ├── 004_user_bureau_schedule.sql
│       ├── 005_invitation_tokens.sql
│       └── 006_rls_policies.sql
└── emails/
    ├── InvitationEmail.tsx
    ├── ResetPasswordEmail.tsx
    └── WelcomeEmail.tsx
```

**Middleware :** `supabase/middleware.ts` protège les routes `(dashboard)` — redirige vers `/login` si pas de session valide. Redirige vers `/login` si compte inactif (`is_active = false`).

**Synchronisation du rôle admin_rh :** Le flag `is_admin_rh` est stocké à deux endroits : dans `profiles.is_admin_rh` (pour l'affichage UI) et dans `auth.users.app_metadata` (pour les policies RLS via `auth.jwt() -> 'app_metadata' ->> 'is_admin_rh'`). Un trigger PostgreSQL sur `profiles` maintient les deux en sync lors de chaque UPDATE. Les policies RLS utilisent uniquement `app_metadata` (non modifiable côté client).

**Server Actions** (pas de routes API custom) : toutes les mutations passent par des Server Actions Next.js.

---

## 9. Contraintes métier

- **Désactivation logique** : un compte n'est jamais supprimé (`is_active = false`), l'historique est conservé.
- **Rôle admin_rh** : changeable uniquement par un autre admin_rh, depuis la fiche du travailleur. Interdit côté client (stocké dans `app_metadata` Supabase).
- **Option horaire A/B** : modifiable uniquement avant le 15 décembre pour l'année suivante, uniquement par un admin_rh.
- **Adresse décomposée** : les champs d'adresse sont séparés (rue, numéro, boîte, code postal, commune, pays) pour faciliter les exports et les calculs de déplacement futurs.
- **Télétravail** : non implémenté dans ce module. La table `user_bureau_schedule` est conçue pour l'accueillir (valeur `bureau_id = NULL` + flag `is_telework` à ajouter en Module 2 ou 6).
- **NISS / IBAN** : hors périmètre (pas de paie dans l'app).

---

## 10. Décisions d'architecture retenues

| Décision | Raison |
|---|---|
| Next.js 14 App Router | Server Components + Server Actions, pas besoin d'API REST séparée |
| Supabase Auth | OTP natif, RLS, JWT claims pour les rôles |
| Resend | Templates React (`.tsx`), API simple, fiable pour emails transactionnels |
| shadcn/ui | Composants accessibles, personnalisables, pas de vendor lock-in |
| Tailwind CSS | Cohérence design, pas de CSS modules à maintenir |
| Désactivation logique | Conservation de l'historique RH obligatoire |
| Server Actions uniquement | Simplifie l'architecture, évite la duplication API/client |

---

## 11. Hors périmètre (modules suivants)

- Pointage (Module 2) : logique des 4 points, calcul heures travaillées, pot d'heures
- Calculateur d'horaires (Module 3) : options A/B, horaires été, RTT, heures sup
- Gestion des congés (Module 4) : demandes, approbation, soldes, certificats médicaux
- Calendriers de présence (Module 5) : vue par bureau/service
- Portal admin complet (Module 6) : exports, statistiques avancées
