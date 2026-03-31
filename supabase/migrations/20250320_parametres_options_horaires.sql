-- Migration: parametres_options table
-- Stores configurable work schedule parameters for Option A and Option B

CREATE TABLE parametres_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_horaire text NOT NULL CHECK (option_horaire IN ('A', 'B')),
  heures_semaine numeric(4,1) NOT NULL,
  horaires jsonb NOT NULL,
  horaires_ete jsonb NOT NULL,
  conges_annuels_defaut integer NOT NULL DEFAULT 20,
  repos_comp_defaut integer NOT NULL DEFAULT 0,
  pot_heures_initial integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_horaire)
);

-- Enable RLS
ALTER TABLE parametres_options ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read
CREATE POLICY "Authenticated users can read parametres_options"
  ON parametres_options
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only admin_rh
CREATE POLICY "Admin RH can insert parametres_options"
  ON parametres_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin_rh = true
    )
  );

-- UPDATE: only admin_rh
CREATE POLICY "Admin RH can update parametres_options"
  ON parametres_options
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin_rh = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin_rh = true
    )
  );

-- Seed default data

-- Option A: 36.5h/week
INSERT INTO parametres_options (option_horaire, heures_semaine, horaires, horaires_ete, conges_annuels_defaut, repos_comp_defaut, pot_heures_initial)
VALUES (
  'A',
  36.5,
  '{
    "1": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "2": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "3": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "4": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "5": {"debut": "08:00", "fin": "15:30", "pause_midi": 60}
  }'::jsonb,
  '{
    "1": {"debut": "08:00", "fin": "14:00", "pause_midi": 0},
    "2": {"debut": "08:00", "fin": "14:00", "pause_midi": 0},
    "3": {"debut": "08:00", "fin": "14:00", "pause_midi": 0},
    "4": {"debut": "08:00", "fin": "14:00", "pause_midi": 0},
    "5": {"debut": "08:00", "fin": "14:00", "pause_midi": 0}
  }'::jsonb,
  20,
  0,
  0
);

-- Option B: 34h/week
INSERT INTO parametres_options (option_horaire, heures_semaine, horaires, horaires_ete, conges_annuels_defaut, repos_comp_defaut, pot_heures_initial)
VALUES (
  'B',
  34.0,
  '{
    "1": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "2": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "3": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "4": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "5": {"debut": "08:00", "fin": "12:00", "pause_midi": 0}
  }'::jsonb,
  '{
    "1": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "2": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "3": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "4": {"debut": "08:00", "fin": "16:30", "pause_midi": 60},
    "5": {"debut": "08:00", "fin": "12:00", "pause_midi": 0}
  }'::jsonb,
  20,
  0,
  0
);
