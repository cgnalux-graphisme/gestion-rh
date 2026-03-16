# Spec — Module 6 : Rapports, Exports & Statistiques

**Date :** 2026-03-16
**Projet :** Gestion RH — Centrale Générale FGTB Namur-Luxembourg
**Stack :** Next.js 14 (App Router) · TypeScript · Supabase (PostgreSQL) · Tailwind CSS + shadcn/ui · Vercel
**Langue :** Français uniquement
**Appareils :** Desktop-first, responsive mobile

---

## 1. Perimetre du module

Ce module couvre :
- Page centralisee `/admin/rapports` regroupant statistiques et exports
- 4 blocs de statistiques : taux de presence, absences par type, top absences, pot d'heures
- 5 exports en Excel (`.xlsx`) et PDF (`.pdf`) : pointages mensuels, liste travailleurs, conges, calendrier presence, pot d'heures
- Filtres globaux : periode (mois/trimestre/annee) + service + bureau
- Lien vers le recap mensuel existant (`/admin/recap`)

Hors perimetre :
- Telegravail (reporte a un module ulterieur)
- Stats de tendances sur 6-12 mois
- Stats de consommation de conges

---

## 2. Navigation

### Modification sidebar

Le lien admin "Rapports" (`📊`) change de destination :
- **Avant :** `{ href: '/admin/recap', icon: '📊', label: 'Rapports' }`
- **Apres :** `{ href: '/admin/rapports', icon: '📊', label: 'Rapports' }`

Le recap mensuel (`/admin/recap`) reste accessible via un lien depuis la page `/admin/rapports`.

### Page `/admin/rapports`

Structure verticale :
1. **En-tete** : titre "Rapports & Statistiques" + lien "Voir le recap mensuel →" vers `/admin/recap`
2. **Barre de filtres** (`RapportsFiltres` — Client Component) : periode + service + bureau
3. **Grille statistiques** : 4 blocs en grid 2×2 (desktop), stack vertical (mobile)
4. **Section exports** : 5 cartes avec boutons Telecharger Excel / Telecharger PDF

---

## 3. Filtres (searchParams URL)

| Param | Type | Defaut | Valeurs |
|---|---|---|---|
| `periode` | string | `mois` | `mois` \| `trimestre` \| `annee` |
| `date` | ISO date | 1er du mois courant | ex : `2026-03-01` |
| `service` | uuid | — (tous) | uuid du service |
| `bureau` | uuid | — (tous) | uuid du bureau |

**Calcul de la plage de dates selon `periode` :**
- `mois` : du 1er au dernier jour du mois contenant `date`
- `trimestre` : T1 (jan-mar), T2 (avr-jun), T3 (jul-sep), T4 (oct-dec) — le trimestre contenant `date`
- `annee` : du 1er janvier au 31 decembre de l'annee contenant `date`

**Navigation :**
- Fleches ← / → : precedent/suivant (mois, trimestre ou annee selon le mode)
- Bouton "Aujourd'hui" : revient a la periode courante

---

## 4. Architecture

### Fichiers a creer

```
app/(dashboard)/admin/rapports/
  page.tsx                    <- RSC principal, lit searchParams, orchestre tout
  loading.tsx                 <- skeleton animate-pulse

lib/rapports/
  periodes.ts                 <- utilitaire pur : calcul plage de dates depuis periodeType + periodeDate
  getStatsData.ts             <- fonction server-side pure (agregation stats)
  exports.ts                  <- Server Actions ('use server') pour generer Excel + PDF

components/rapports/
  RapportsFiltres.tsx         <- Client Component ('use client') — periode/service/bureau
  TauxPresenceChart.tsx       <- RSC, barres CSS horizontales par service
  AbsencesParTypeChart.tsx    <- RSC, donut SVG inline + legende
  TopAbsences.tsx             <- RSC, liste ordonnee top 5
  PotHeuresChart.tsx          <- RSC, barres positives/negatives par service
  ExportsSection.tsx          <- Client Component ('use client'), boutons telechargement
```

### Fichiers a modifier

- `components/layout/Sidebar.tsx` : lien Rapports → `/admin/rapports`
- `package.json` : ajouter `exceljs` + `jspdf` + `jspdf-autotable`

### Pattern

Identique aux modules 1-5 :
- Server Components purs pour le rendu des donnees
- Un Client Component pour les filtres (`router.push` + searchParams)
- Un Client Component pour les exports (appel Server Action + declenchement telechargement)
- Server Actions pour la generation des fichiers
- Pas de routes API REST

