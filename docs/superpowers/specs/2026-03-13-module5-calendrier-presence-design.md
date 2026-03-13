# Spec — Module 5 : Calendriers de présence

**Date :** 2026-03-13
**Projet :** Gestion RH — Centrale Générale FGTB Namur-Luxembourg
**Stack :** Next.js 14 (App Router) · TypeScript · Supabase (PostgreSQL) · Tailwind CSS + shadcn/ui · Vercel
**Langue :** Français uniquement
**Appareils :** Desktop-first, responsive mobile (scroll horizontal vue semaine)

---

## 1. Périmètre du module

Ce module couvre :
- Vue calendrier de présence par travailleur, avec statuts journaliers (présent, absent, congé, férié, weekend)
- Couverture passé + futur : données réelles (day_statuses, congés approuvés) + statuts vides pour le futur
- Double vue : semaine (7 jours) et mois (28–31 jours)
- Filtres par service et par bureau
- Accessible en lecture seule à tous les travailleurs connectés (worker + admin)
- Navigation par flèches + bouton "Aujourd'hui"

---

## 2. Pages & routing

| Route | Accès | Description |
|---|---|---|
| `/calendrier` | Tous (worker + admin) | Calendrier lecture seule |
| `/admin/calendrier` | Admin uniquement | Même contenu, cohérence nav admin |

**SearchParams URL :**

| Param | Type | Défaut vue semaine | Défaut vue mois | Valeurs |
|---|---|---|---|---|
| `vue` | string | `semaine` | `mois` | `semaine` \| `mois` |
| `date` | ISO date | lundi semaine courante | 1er du mois courant | ex : `2026-03-09` |
| `service` | uuid | — (tous) | — (tous) | uuid du service |
| `bureau` | uuid | — (tous) | — (tous) | uuid du bureau |

**Comportement switch vue :** quand l'utilisateur bascule de `semaine` vers `mois`, `date` est recalculée vers le 1er du mois contenant la semaine affichée. De `mois` vers `semaine`, `date` est recalculée vers le lundi de la semaine contenant le 1er du mois.

**Calculs de dates :** ISO 8601, lundi = début de semaine. Utiliser le `Date` natif (cohérent avec le reste du projet — pas de librairie de dates). Calcul du lundi d'une semaine : `date.getDay() === 0 ? -6 : 1 - date.getDay()` jours ajoutés.

---

## 3. Architecture

**Approche :** Server Components purs pour le rendu des données + un Client Component isolé pour les contrôles interactifs (`CalendrierFiltres`). Navigation par `router.push` avec searchParams mis à jour. Pas de client fetch, pas de routes API REST. Cohérent avec les modules 1–4.

### Structure fichiers

```
app/(dashboard)/calendrier/
  page.tsx                    ← RSC principal (lit searchParams, appelle getCalendrierData)
  loading.tsx                 ← skeleton (grille animate-pulse, similaire aux skeletons existants)

app/(dashboard)/admin/calendrier/
  page.tsx                    ← RSC admin (même logique + vérification is_admin_rh inline)
  loading.tsx                 ← skeleton (même structure)

lib/calendrier/
  getCalendrierData.ts        ← fonction async server-side pure (importée depuis les RSC pages)
  joursFeries.ts              ← liste statique des jours fériés belges + calcul Pâques

components/calendrier/
  CalendrierVueSemaine.tsx    ← RSC, grille 7 colonnes
  CalendrierVueMois.tsx       ← RSC, grille mensuelle
  CalendrierFiltres.tsx       ← Client Component ('use client'), dropdowns + switch + navigation
  StatutCell.tsx              ← RSC, badge coloré par statut
```

**Note architecture :** `getCalendrierData` est une fonction server-side ordinaire (pas un Server Action Next.js — pas de `'use server'`). Elle est importée et appelée directement depuis les RSC pages, comme les autres fonctions de `lib/`.

**Note `CalendrierFiltres` :** ce composant est nécessairement un Client Component (`'use client'`) car il gère des événements utilisateur (`onClick`, `onChange`) pour appeler `router.push`. C'est le seul îlot client du module.

---

## 4. Modèle de données

### Types TypeScript (nouveaux)

