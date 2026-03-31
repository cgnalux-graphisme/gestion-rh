-- Migration: Enrichir corrections_pointage + pointage pour le système de feu tricolore
-- Date: 2026-03-26

-- 1. Ajouter les colonnes manquantes à corrections_pointage
ALTER TABLE corrections_pointage
  ADD COLUMN IF NOT EXISTS vu_par_travailleur boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minutes_deduites integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS heure_corrigee text DEFAULT NULL;

-- 2. Ajouter le suivi des corrections appliquées au pointage
ALTER TABLE pointage
  ADD COLUMN IF NOT EXISTS corrections_appliquees jsonb DEFAULT '{}';

-- 3. Commentaires
COMMENT ON COLUMN corrections_pointage.vu_par_travailleur IS 'Le travailleur a-t-il vu la décision';
COMMENT ON COLUMN corrections_pointage.minutes_deduites IS 'Minutes déduites du pot heures si refus avec déduction';
COMMENT ON COLUMN corrections_pointage.heure_corrigee IS 'Heure effectivement appliquée (HH:mm) si approuvé';
COMMENT ON COLUMN pointage.corrections_appliquees IS 'Champs corrigés par le RH: {"arrivee": true, ...}';
