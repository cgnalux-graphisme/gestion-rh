-- ============================================================
-- Fixes pré-production — 2026-04-01
-- #2  Incrément atomique des soldes congés (race condition)
-- #7  Table rate-limiting pour les endpoints auth
-- ============================================================

-- ─── Fix #2 : RPC incrément atomique sur soldes_conges ───────

CREATE OR REPLACE FUNCTION incrementer_solde_conges(
  p_user_id UUID,
  p_annee   INT,
  p_champ   TEXT,      -- 'conges_annuels_pris' ou 'repos_comp_pris'
  p_delta   NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_champ = 'conges_annuels_pris' THEN
    UPDATE soldes_conges
       SET conges_annuels_pris = conges_annuels_pris + p_delta,
           updated_at          = NOW()
     WHERE user_id = p_user_id
       AND annee   = p_annee;
  ELSIF p_champ = 'repos_comp_pris' THEN
    UPDATE soldes_conges
       SET repos_comp_pris = repos_comp_pris + p_delta,
           updated_at      = NOW()
     WHERE user_id = p_user_id
       AND annee   = p_annee;
  ELSE
    RAISE EXCEPTION 'Champ invalide: %', p_champ;
  END IF;
END;
$$;


-- ─── Fix #7 : Rate limiting pour l'authentification ──────────

CREATE TABLE IF NOT EXISTS login_attempts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    TEXT         NOT NULL,          -- email
  attempt_count INT          NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier
  ON login_attempts(identifier);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- Pas de policy = seul le service_role (admin client) y accède
