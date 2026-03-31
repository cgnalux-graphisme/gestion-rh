-- Audit log: tracks all significant changes on worker data
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,          -- e.g. 'conge.demande', 'pot_heures.correction', 'regime.create'
  category TEXT NOT NULL,        -- e.g. 'conges', 'pointage', 'heures_sup', 'regime', 'profil', 'admin'
  description TEXT NOT NULL,     -- Human-readable description
  metadata JSONB DEFAULT '{}',   -- Structured data (old/new values, amounts, etc.)
  commentaire TEXT,              -- Optional comment (admin or worker)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by worker
CREATE INDEX idx_audit_log_target_user ON audit_log(target_user_id, created_at DESC);
-- Index for filtering by category
CREATE INDEX idx_audit_log_category ON audit_log(target_user_id, category, created_at DESC);

-- RLS: admins can read all, workers can read their own
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin_rh = true)
);

CREATE POLICY "Workers can read own audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (target_user_id = auth.uid());

-- Insert policy: any authenticated user (server actions use service role anyway)
CREATE POLICY "Authenticated users can insert audit logs"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (true);
