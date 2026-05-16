-- J-FRAUD-01: audit_log tamper-evident table with SHA256 hash chain
-- Production apply: supabase db push (requires ヒロ approval)
-- Acceptance:
--   1. stores UPDATE → audit_log INSERT 確認
--   2. audit_log UPDATE/DELETE → RLS block 確認
--   3. 既存テーブル無影響

-- ============================================================
-- 1. Table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial        PRIMARY KEY,
  table_name    text             NOT NULL,
  record_id     text             NOT NULL,
  operation     text             NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  before        jsonb,
  after         jsonb,
  user_id       text,
  gps_lat       double precision,
  gps_lng       double precision,
  ip_address    text,
  device_info   text,
  created_at    timestamptz      NOT NULL DEFAULT now(),
  previous_hash text             NOT NULL DEFAULT '',
  this_hash     text             NOT NULL
);

-- Index for hash-chain lookup (latest row per table)
CREATE INDEX IF NOT EXISTS idx_audit_log_table_id
  ON audit_log (table_name, id DESC);

-- ============================================================
-- 2. RLS — INSERT-only via trigger; SELECT admin only; no UPDATE/DELETE
-- ============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users with role='admin' in JWT
CREATE POLICY "audit_log_select_admin"
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (COALESCE(auth.jwt()->>'role', '') = 'admin');

-- No INSERT policy from app — only the SECURITY DEFINER trigger inserts.
-- No UPDATE / DELETE policies — omitting them means no rows are modifiable.

-- ============================================================
-- 3. Trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION log_to_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id  text;
  v_before     jsonb;
  v_after      jsonb;
  v_row_data   jsonb;
  v_prev_hash  text;
  v_this_hash  text;
  v_user_id    text;
BEGIN
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_before   := NULL;
      v_after    := to_jsonb(NEW);
      v_row_data := v_after;
    WHEN 'UPDATE' THEN
      v_before   := to_jsonb(OLD);
      v_after    := to_jsonb(NEW);
      v_row_data := v_after;
    WHEN 'DELETE' THEN
      v_before   := to_jsonb(OLD);
      v_after    := NULL;
      v_row_data := v_before;
  END CASE;

  -- Extract primary key (try common PK column names)
  v_record_id := COALESCE(
    v_row_data->>'id',
    v_row_data->>'reading_id',
    v_row_data->>'session_id',
    v_row_data->>'order_id',
    'unknown'
  );

  -- Current user from JWT (SECURITY DEFINER: auth.uid() still works via session context)
  v_user_id := auth.uid()::text;

  -- Previous hash for this table (for hash chain)
  SELECT COALESCE(this_hash, '')
  INTO v_prev_hash
  FROM audit_log
  WHERE table_name = TG_TABLE_NAME
  ORDER BY id DESC
  LIMIT 1;

  v_prev_hash := COALESCE(v_prev_hash, '');

  -- Hash chain: SHA256(previous_hash || table_name || record_id || op || before || after || now)
  v_this_hash := encode(
    sha256((
      v_prev_hash
      || TG_TABLE_NAME
      || v_record_id
      || TG_OP
      || COALESCE(v_before::text, '')
      || COALESCE(v_after::text, '')
      || now()::text
    )::bytea),
    'hex'
  );

  INSERT INTO audit_log (
    table_name, record_id, operation,
    before, after,
    user_id, created_at,
    previous_hash, this_hash
  ) VALUES (
    TG_TABLE_NAME, v_record_id, TG_OP,
    v_before, v_after,
    v_user_id, now(),
    v_prev_hash, v_this_hash
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 4. Triggers on target tables
--    Wrapped in DO blocks: tables that don't exist locally are skipped silently.
-- ============================================================

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON meter_readings;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON meter_readings
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON patrol_records;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON patrol_records
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON stocktake_items;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON stocktake_items
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON stock_movements;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON prize_orders;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON prize_orders
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON prize_arrivals;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON prize_arrivals
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON stores;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON stores
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON cranes;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON cranes
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON prizes;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON prizes
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_audit_log ON staff_pinned_stores;
  CREATE TRIGGER trg_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON staff_pinned_stores
    FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
EXCEPTION WHEN undefined_table THEN NULL;
END; $$;
