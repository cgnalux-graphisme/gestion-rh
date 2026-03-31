-- Migration: Ajout support demi-journée pour les congés
-- Permet de prendre un congé d'une demi-journée (matin ou après-midi)

-- 1. Ajouter la colonne demi_journee (null = journée complète)
ALTER TABLE conges
  ADD COLUMN IF NOT EXISTS demi_journee text
  CHECK (demi_journee IN ('matin', 'apres_midi'));

-- 2. Changer nb_jours de integer à numeric pour supporter 0.5
-- (si déjà numeric, cette opération est un no-op)
ALTER TABLE conges
  ALTER COLUMN nb_jours TYPE numeric USING nb_jours::numeric;

-- 3. Contrainte: demi_journee uniquement si date_debut = date_fin (jour unique)
ALTER TABLE conges
  ADD CONSTRAINT chk_demi_journee_jour_unique
  CHECK (demi_journee IS NULL OR date_debut = date_fin);

-- 4. Contrainte: si demi_journee est set, nb_jours doit être 0.5
ALTER TABLE conges
  ADD CONSTRAINT chk_demi_journee_nb_jours
  CHECK (demi_journee IS NULL OR nb_jours = 0.5);

-- 5. Mettre à jour les colonnes soldes_conges pour supporter les décimales (0.5)
ALTER TABLE soldes_conges
  ALTER COLUMN conges_annuels_pris TYPE numeric USING conges_annuels_pris::numeric,
  ALTER COLUMN repos_comp_pris TYPE numeric USING repos_comp_pris::numeric,
  ALTER COLUMN conges_annuels_total TYPE numeric USING conges_annuels_total::numeric,
  ALTER COLUMN repos_comp_total TYPE numeric USING repos_comp_total::numeric,
  ALTER COLUMN reliquat_conges_annuels TYPE numeric USING reliquat_conges_annuels::numeric,
  ALTER COLUMN reliquat_repos_comp TYPE numeric USING reliquat_repos_comp::numeric;