---

## 5. Fonction `getStatsData`

### Signature

```ts
type PeriodeType = 'mois' | 'trimestre' | 'annee'

type StatsData = {
  // Taux de presence
  tauxPresence: { service: string; serviceId: string; taux: number; joursPresent: number; joursOuvrables: number }[]
  tauxGlobal: number

  // Absences par type
  absencesParType: { type: string; label: string; count: number; couleur: string }[]
  totalAbsences: number

  // Top absences (top 5)
  topAbsences: { prenom: string; nom: string; service: string; joursMaladie: number; joursAbsent: number; total: number }[]

  // Pot d'heures par service
  potHeures: { service: string; serviceId: string; moyenneMinutes: number; nbTravailleurs: number }[]

  // Pour les filtres
  services: { id: string; nom: string }[]
  bureaux: { id: string; nom: string }[]
}

async function getStatsData(params: {
  periodeType: PeriodeType
  periodeDate: string    // ISO "YYYY-MM-DD"
  serviceId?: string
  bureauId?: string
}): Promise<StatsData>
```

### Requetes DB

Utilise `createClient()` depuis `@/lib/supabase/server` (RLS actif).

1. **profiles** — travailleurs actifs, filtre optionnel par `service_id`. Join `services`.
2. **day_statuses** — tous les records pour les user_ids et la plage calculee.
3. **pot_heures** — soldes de l'annee en cours pour les user_ids.
4. **user_bureau_schedule** — si `bureauId` fourni, pour filtrer les travailleurs (meme logique que `getCalendrierData`).
5. **services** + **bureaux** — listes completes pour les dropdowns.

### Logique d'agregation

**Jours ouvrables :**
- Utiliser `joursFeriesPlage(dateDebut, dateFin)` depuis `lib/calendrier/joursFeries.ts` (reutilise M5) pour obtenir la liste des jours feries belges sur la plage.
- Un jour ouvrable = lun-ven, pas un weekend, pas dans la Map retournee par `joursFeriesPlage`.
- Si un jour est ferie et n'a pas de `day_status` record, il ne compte ni comme absence ni dans le denominateur `joursOuvrables`.

**Taux de presence :**
- Compter les jours ouvrables (voir ci-dessus) dans la plage
- Pour chaque travailleur, compter les `day_statuses` avec `status = 'P'`
- Grouper par service, calculer `taux = joursPresent / (joursOuvrables * nbTravailleurs) * 100`
- `tauxGlobal` = moyenne ponderee

**Absences par type :**
- Compter les `day_statuses` avec `status IN ('C', 'M', 'R', 'A')` pour les user_ids dans la plage
- Les statuts `P` et `F` sont exclus (presence et ferie ne sont pas des absences)
- Mapping :
  | status | label | couleur (Tailwind) |
  |---|---|---|
  | `C` | Conge annuel | `#f59e0b` (amber) |
  | `M` | Maladie | `#ef4444` (red) |
  | `R` | Repos compensatoire | `#6c63ff` (violet) |
  | `A` | Absent non justifie | `#f97316` (orange) |

**Top absences :**
- Pour chaque travailleur, sommer les jours `M` et `A` separement
- Trier par total (M + A) decroissant, prendre les 5 premiers
- Inclure nom, prenom, service

**Pot d'heures :**
- Lire `pot_heures` pour l'annee extraite de `periodeDate` (pas l'annee courante — si l'utilisateur consulte 2025, afficher les soldes 2025)
- Grouper par service, calculer moyenne de `solde_minutes`

**Filtre bureau :**
- Meme mecanisme que `getCalendrierData` (voir `lib/calendrier/getCalendrierData.ts`) : charger toutes les entrees `user_bureau_schedule` pour les user_ids, puis pour chaque jour ouvrable de la plage, resoudre l'entree la plus recente avec `valide_depuis <= date` et `jour = jourSemaine`. Un travailleur est retenu s'il est assigne au bureau pour au moins un jour ouvrable de la plage. Les jours ou il n'est pas dans le bureau sont ignores dans les calculs de stats.

---

## 6. Statistiques — Interface utilisateur

### Layout

Grid 2 colonnes sur desktop (`md:grid-cols-2`), stack vertical sur mobile.

### Bloc 1 : Taux de presence