```ts
type StatutJour =
  | 'present'    // travailleur présent
  | 'absent'     // absent non justifié
  | 'conge'      // congé approuvé (annuel, maladie, repos comp, autre)
  | 'ferie'      // jour férié belge
  | 'weekend'    // samedi ou dimanche
  | 'vide'       // aucune donnée disponible

type JourCalendrier = {
  date: string         // ISO : "2026-03-13"
  statut: StatutJour
  label?: string       // présent si statut === 'ferie' (nom du jour férié)
                       // ou statut === 'conge' (type de congé affiché)
}

type TravailleurCalendrier = {
  id: string
  prenom: string
  nom: string
  service: string      // nom du service
  jours: JourCalendrier[]
}
```

### Mapping DayStatusRecord.status → StatutJour

`DayStatusRecord.status` est typé `'P' | 'C' | 'M' | 'R' | 'F' | 'A'` (voir `types/database.ts`). Ces 6 valeurs sont les seules présentes dans la table `day_statuses`. Les valeurs `'?'`, `'W'`, `'-'` existent dans le type union `DayStatus` mais ne sont **pas** stockées dans `DayStatusRecord` — elles servent à d'autres usages (affichage temporaire, etc.) et ne doivent pas être gérées dans `getCalendrierData`.

Correspondances :

| DayStatusRecord.status | StatutJour | label |
|---|---|---|
| `'P'` | `present` | — |
| `'A'` | `absent` | — |
| `'C'` | `conge` | `"Congé annuel"` |
| `'M'` | `conge` | `"Maladie"` |
| `'R'` | `conge` | `"Repos compensatoire"` |
| `'F'` | `ferie` | nom du jour férié (récupéré depuis `joursFeries`) — si la date n'est pas dans `joursFeries` (cas rare : statut `'F'` posé manuellement), `label = "Jour férié"` (valeur générique) |

### Mapping TypeConge → label affiché

Source : table `conges`, champ `type: TypeConge`.

| TypeConge (DB) | label |
|---|---|
| `conge_annuel` | `"Congé annuel"` |
| `repos_comp` | `"Repos compensatoire"` |
| `maladie` | `"Maladie"` |
| `autre` | `"Autre"` |

### Fonction `getCalendrierData`

**Signature :**
```ts
async function getCalendrierData(params: {
  dateDebut: string   // ISO "YYYY-MM-DD"
  dateFin: string     // ISO "YYYY-MM-DD"
  serviceId?: string  // uuid — filtre optionnel
  bureauId?: string   // uuid — filtre optionnel
}): Promise<TravailleurCalendrier[]>
```

Utilise `createClient()` depuis `@/lib/supabase/server` (convention du projet, RLS actif).

