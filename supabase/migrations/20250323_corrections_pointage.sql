-- Table for punch correction requests from workers
CREATE TABLE IF NOT EXISTS corrections_pointage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  champ TEXT NOT NULL CHECK (champ IN ('arrivee', 'midi_out', 'midi_in', 'depart')),
  heure_proposee TEXT NOT NULL, -- 'HH:mm'
  motif TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
  commentaire_admin TEXT,
  traite_par UUID REFERENCES auth.users(id),
  traite_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_corrections_pointage_user_date ON corrections_pointage(user_id, date);
CREATE INDEX idx_corrections_pointage_statut ON corrections_pointage(statut);

-- RLS policies
ALTER TABLE corrections_pointage ENABLE ROW LEVEL SECURITY;

-- Workers can read their own corrections
CREATE POLICY "Workers can view own corrections"
  ON corrections_pointage FOR SELECT
  USING (auth.uid() = user_id);

-- Workers can insert their own corrections
CREATE POLICY "Workers can create own corrections"
  ON corrections_pointage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all corrections (via service role / admin client)
-- Admin operations use createAdminClient which bypasses RLS