Carte avec :
- Chiffre global en grand (ex : "87%") + label "Taux de presence global"
- Barres horizontales CSS par service :
  ```
  Service Admin   ████████████████░░░░  82%
  Juridique       ██████████████████░░  91%
  Compta/RH       ████████████████████  100%
  Permanent       ██████████████░░░░░░  67%
  ```
- Barre = `div` avec `width: {taux}%`, fond `bg-green-500`, fond gris pour le reste

### Bloc 2 : Absences par type

Carte avec :
- Donut SVG inline : cercle `<circle>` avec `stroke-dasharray` et `stroke-dashoffset` rotatifs pour chaque segment. Si `totalAbsences === 0`, afficher un cercle gris complet avec texte "0" au centre
- Legende a droite avec pastilles couleur + chiffres :
  ```
  🟡 Conge annuel      12
  🔴 Maladie            8
  🟣 Repos comp.        4
  🟠 Absent non just.   2
  ```
- Total au centre du donut

### Bloc 3 : Top absences

Carte avec :
- Titre "Top 5 — Absences (maladie + non justifie)"
- Liste numerotee :
  ```
  1. Marie Dupont (Juridique) — 8j (5 maladie, 3 non justifie)
  2. Jean Martin (Svc Admin)  — 6j (4 maladie, 2 non justifie)
  ...
  ```
- Badge service a cote du nom
- Si aucune absence : message "Aucune absence sur la periode"

### Bloc 4 : Pot d'heures

Carte avec :
- Barres horizontales par service, centrees sur zero :
  ```
  Service Admin   ████████          +2h 30min (moy.)
  Juridique              ████████  -1h 45min (moy.)
  ```
- Barres vertes a droite de zero (positif), rouges a gauche (negatif)
- Nombre de travailleurs par service entre parentheses

---

## 7. Exports — Interface utilisateur

### Section "Exports"

Sous les stats, section avec titre "Exports" et 5 cartes en grid :

| Export | Description | Boutons |
|---|---|---|
| Pointages mensuels | Grille recap (travailleurs x jours, statuts) | Excel \| PDF |
| Liste travailleurs | Tableau complet des travailleurs actifs | Excel \| PDF |
| Conges | Demandes avec statuts + soldes par travailleur | Excel \| PDF |
| Calendrier presence | Grille mois (travailleurs x jours, statuts calendrier) | Excel \| PDF |
| Pot d'heures | Soldes par travailleur et service | Excel \| PDF |

Chaque carte :
- Icone + titre + description 1 ligne
- 2 boutons : "📥 Excel" et "📥 PDF"
- Les filtres actifs (periode, service, bureau) s'appliquent a l'export

### Architecture des exports

**Server Actions** dans `lib/rapports/exports.ts` avec `'use server'` :

```ts
// Chaque action recoit les filtres et retourne base64
export async function exportPointagesExcel(params: ExportParams): Promise<string>
export async function exportPointagesPdf(params: ExportParams): Promise<string>
export async function exportTravailleursExcel(params: ExportParams): Promise<string>
export async function exportTravailleursPdf(params: ExportParams): Promise<string>
export async function exportCongesExcel(params: ExportParams): Promise<string>
export async function exportCongesPdf(params: ExportParams): Promise<string>
export async function exportCalendrierExcel(params: ExportParams): Promise<string>
export async function exportCalendrierPdf(params: ExportParams): Promise<string>
export async function exportPotHeuresExcel(params: ExportParams): Promise<string>
export async function exportPotHeuresPdf(params: ExportParams): Promise<string>
```

**Architecture interne :** pour eviter la duplication entre les 10 actions, chaque type d'export est structure en deux couches : (1) une fonction de collecte de donnees qui retourne des donnees structurees, (2) deux formateurs (Excel via `exceljs`, PDF via `jspdf`) qui transforment ces donnees en fichier. Les 10 Server Actions publiques sont de simples orchestrateurs.

**Type ExportParams :**
```ts
type ExportParams = {
  periodeType: 'mois' | 'trimestre' | 'annee'
  periodeDate: string
  serviceId?: string
  bureauId?: string
}
```

**Excel** (`exceljs`) :
- Feuille unique par export
- En-tetes colores (fond `#1a2332`, texte blanc)
- Colonnes auto-dimensionnees
- Nom du fichier : `{type}_{periode}.xlsx` (ex : `pointages_mars-2026.xlsx`)

**PDF** (`jspdf` + `jspdf-autotable`) :
- En-tete : "Centrale Generale FGTB Namur-Luxembourg" + titre du rapport + periode
- Tableau formate avec alternance de couleur de lignes
- Pied de page : date de generation + numero de page
- Nom du fichier : `{type}_{periode}.pdf`