**Requêtes DB (dans ordre d'exécution) :**
1. `profiles` — travailleurs actifs (`is_active = true`), filtrés par `service_id` si `serviceId` fourni. Inclut join `services`.
2. `day_statuses` — tous les `DayStatusRecord` pour les user_ids résultants (issus de la requête 1) et la plage `[dateDebut, dateFin]`.
3. `conges` — tous les congés avec `statut = 'approuve'` dont `date_debut <= dateFin` ET `date_fin >= dateDebut` (chevauchement de plage), **filtrés sur les user_ids résultants de la requête 1**.
4. `user_bureau_schedule` — si `bureauId` fourni : **toutes** les entrées pour les user_ids résultants de la requête 1 (pas de filtre bureau ici, le filtrage se fait en mémoire pour respecter `valide_depuis`).
5. `services` + `bureaux` — listes complètes pour alimenter les dropdowns de `CalendrierFiltres` (passées en props au composant client).

---

## 5. Logique d'agrégation par case (travailleur × jour)

### Filtre bureau (avant l'agrégation)

Si `bureauId` est fourni :

1. Pour chaque jour de la plage qui est un jour ouvrable (lun–ven), calculer `jourSemaine` (1=lundi…5=vendredi).
2. Pour chaque travailleur, trouver l'entrée `user_bureau_schedule` la plus récente avec `jour = jourSemaine` ET `valide_depuis <= dateDuJour`.
3. Si cette entrée a `bureau_id = bureauId` → le travailleur est **inclus pour ce jour**.
4. Si aucune entrée trouvée (permanent "sur la route") → **exclu pour ce jour**.
5. Si l'entrée a un `bureau_id` différent → **exclu pour ce jour**.

**Comportement du filtre bureau sur la ligne du travailleur :**
- Un travailleur **apparaît dans la liste** si au moins un jour de la période affichée l'inclut dans le bureau sélectionné.
- Pour les jours où il n'est pas dans le bureau sélectionné (autre bureau ou non assigné ce jour-là), la case affiche `vide` — elle ne montre pas son statut réel.
- Ce comportement rend le filtre bureau "focus sur qui est dans ce bureau aujourd'hui/ce jour" plutôt qu'un filtre global sur le travailleur.

**Implémentation :** charger toutes les entrées `user_bureau_schedule` en une requête, filtrer en mémoire (19 travailleurs, volume négligeable).

### Agrégation statut par case (travailleur × jour)

Priorité décroissante :

| Priorité | Condition | StatutJour | label |
|---|---|---|---|
| 1 | Samedi ou dimanche | `weekend` | — (pas de tooltip — intentionnel) |
| 2 | Date dans `joursFeries` | `ferie` | nom du jour férié |
| 3 | Congé approuvé (`conges`) couvrant cette date | `conge` | mapping TypeConge → label |
| 4 | `DayStatusRecord` existant pour ce travailleur et cette date | voir mapping DayStatus | voir mapping |
| 5 | Aucune des conditions précédentes | `vide` | — |

**Résolution du conflit maladie/repos_comp :** les congés approuvés en M4 génèrent à la fois une entrée `conges` (approuvée) ET une entrée `day_statuses` (statut `M`, `R`, ou `C`). La priorité 3 (`conges`) l'emporte sur la priorité 4 (`day_statuses`), garantissant l'affichage du type exact. Si un statut `M` ou `R` est posé manuellement en M2 (sans demande de congé formelle dans `conges`), la priorité 4 prend le relais via le mapping DayStatus.

### Jours fériés belges (liste statique — `joursFeries.ts`)

**Jours fixes annuels :** Nouvel An (1/1), Fête du Travail (1/5), Fête Nationale (21/7), Assomption (15/8), Toussaint (1/11), Armistice (11/11), Noël (25/12).

**Jours variables (calculés à partir de Pâques) :** Lundi de Pâques (Pâques + 1), Ascension (Pâques + 39), Lundi de Pentecôte (Pâques + 50).

**Algorithme Pâques :** algorithme de Meeus/Jones/Butcher (implémentation TS < 20 lignes).

**Retour de `joursFeries(annee: number)` :** `Map<string, string>` (clé : ISO date `"YYYY-MM-DD"`, valeur : nom du jour férié en français).

Pour une plage multi-années (ex : décembre → janvier), appeler `joursFeries` pour chaque année couverte et fusionner les Maps.

---

## 6. Interface utilisateur

### Barre de filtres (CalendrierFiltres — `'use client'`)

```
[← Préc]  [Semaine du 9 au 15 mars 2026]  [Suiv →]  [Aujourd'hui]
[Service ▾]  [Bureau ▾]  [Semaine | Mois]
```

**Props interface :**
```ts
type CalendrierFiltresProps = {
  vue: 'semaine' | 'mois'
  date: string              // ISO date de référence actuelle
  serviceId?: string        // filtre service actif
  bureauId?: string         // filtre bureau actif
  services: Service[]       // liste complète pour le dropdown
  bureaux: Bureau[]         // liste complète pour le dropdown
}
```

Les listes `services` et `bureaux` sont chargées côté serveur dans `getCalendrierData` (requête 5) et passées en props depuis le RSC page vers `CalendrierFiltres`.

- Chaque interaction appelle `router.push(pathname + '?' + newSearchParams.toString())`
- Label de période : "Semaine du X au Y mois AAAA" (vue semaine) ou "Mars 2026" (vue mois)
- Bouton "Aujourd'hui" recalcule `date` selon la vue active (lundi semaine courante ou 1er mois courant)

### Vue Semaine (CalendrierVueSemaine — RSC)

Grille : 1 colonne fixe (prénom + nom) + 7 colonnes (Lun→Dim). Travailleurs groupés par service avec séparateurs visuels (ligne titre service en `bg-gray-50 font-semibold`).

```
                  Lun 10  Mar 11  Mer 12  Jeu 13  Ven 14  Sam  Dim
─── Service Admin ────────────────────────────────────────────────
Marie Dupont       [P]     [P]     [C]     [P]     [P]    [—]  [—]
Jean Martin        [P]     [A]     [P]     [P]     [P]    [—]  [—]
─── Juridique ────────────────────────────────────────────────────
...
```

Colonne nom : `sticky left-0 bg-white z-10` pour garder les noms visibles lors du scroll horizontal sur mobile.

### Vue Mois (CalendrierVueMois — RSC)

Même grille, 28–31 colonnes. Noms raccourcis (initiale prénom + nom, ex : "M. Dupont").

**Comportement mobile :** le composant affiche un message sur `sm` et masque la grille :
```tsx
<p className="md:hidden text-sm text-gray-500 p-4">
  La vue mensuelle n'est pas disponible sur mobile. Utilisez la vue semaine.
</p>
<div className="hidden md:block overflow-x-auto">
  {/* grille */}
</div>
```
Si l'URL contient `?vue=mois` sur mobile, le message s'affiche — pas de redirection automatique.

### Composant StatutCell (RSC)

| Statut | Classes Tailwind | Contenu | Tooltip (`title`) |
|---|---|---|---|
| `present` | `bg-green-100 text-green-800` | P | "Présent" |
| `absent` | `bg-red-100 text-red-800` | A | "Absent" |
| `conge` | `bg-orange-100 text-orange-800` | C | valeur de `label` |
| `ferie` | `bg-blue-100 text-blue-800` | F | valeur de `label` |
| `weekend` | `bg-gray-100 text-gray-300` | — | aucun (intentionnel) |
| `vide` | `bg-white text-gray-200` | — | "Non renseigné" (couvre les deux cas : aucune donnée disponible, et travailleur absent de ce bureau ce jour-là — distinction non exposée dans l'UI) |

Taille : `w-8 h-8 text-xs font-medium rounded flex items-center justify-center` (vue semaine) / `w-6 h-6 text-[10px]` (vue mois). Tooltip via attribut HTML `title`.

---

## 7. Navigation

| Vue | Action | Nouvelle valeur `date` |
|---|---|---|
| semaine | Flèche ← | lundi - 7 jours |
| semaine | Flèche → | lundi + 7 jours |
| semaine | Aujourd'hui | lundi de la semaine courante |
| mois | Flèche ← | 1er du mois précédent |
| mois | Flèche → | 1er du mois suivant |
| mois | Aujourd'hui | 1er du mois courant |

---

## 8. Sécurité & permissions

**`/calendrier` (worker + admin) :** le middleware existant vérifie la session active. La page appelle `supabase.auth.getUser()` et redirige vers `/login` si aucun utilisateur — cohérence avec le pattern des autres pages du projet. Le `user.id` n'est pas utilisé dans le module (lecture seule de tous les profils actifs).

**`/admin/calendrier` (admin uniquement) :** la page RSC effectue la vérification inline, comme toutes les pages admin existantes du projet (ex : `app/(dashboard)/admin/conges/page.tsx`) :
```ts
const { data: myProfile } = await supabase.from('profiles').select('is_admin_rh').eq('id', user.id).single()
if (!myProfile?.is_admin_rh) redirect('/')
```
Pas de layout admin séparé — cohérence avec les modules existants.

**`getCalendrierData` :** utilise `createClient()` depuis `@/lib/supabase/server` (RLS actif, convention projet).

**RLS requis — `profiles` :** les workers doivent pouvoir lire tous les profils actifs pour alimenter le calendrier. Vérifier que la politique RLS existante permet `SELECT` sur `profiles` pour les utilisateurs authentifiés sur les profils actifs. Si ce n'est pas le cas, appliquer :
```sql
CREATE POLICY "Authenticated users can read active profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_active = true);
```

**Aucune action de modification** dans ce module (lecture seule).

---

## 9. Hors périmètre

- Modification des statuts depuis le calendrier (reste dans M2 Admin Recap)
- Export PDF/Excel du calendrier (Module 6)
- Notifications de présence
- Calendrier en temps réel (WebSockets)
