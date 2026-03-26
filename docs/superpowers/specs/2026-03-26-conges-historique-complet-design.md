# Congés & Absences — Historique complet, annulation et pot d'heures

**Date :** 2026-03-26
**Statut :** Approuvé

---

## Contexte

La page travailleur `/conges` existante permet de demander des congés (VA, RC, récup, maladie) et de voir les demandes récentes. Il manque :

- L'historique complet des congés VA et RC
- L'historique des heures supplémentaires avec le détail du décompte du pot d'heures
- La possibilité d'annuler un congé approuvé à venir (avec validation RH)
- Un graphique d'évolution du pot d'heures

## Structure de la page

Page unique `/conges` refaite en sections accordéon sur une seule colonne scrollable :

1. **En-tête** — titre + boutons "Demander un congé" et "Signaler maladie" (ouvrent des drawers Sheet)
2. **Soldes** (toujours visible) — 3 cards côte à côte : VA, RC, Pot d'heures. Chaque card : total, pris, reliquat, reste. Barres de progression linéaires.
3. **Accordéon : Demandes en cours** (ouvert par défaut) — congés `en_attente` + demandes d'annulation `en_attente`. Bouton annuler sur `en_attente`. Bouton "demander l'annulation" sur `approuve` à venir.
4. **Accordéon : Historique congés VA & RC** — tableau filtrable par année, trié par date desc. Colonnes : type, statut, dates, nb jours, commentaire admin.
5. **Accordéon : Heures supplémentaires** — demandes HS (liste + bouton nouvelle demande) + graphique d'évolution du pot + journal des mouvements.
6. **Formulaires** — DemandeCongeForm et SignalementMaladieForm dans des Sheet (drawer droit).

## Modèle de données

### Nouvelle table `annulations_conges`

```sql
CREATE TABLE annulations_conges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conge_id UUID NOT NULL REFERENCES conges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motif TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
  commentaire_admin TEXT,
  traite_par UUID REFERENCES auth.users(id),
  traite_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE annulations_conges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers see own annulations"
  ON annulations_conges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Workers insert own annulations"
  ON annulations_conges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins full access annulations"
  ON annulations_conges FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### Modification du type StatutConge

Ajout de `'annule'` au type existant :

```typescript
export type StatutConge = 'en_attente' | 'approuve' | 'refuse' | 'annule'
```

### Query mouvements pot d'heures (server action, pas vue SQL)

Union de 4 sources pour construire le journal :

| Source | Type mouvement | Delta |
|---|---|---|
| `demandes_heures_sup` approuvées | `hs_approuvee` | +nb_minutes |
| `conges` type `recuperation` approuvés | `recup_prise` | -nb_minutes (calculé depuis nb_jours × minutes/jour selon option_horaire) |
| `corrections_pointage` refusées avec minutes_deduites > 0 | `deduction_correction` | -minutes_deduites |
| `audit_logs` catégorie `pot_heures` action correction manuelle | `correction_admin` | ±delta extrait du metadata |

Chaque mouvement : date, type, description, delta_minutes, solde_apres (calculé par window function cumulative).

## Logique métier — Annulation de congé approuvé

### Flux travailleur

1. Clic "Demander l'annulation" sur un congé `approuve` dont `date_debut > today`
2. Saisie d'un motif obligatoire dans une mini modale
3. Insert `annulations_conges` statut `en_attente`
4. Le congé reste actif — pas de changement tant que le RH n'a pas validé
5. Notification RH (widget demandes en attente)

### Flux RH — approbation

Dans une transaction :

1. `annulations_conges.statut = 'approuve'`, `traite_par`, `traite_le`
2. `conges.statut = 'annule'`
3. Recréditer soldes :
   - VA : `soldes_conges.conges_annuels_pris -= nb_jours`
   - RC : `soldes_conges.repos_comp_pris -= nb_jours`
   - Récup : `pot_heures.solde_minutes += minutes_deduites` (recalculé)
4. Supprimer `day_statuses` pour user_id + plage date_debut→date_fin
5. Supprimer/annuler `reassignations_temporaires` liées au conge_id
6. Audit log
7. Email notification travailleur

### Flux RH — refus

1. `annulations_conges.statut = 'refuse'` + commentaire obligatoire
2. Congé inchangé
3. Notification travailleur

### Garde-fous

- Impossible de demander l'annulation d'un congé passé (`date_debut <= today`)
- Une seule demande d'annulation active (`en_attente`) par congé
- Le statut `annule` est final
- Les congés `en_attente` gardent le système d'annulation directe existant (suppression)

## Graphique pot d'heures

- Courbe linéaire SVG inline (pas de lib externe)
- Axe X : dates des mouvements, année en cours
- Axe Y : solde en heures:minutes
- Points colorés par type :
  - Vert : ajout HS
  - Orange : récup prise
  - Rouge : déduction correction
  - Bleu : correction admin
- Tooltip au hover (date + description + delta)
- Masqué sur mobile, remplacé par un message

## Journal des mouvements

- Tableau sous le graphique
- Colonnes : Date | Type (badge couleur) | Description | +/- | Solde après
- Trié par date décroissante
- Filtrable par année (select)
- Badges :
  - Vert "HS" — heures sup approuvées
  - Orange "Récup" — récupération prise
  - Rouge "Déduction" — correction refusée
  - Bleu "Admin" — correction manuelle

## Composants

| Composant | Fichier | Rôle |
|---|---|---|
| `CongesPage` (server) | `app/(dashboard)/conges/page.tsx` | Fetch initial, layout |
| `CongesPageClient` | `components/conges/CongesPageClient.tsx` | State accordéons, drawers |
| `SoldesCards` | `components/conges/SoldesCards.tsx` | 3 cards VA/RC/Pot toujours visibles |
| `DemandesEnCours` | `components/conges/DemandesEnCours.tsx` | Congés en_attente + annulations, boutons |
| `DemandeAnnulationModal` | `components/conges/DemandeAnnulationModal.tsx` | Modale motif annulation |
| `HistoriqueConges` | `components/conges/HistoriqueConges.tsx` | Tableau filtrable VA+RC par année |
| `HeuresSupSection` | `components/conges/HeuresSupSection.tsx` | Container HS : demandes + graphique + journal |
| `PotHeuresChart` | `components/conges/PotHeuresChart.tsx` | Graphique SVG évolution pot |
| `JournalMouvements` | `components/conges/JournalMouvements.tsx` | Tableau mouvements pot |
| `DemandeCongeForm` | existant | Ouvert dans Sheet |
| `SignalementMaladieForm` | existant | Ouvert dans Sheet |

## Server actions

| Action | Fichier | Rôle |
|---|---|---|
| `demanderAnnulationCongeAction` | `lib/conges/actions.ts` | Créer demande d'annulation |
| `traiterAnnulationCongeAction` | `lib/conges/admin-actions.ts` | Approuver/refuser annulation (admin) |
| `getMouvementsPotHeuresAction` | `lib/heures-sup/actions.ts` | Query union 4 sources + window function |
| `getHistoriqueCongesAction` | `lib/conges/actions.ts` | Congés filtrés par année pour le travailleur |
| `getAnnulationsEnCoursAction` | `lib/conges/actions.ts` | Annulations en_attente pour le travailleur |

## Style

- Cards : `rounded-xl border border-gray-200 bg-white`
- Accordéons : `useState` par section, transition smooth, chevron rotatif
- Badges statut : mêmes couleurs que le reste de l'app (amber en_attente, green approuvé, red refusé, gray annulé)
- Drawers : composant Sheet shadcn/ui existant
- Responsive : graphique masqué mobile, tableaux scroll horizontal
