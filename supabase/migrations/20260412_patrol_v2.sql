-- ============================================
-- Phase A 巡回入力 V2: meter_readings 拡張
-- + locker_slots / locker_slot_logs 新規
-- ============================================

-- meter_readings に multi-OUT / entry_type 追加
ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS out_meter_2     BIGINT,
  ADD COLUMN IF NOT EXISTS out_meter_3     BIGINT,
  ADD COLUMN IF NOT EXISTS prize_name_2    TEXT,
  ADD COLUMN IF NOT EXISTS prize_name_3    TEXT,
  ADD COLUMN IF NOT EXISTS prize_cost_1    INTEGER,
  ADD COLUMN IF NOT EXISTS prize_cost_2    INTEGER,
  ADD COLUMN IF NOT EXISTS prize_cost_3    INTEGER,
  ADD COLUMN IF NOT EXISTS stock_2         INTEGER,
  ADD COLUMN IF NOT EXISTS stock_3         INTEGER,
  ADD COLUMN IF NOT EXISTS restock_2       INTEGER,
  ADD COLUMN IF NOT EXISTS restock_3       INTEGER,
  ADD COLUMN IF NOT EXISTS entry_type      TEXT DEFAULT 'patrol',
  ADD COLUMN IF NOT EXISTS in_diff         INTEGER,
  ADD COLUMN IF NOT EXISTS out_diff_1      INTEGER,
  ADD COLUMN IF NOT EXISTS out_diff_2      INTEGER,
  ADD COLUMN IF NOT EXISTS out_diff_3      INTEGER;

-- ロッカースロット (景品在庫)
CREATE TABLE IF NOT EXISTS locker_slots (
  slot_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  locker_id     TEXT NOT NULL REFERENCES machine_lockers(locker_id) ON DELETE CASCADE,
  slot_number   INTEGER NOT NULL,
  prize_name    TEXT,
  prize_value   INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'empty',  -- 'filled' | 'empty'
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    TEXT,
  UNIQUE (locker_id, slot_number)
);

-- ロッカースロット操作ログ
CREATE TABLE IF NOT EXISTS locker_slot_logs (
  log_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  slot_id       TEXT NOT NULL,
  locker_id     TEXT NOT NULL,
  action        TEXT NOT NULL,  -- 'set' | 'won' | 'swap' | 'remove'
  prize_name    TEXT,
  prize_value   INTEGER,
  logged_at     TIMESTAMPTZ DEFAULT NOW(),
  logged_by     TEXT
);

-- 既存 machine_lockers のスロット数に合わせて locker_slots を初期化するヘルパー
-- (手動実行: 各ロッカーにスロットを作成)
-- INSERT INTO locker_slots (locker_id, slot_number)
-- SELECT locker_id, generate_series(1, slot_count)
-- FROM machine_lockers WHERE is_active = true
-- ON CONFLICT (locker_id, slot_number) DO NOTHING;
