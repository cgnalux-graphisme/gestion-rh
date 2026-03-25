# Spec : Modal de traitement de congé enrichi avec couverture et réaffectation

**Date** : 2026-03-25
**Statut** : Approuvé
**Contexte** : Le RH manque d'informations pour prendre une décision éclairée lors du traitement d'une demande de congé.

---

## Problème

Le modal d'approbation actuel (`CongeApprovalModal`) affiche uniquement : nom du travailleur, type de congé, dates, durée, commentaire et certificat médical. Le RH ne peut pas savoir :

- Si le travailleur a assez de jours de congé restants
- Si le bureau sera couvert pendant l'absence
- S'il peut réaffecter quelqu'un pour couvrir

---

## Solution

Transformer le modal en **drawer latéral large** avec 4 zones d'information + un bloc décision.

---

## Design détaillé

### Zone 1 — Résumé de la demande (existant, amélioré)

- Nom complet du travailleur
- Type de congé (congé annuel, repos compensatoire, récupération, maladie, autre)
- Dates (début → fin), durée en jours ouvrables
- Commentaire du travailleur (si présent)
- Lien vers certificat médical (si type = maladie et pièce jointe fournie)

### Zone 2 — Soldes du travailleur

Afficher **tous les soldes** du travailleur pour l'année en cours :

