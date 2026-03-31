-- ═══════════════════════════════════════════════════════════
-- Annulations de congés approuvés + recup_minutes
-- ═══════════════════════════════════════════════════════════

-- 1. Table annulations_conges
CREATE TABLE IF NOT EXISTS annulations_conges (
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

-- Une seule demande d'annulation active par congé
CREATE UNIQUE INDEX IF NOT EXISTS idx_annulations_conges_unique_pending
  ON annulations_conges (conge_id)
  WHERE statut = 'en_attente';

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
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
  );

-- 2. Ajouter recup_minutes sur conges (minutes réelles pour récupération)
ALTER TABLE conges ADD COLUMN IF NOT EXISTS recup_minutes INTEGER DEFAULT NULL;
COMMENT ON COLUMN conges.recup_minutes IS 'Minutes de récupération demandées (rempli uniquement pour type=recuperation)';

-- 3. Ajouter statut annule au CHECK constraint de conges
-- D'abord supprimer l'ancien CHECK s'il existe, puis recréer
DO $$
BEGIN
  -- Vérifier si la contrainte existe et la supprimer
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'conges' AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%statut%'
  ) THEN
    EXECUTE format('ALTER TABLE conges DROP CONSTRAINT %I',
      (SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name = 'conges' AND constraint_type = 'CHECK'
       AND constraint_name LIKE '%statut%' LIMIT 1));
  END IF;
END $$;

ALTER TABLE conges ADD CONSTRAINT conges_statut_check
  CHECK (statut IN ('en_attente', 'approuve', 'refuse', 'annule'));

-- 4. Fonction RPC pour approuver une annulation (transaction atomique)
CREATE OR REPLACE FUNCTION approuver_annulation_conge(
  p_annulation_id UUID,
  p_admin_id UUID
) RETURNS void AS $$
DECLARE
  v_conge RECORD;
  v_annulation RECORD;
  v_annee INTEGER;
BEGIN
  -- Verrouiller l'annulation
  SELECT * INTO v_annulation FROM annulations_conges WHERE id = p_annulation_id FOR UPDATE;
  IF v_annulation IS NULL THEN RAISE EXCEPTION 'Annulation introuvable';
  END IF;
  IF v_annulation.statut != 'en_attente' THEN RAISE EXCEPTION 'Annulation déjà traitée';
  END IF;

  -- Verrouiller le congé
  SELECT * INTO v_conge FROM conges WHERE id = v_annulation.conge_id FOR UPDATE;
  IF v_conge IS NULL THEN RAISE EXCEPTION 'Congé introuvable';
  END IF;
  IF v_conge.statut != 'approuve' THEN RAISE EXCEPTION 'Le congé n''est pas approuvé';
  END IF;

  v_annee := EXTRACT(YEAR FROM v_conge.date_debut::date);

  -- 1. Marquer l'annulation comme approuvée
  UPDATE annulations_conges SET
    statut = 'approuve',
    traite_par = p_admin_id,
    traite_le = now()
  WHERE id = p_annulation_id;

  -- 2. Marquer le congé comme annulé
  UPDATE conges SET statut = 'annule' WHERE id = v_conge.id;

  -- 3. Recréditer les soldes selon le type
  IF v_conge.type = 'conge_annuel' THEN
    UPDATE soldes_conges SET
      conges_annuels_pris = GREATEST(0, conges_annuels_pris - v_conge.nb_jours),
      updated_at = now()
    WHERE user_id = v_conge.user_id AND annee = v_annee;

  ELSIF v_conge.type = 'repos_comp' THEN
    UPDATE soldes_conges SET
      repos_comp_pris = GREATEST(0, repos_comp_pris - v_conge.nb_jours),
      updated_at = now()
    WHERE user_id = v_conge.user_id AND annee = v_annee;

  ELSIF v_conge.type = 'recuperation' AND v_conge.recup_minutes IS NOT NULL THEN
    UPDATE pot_heures SET
      solde_minutes = solde_minutes + v_conge.recup_minutes,
      updated_at = now()
    WHERE user_id = v_conge.user_id AND annee = v_annee;
  END IF;

  -- 4. Supprimer les day_statuses de la période
  DELETE FROM day_statuses
  WHERE user_id = v_conge.user_id
    AND date >= v_conge.date_debut
    AND date <= v_conge.date_fin;

  -- 5. Supprimer les réassignations temporaires liées
  DELETE FROM reassignations_temporaires
  WHERE conge_id = v_conge.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