**Cote client** (`ExportsSection.tsx`) :
- Appelle la Server Action au clic
- Decode le base64 en Blob
- Cree un `URL.createObjectURL` et declenche le telechargement via un `<a>` temporaire
- Indicateur de chargement (spinner) pendant la generation

---

## 8. Contenu des exports

### Export Pointages mensuels

| Colonne | Source |
|---|---|
| Nom | `profiles.nom` |
| Prenom | `profiles.prenom` |
| Service | `services.nom` |
| Jour 1..28-31 | `day_statuses.status` (P/C/M/R/F/A) ou vide |
| Total Presences | Somme des `P` |

Weekends : cellules grises avec "W". Jours feries : cellules bleues avec "F".

### Export Liste travailleurs

| Colonne | Source |
|---|---|
| Nom | `profiles.nom` |
| Prenom | `profiles.prenom` |
| Email | `profiles.email` |
| Service | `services.nom` |
| Bureau(x) | `user_bureau_schedule` agrege (ex : "Lun: Libramont, Mar: Namur") |
| Option horaire | `profiles.option_horaire` (A ou B) |
| Type de contrat | `profiles.type_contrat` |
| Date d'entree | `profiles.date_entree` |
| Statut | `profiles.is_active` ? "Actif" : "Inactif" |

### Export Conges

| Colonne | Source |
|---|---|
| Nom | `profiles.nom + prenom` |
| Type | `conges.type` — labels : `conge_annuel` → "Conge annuel", `repos_comp` → "Repos compensatoire", `maladie` → "Maladie", `autre` → "Autre" |
| Date debut | `conges.date_debut` |
| Date fin | `conges.date_fin` |
| Nb jours | `conges.nb_jours` |
| Statut | `conges.statut` — labels : `en_attente` → "En attente", `approuve` → "Approuve", `refuse` → "Refuse" |
| Commentaire | `conges.commentaire_travailleur` |

Reutiliser `labelTypeConge()` et `labelStatutConge()` existants dans `lib/utils/dates.ts`.

+ Feuille/page supplementaire : Soldes par travailleur (`soldes_conges` table). Colonnes : Nom, Conges annuels total, Conges annuels pris, Conges annuels restant (calcule : `total - pris`), Repos comp total, Repos comp pris, Repos comp restant (calcule : `total - pris`).

### Export Calendrier presence

Meme structure que le calendrier M5 vue mois :
| Colonne | Source |
|---|---|
| Nom | `profiles.nom + prenom` |
| Service | `services.nom` |
| Jour 1..28-31 | StatutJour (P/A/C/F/W/—) |

Codes couleur dans Excel (remplissage cellule). En PDF, lettres seules.

### Export Pot d'heures

| Colonne | Source |
|---|---|
| Nom | `profiles.nom + prenom` |
| Service | `services.nom` |
| Option horaire | `profiles.option_horaire` |
| Solde (minutes) | `pot_heures.solde_minutes` |
| Solde (format) | Formatte "Xh Ymin" ou "-Xh Ymin" |

---

## 9. Securite & permissions

**`/admin/rapports` (admin uniquement) :** verification inline identique aux autres pages admin :
```ts
const { data: myProfile } = await supabase
  .from('profiles')
  .select('is_admin_rh')
  .eq('id', user.id)
  .single()
if (!myProfile?.is_admin_rh) redirect('/')
```

**Server Actions exports :** chaque action verifie `is_admin_rh` avant de generer le fichier. Utilise `createClient()` (RLS actif).

**Aucune action de modification** dans ce module (lecture seule + exports).

---

## 10. Dependencies a ajouter

| Package | Version | Usage |
|---|---|---|
| `exceljs` | `^4.4` | Generation fichiers Excel (.xlsx) |
| `jspdf` | `^2.5` | Generation fichiers PDF |
| `jspdf-autotable` | `^3.8` | Plugin jspdf pour tableaux formates |

Pas de librairie de graphiques — les charts sont en SVG inline (donut) et CSS (barres horizontales).

---

## 11. Hors perimetre

- Teletravail (flag `is_telework` dans `user_bureau_schedule`)
- Tendances mensuelles sur 6-12 mois (graphique en ligne)
- Stats de consommation des conges (soldes restants, taux d'utilisation)
- Export en temps reel / planifie (cron)
- Envoi d'exports par email
- Calendrier en temps reel (WebSockets)
