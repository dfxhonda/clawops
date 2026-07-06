-- Throttle rolling-window query index (repo-parity backfill, already live).
CREATE INDEX IF NOT EXISTS idx_auth_logs_staff_created
  ON public.auth_logs (staff_id, created_at DESC);