| Solde | Calcul |
|-------|--------|
| Congés annuels | `total - pris` (+ reliquat si applicable) |
| Repos compensatoire | `total - pris` |
| Récupération (pot d'heures) | `solde_minutes` converti en jours selon `option_horaire` (A=438min/j, B=408min/j) |

**Alertes visuelles** :
- Si le solde **après approbation** sera négatif → bandeau rouge "⚠ Solde insuffisant : passera à X jours"
- Si le solde **après approbation** sera à 0 → bandeau orange "⚠ Solde sera épuisé"
- Sinon → affichage vert du solde restant après approbation

### Zone 3 — Couverture du bureau

Pour **chaque jour ouvrable** de la période demandée :

- Identifier le bureau affecté au demandeur ce jour-là (via `user_bureau_schedule` pour le `jour` correspondant au jour de la semaine)
- Lister tous les travailleurs normalement affectés au même `bureau_id` ce jour-là (tous secteurs/services confondus)
- Pour chacun, afficher son statut :
  - ✅ Présent (pas d'entrée dans `day_statuses` ou statut normal)
  - 🏖 En congé (day_status = C, R)
  - 🤒 Maladie (day_status = M)
  - ❌ Absent (autres statuts d'absence)
  - 👤 Le demandeur lui-même (grisé)

**Indicateur de couverture** par jour :
- Format : "X/Y présents" (Y = total affectés hors demandeur, X = ceux qui sont présents)
- Couleur : vert (>50%), orange (=50%), rouge (<50% ou 0)
- Si 0 présent → alerte "⚠ Bureau non couvert le [date]"

### Zone 4 — Réaffectation (optionnelle, conditionnelle)

Apparaît **uniquement si un problème de couverture est détecté** (au moins un jour avec <50% de présence ou 0 présent).

Pour chaque jour problématique :
- Liste des travailleurs **disponibles** : présents ce jour-là, pas affectés au bureau en question, pas en congé/maladie
- Chaque travailleur disponible a un bouton "Réaffecter"
- Cliquer crée une `reassignation_temporaire` en statut `en_attente`
- Le travailleur réaffecté reçoit :
  - **Notification in-app** (pastille + bandeau dashboard)
  - **Email automatique** avec détails (date, bureau, raison, nom du collègue absent)
- Le travailleur doit **confirmer ou refuser** dans l'app
- Si **refus** → le RH est notifié, peut choisir un autre travailleur
- **Non bloquant** : le RH peut approuver le congé à tout moment, même sans réaffectation effective

### Zone décision (toujours visible, en bas du drawer)

- Textarea : commentaire admin (optionnel)
- Bouton "Approuver" (vert)
- Bouton "Refuser" (rouge)
- Le RH n'est PAS obligé d'attendre la confirmation de réaffectation pour décider

---

## Modèle de données

### Nouvelle table : `reassignations_temporaires`

```sql
CREATE TABLE reassignations_temporaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conge_id UUID NOT NULL REFERENCES conges(id) ON DELETE CASCADE,
  travailleur_id UUID NOT NULL REFERENCES profiles(id),
  bureau_id UUID NOT NULL REFERENCES bureaux(id),
  date DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'accepte', 'refuse')),
  demande_par UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  repondu_le TIMESTAMPTZ,
  commentaire TEXT,
  vu_par_travailleur BOOLEAN DEFAULT false,

  UNIQUE(travailleur_id, date, bureau_id)
);

CREATE INDEX idx_reassignations_bureau_date ON reassignations_temporaires(bureau_id, date);
CREATE INDEX idx_reassignations_travailleur_statut ON reassignations_temporaires(travailleur_id, statut);
CREATE INDEX idx_reassignations_conge ON reassignations_temporaires(conge_id);
```

### RLS Policies

```sql
-- Travailleur : lecture/modification de ses propres réaffectations
CREATE POLICY "Travailleur voit ses reassignations"
  ON reassignations_temporaires FOR SELECT
  USING (travailleur_id = auth.uid());

CREATE POLICY "Travailleur repond a ses reassignations"
  ON reassignations_temporaires FOR UPDATE
  USING (travailleur_id = auth.uid())
  WITH CHECK (travailleur_id = auth.uid());

-- Admin RH : accès complet
CREATE POLICY "Admin RH acces complet reassignations"
  ON reassignations_temporaires FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  );
```

### Tables existantes utilisées (lecture seule)

- `conges` : la demande en cours
- `profiles` : info travailleur (nom, service_id, option_horaire)
- `soldes_conges` : soldes de l'année (conges_annuels_total/pris, repos_comp_total/pris, reliquat)
- `pot_heures` : solde_minutes pour récupération
- `user_bureau_schedule` : affectations bureau par jour de semaine
- `day_statuses` : statuts journaliers (congé, maladie, absence)
- `bureaux` : nom et code du bureau

---

## Flux de notifications

### Pour le travailleur réaffecté

1. Insertion dans `reassignations_temporaires` → `vu_par_travailleur = false`
2. Email via `sendReassignationEmail()` (non bloquant, dans un try/catch)
3. Notification in-app :
   - `getNotificationCounts()` ajoute `reassignationsEnAttente` (count where `travailleur_id = user AND statut = 'en_attente' AND vu_par_travailleur = false`)
   - Badge Accueil = total existant + reassignationsEnAttente
   - `NotificationsBanner` affiche "Demande de réaffectation : Bureau [X] le [date] pour remplacer [Nom]" avec boutons Accepter/Refuser
4. Réponse du travailleur → `repondreReassignation(id, accepte, commentaire)`
   - Met à jour `statut`, `repondu_le`, `commentaire`
   - Si refus → notification RH

### Pour le RH

- Quand une réaffectation est refusée :
  - Pastille incrémentée sur "Congés RH" dans la sidebar
  - `getNotificationCounts()` ajoute `reassignationsRefusees` côté admin
- Dans le drawer du congé concerné, le statut de chaque réaffectation se met à jour

### Intégration système existant

- `lib/notifications/counts.ts` : étendre `NotificationCounts` avec `reassignationsEnAttente` (worker) et `reassignationsRefusees` (admin)
- `lib/notifications/actions.ts` : étendre `getUnreadDecisions()` et `markDecisionVue()` pour le type `reassignation`
- `components/dashboard/NotificationsBanner.tsx` : nouveau type de carte pour les réaffectations avec Accepter/Refuser

---

## Fichiers impactés

| Fichier | Action | Description |
|---------|--------|-------------|
| `components/admin/CongeApprovalModal.tsx` | Réécriture | Transformer en drawer avec 4 zones |
| `lib/conges/admin-actions.ts` | Ajout | `getCongeContext(congeId)` — charge soldes, couverture, disponibilités |
| `lib/conges/admin-actions.ts` | Ajout | `creerReassignation(congeId, travailleurId, bureauId, date)` |
| `lib/reassignations/actions.ts` | Nouveau | `getReassignationsEnAttente()`, `repondreReassignation(id, accepte, commentaire)` |
| `lib/notifications/counts.ts` | Modification | Ajouter compteurs reassignation worker + admin |
| `lib/notifications/actions.ts` | Modification | Ajouter type reassignation dans decisions |
| `components/dashboard/NotificationsBanner.tsx` | Modification | Carte réaffectation avec Accepter/Refuser |
| `types/database.ts` | Ajout | Type `ReassignationTemporaire` |
| Migration Supabase | Nouveau | Table + index + RLS |

---

## Contraintes et décisions

1. **Non bloquant** : le RH peut toujours approuver/refuser un congé indépendamment de l'état des réaffectations
2. **Réaffectation = proposition** : le travailleur réaffecté doit confirmer, ce n'est pas imposé
3. **Refus = notification** : le RH est notifié et peut choisir un autre travailleur ou ignorer
4. **Périmètre couverture** : tous les travailleurs du même bureau, tous services/secteurs confondus
5. **Email non bloquant** : l'envoi d'email est en try/catch, un échec n'empêche pas la réaffectation
6. **Soldes contextuels** : alerte rouge si négatif après approbation, orange si zéro, vert sinon
