-- Migration: Ajout colonne corrections_appliquees à la table pointage
-- Stocke quels champs de pointage ont été corrigés manuellement (par admin)
-- Nécessaire pour les indicateurs feu tricolore du calendrier

ALTER TABLE pointage
ADD COLUMN IF NOT EXISTS corrections_appliquees jsonb DEFAULT '{}'::jsonb;
