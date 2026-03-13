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
- Couverture passé + futur : données réelles (pointage, congés approuvés) + statuts vides pour le futur
- Double vue : semaine (7 jours) et mois (28-31 jours)
- Filtres par service et par bureau
- Accessible en lecture seule à tous les travailleurs (worker + admin)
- Navigation par flèches + bouton "Aujourd'hui"

---

## 2. Pages & routing

| Route | Accès | Description |
|---|---|---|
| `/calendrier` | Tous (worker + admin) | Calendrier lecture seule |
| `/admin/calendrier` | Admin uniquement | Même contenu, cohérence nav admin |

**SearchParams URL :**
| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `vue` | string | `semaine` | `semaine` \| `mois` |
| `date` | ISO date | lundi semaine courante | ex : `2026-03-09` |
| `service` | uuid | — (tous) | uuid du service |
| `bureau` | uuid | — (tous) | uuid du bureau |

---

## 3. Architecture

**Approche :** Server Components purs + searchParams URL. Pas de client fetch, pas de routes API REST. Cohérent avec les modules 1–4.

**Navigation :** `router.push` avec nouveaux searchParams → rechargement RSC complet.

### Structure fichiers

```
app/(dashboard)/calendrier/
  page.tsx                    ← RSC principal
  loading.tsx                 ← skeleton

app/(admin)/admin/calendrier/
  page.tsx                    ← RSC admin (même logique)

lib/actions/calendrier/
  getCalendrierData.ts        ← Server Action unique : agrège toutes les sources

components/calendrier/
  CalendrierVueSemaine.tsx    ← grille 7 colonnes
  CalendrierVueMois.tsx       ← grille mensuelle
  CalendrierFiltres.tsx       ← dropdowns service/bureau + switch vue + navigation
  StatutCell.tsx              ← badge coloré par statut
```

---

## 4. Modèle de données

### Types TypeScript

```ts
type StatutJour =
  | 'present'
  | 'absent'
  | 'conge'
  | 'ferie'
  | 'weekend'
  | 'vide'

type JourCalendrier = {
  date: string         // ISO : "2026-03-13"
  statut: StatutJour
  typeConge?: string   // si statut === 'conge' : "CA", "maladie", etc.
}

type TravailleurCalendrier = {
  id: string
  prenom: string
  nom: string
  service: string      // nom du service
  jours: JourCalendrier[]
}
```

### Server Action : `getCalendrierData`

**Signature :**
```ts
async function getCalendrierData(params: {
  dateDebut: string   // ISO
  dateFin: string     // ISO
  serviceId?: string  // uuid
  bureauId?: string   // uuid
}): Promise<TravailleurCalendrier[]>
```

**Requêtes DB :**
1. `profiles` — liste des travailleurs actifs, filtrés par `service_id` si `serviceId` fourni
2. `day_statuses` — statuts réels pour la plage (passé)
3. `conges` — congés avec `statut = 'approuve'` dont la plage chevauche `[dateDebut, dateFin]`
4. `user_bureau_schedule` — si `bureauId` fourni, pour filtrer les travailleurs présents dans ce bureau sur chaque jour de semaine concerné

---

## 5. Logique d'agrégation par case (travailleur × jour)

Priorité décroissante :

| Priorité | Condition | Statut retourné |
|---|---|---|
| 1 | Samedi ou dimanche | `weekend` |
| 2 | Jour férié belge (liste statique) | `ferie` |
| 3 | Congé approuvé couvrant cette date | `conge` + `typeConge` |
| 4 | `day_statuses` présent pour ce jour | `present` ou `absent` |
| 5 | Aucune donnée (futur ou passé sans pointage) | `vide` |

**Jours fériés belges** : liste statique côté serveur (Nouvel An, Pâques+lundi, Fête du Travail, Ascension, Pentecôte+lundi, Fête Nationale, Assomption, Toussaint, Armistice, Noël). Pas de table DB.

### Filtre bureau

Le filtre bureau est jour-dépendant : un travailleur peut être à Namur le lundi et Libramont le mardi. Pour chaque jour de la plage, on vérifie si le travailleur a une entrée `user_bureau_schedule` avec `bureau_id = bureauId` pour ce `jour` (1=Lundi…5=Vendredi). Les "permanents sur la route" (aucune entrée) sont exclus si un bureau est sélectionné.

---

## 6. Interface utilisateur

### Barre de filtres (CalendrierFiltres)

```
[← Préc]  [Semaine du 9 au 15 mars 2026]  [Suiv →]  [Aujourd'hui]
[Service ▾]  [Bureau ▾]  [Vue: Semaine | Mois]
```

Tous les contrôles déclenchent un `router.push` avec les searchParams mis à jour.

### Vue Semaine (CalendrierVueSemaine)

Grille : 1 colonne fixe (nom travailleur) + 7 colonnes (Lun→Dim).

```
                  Lun 10  Mar 11  Mer 12  Jeu 13  Ven 14  Sam  Dim
─── Service Admin ────────────────────────────────────────────────
Marie Dupont       [P]     [P]     [C]     [P]     [P]    [—]  [—]
Jean Martin        [P]     [A]     [P]     [P]     [P]    [—]  [—]
─── Juridique ────────────────────────────────────────────────────
...
```

Travailleurs groupés par service avec séparateurs visuels.

### Vue Mois (CalendrierVueMois)

Même grille, 28–31 colonnes. Noms raccourcis (prénom initial + nom). Desktop uniquement.

### Composant StatutCell

| Statut | Couleur fond | Lettre | Tooltip |
|---|---|---|---|
| `present` | vert (`bg-green-100 text-green-800`) | P | "Présent" |
| `absent` | rouge (`bg-red-100 text-red-800`) | A | "Absent" |
| `conge` | orange (`bg-orange-100 text-orange-800`) | C | type de congé |
| `ferie` | bleu clair (`bg-blue-100 text-blue-800`) | F | nom du jour férié |
| `weekend` | gris clair (`bg-gray-100 text-gray-400`) | — | — |
| `vide` | blanc (`bg-white text-gray-300`) | — | "Non renseigné" |

### Responsive

- Vue semaine : scroll horizontal sur mobile, colonne nom fixe (sticky left)
- Vue mois : masquée sur mobile (`hidden md:block`), message "Utilisez la vue semaine sur mobile"

---

## 7. Navigation

| Action | Comportement |
|---|---|
| Flèche ← (semaine) | `date` = lundi semaine précédente |
| Flèche → (semaine) | `date` = lundi semaine suivante |
| Flèche ← (mois) | `date` = 1er du mois précédent |
| Flèche → (mois) | `date` = 1er du mois suivant |
| Aujourd'hui | `date` = lundi de la semaine courante (vue semaine) ou 1er du mois courant (vue mois) |

---

## 8. Sécurité & permissions

- `/calendrier` : middleware vérifie session active (tout utilisateur connecté)
- `/admin/calendrier` : middleware vérifie `is_admin_rh = true`
- `getCalendrierData` : utilise `createServerClient()` (RLS actif) — les travailleurs ne voient que les profils actifs
- Aucune action de modification dans ce module (lecture seule)

---

## 9. Hors périmètre

- Modification des statuts depuis le calendrier (reste dans M2 Admin Recap)
- Export PDF/Excel du calendrier (Module 6)
- Notifications de présence
- Calendrier d'équipe en temps réel
