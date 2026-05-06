-- M2 棚卸し Stage 1: stocktake_sessions/items を仕様書スキーマで再構築
-- 旧テーブルはデータなし確認済み (2026-05-06)

-- 1. 旧テーブル削除
DROP TABLE IF EXISTS stocktake_items CASCADE;
DROP TABLE IF EXISTS stocktake_sessions CASCADE;

-- 2. stocktake_sessions (1組織1月1セッション)
CREATE TABLE stocktake_sessions (
  session_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(organization_id),
  month           date NOT NULL,
  status          text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','submitted','approved','locked')),
  created_at      timestamptz DEFAULT now(),
  locked_at       timestamptz,
  UNIQUE(organization_id, month)
);

CREATE INDEX idx_stocktake_sessions_org   ON stocktake_sessions(organization_id);
CREATE INDEX idx_stocktake_sessions_month ON stocktake_sessions(month);

-- 3. stocktake_items (セッション×景品×オーナー の複合PK)
CREATE TABLE stocktake_items (
  session_id        uuid NOT NULL REFERENCES stocktake_sessions(session_id) ON DELETE CASCADE,
  prize_id          text NOT NULL REFERENCES prize_masters(prize_id),
  owner_type        text NOT NULL CHECK (owner_type IN ('location','booth','staff')),
  owner_code        text NOT NULL,
  actual_count      integer NOT NULL DEFAULT 0,
  theoretical_count integer,
  variance_rate     numeric GENERATED ALWAYS AS (
    CASE WHEN theoretical_count > 0
         THEN ABS(actual_count - theoretical_count)::numeric / theoretical_count
         ELSE NULL END
  ) STORED,
  recorded_by       text REFERENCES staff(staff_id),
  recorded_at       timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, prize_id, owner_type, owner_code)
);

CREATE INDEX idx_stocktake_items_session ON stocktake_items(session_id);
CREATE INDEX idx_stocktake_items_owner   ON stocktake_items(owner_type, owner_code);

-- 4. RLS
ALTER TABLE stocktake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktake_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read_stocktake_sessions  ON stocktake_sessions FOR SELECT USING (true);
CREATE POLICY anon_write_stocktake_sessions ON stocktake_sessions FOR ALL    USING (true);
CREATE POLICY anon_read_stocktake_items     ON stocktake_items    FOR SELECT USING (true);
CREATE POLICY anon_write_stocktake_items    ON stocktake_items    FOR ALL    USING (true);

-- 5. tanasupport_core feature flag
INSERT INTO feature_flags (flag_key, enabled)
VALUES ('tanasupport_core', true)
ON CONFLICT (flag_key) DO NOTHING;
