-- Phase C: ロード高速化 — 巡回用 RPC 追加
--
-- get_latest_readings_per_booth: getLastReadingsMap 最適化
--   全件取得 → 最新2件/ブースに削減（N件 → 2N行）
--
-- get_last_readings_by_store: 店舗レベルの1クエリ最新読み値
--   getPatrolMachines + getLastReadingsMap を並列化できる基盤

-- ── RPC 1: ブースID配列 → 最新2件/ブース ────────────────────────────
CREATE OR REPLACE FUNCTION get_latest_readings_per_booth(p_booth_codes text[])
RETURNS TABLE(
  reading_id           uuid,
  booth_id             text,
  full_booth_code      text,
  patrol_date          date,
  read_time            timestamptz,
  in_meter             numeric,
  out_meter            numeric,
  prize_restock_count  int,
  prize_stock_count    int,
  prize_name           text,
  set_a                text,
  set_c                text,
  set_l                text,
  set_r                text,
  set_o                text,
  note                 text,
  source               text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH ranked AS (
    SELECT
      mr.reading_id,
      mr.booth_id::text              AS booth_id,
      mr.full_booth_code,
      mr.patrol_date,
      mr.read_time,
      mr.in_meter,
      mr.out_meter,
      mr.prize_restock_count::int,
      mr.prize_stock_count::int,
      mr.prize_name,
      mr.set_a, mr.set_c, mr.set_l, mr.set_r, mr.set_o,
      mr.note,
      mr.source,
      ROW_NUMBER() OVER (
        PARTITION BY mr.booth_id::text
        ORDER BY mr.read_time DESC NULLS LAST
      ) AS rn
    FROM meter_readings mr
    WHERE mr.booth_id::text = ANY(p_booth_codes)
  )
  SELECT
    reading_id, booth_id, full_booth_code, patrol_date, read_time,
    in_meter, out_meter, prize_restock_count, prize_stock_count, prize_name,
    set_a, set_c, set_l, set_r, set_o, note, source
  FROM ranked
  WHERE rn <= 2
  ORDER BY booth_id, read_time DESC
$$;

-- ── RPC 2: 店舗コード → 最新1件/ブース (DISTINCT ON) ─────────────────
CREATE OR REPLACE FUNCTION get_last_readings_by_store(p_store_code text)
RETURNS TABLE(
  full_booth_code  text,
  read_time        timestamptz,
  in_meter         numeric,
  out_meter        numeric,
  prize_name       text,
  patrol_date      date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT ON (mr.full_booth_code)
    mr.full_booth_code,
    mr.read_time,
    mr.in_meter,
    mr.out_meter,
    mr.prize_name,
    mr.patrol_date
  FROM meter_readings mr
  JOIN booths b       ON b.booth_code   = mr.full_booth_code
  JOIN machines m     ON m.machine_code = b.machine_code
  WHERE m.store_code = p_store_code
    AND m.is_active  = true
    AND b.is_active  = true
  ORDER BY mr.full_booth_code, mr.read_time DESC NULLS LAST
$$;

-- RLS は meter_readings テーブルの既存ポリシーに委譲（SECURITY INVOKER）
GRANT EXECUTE ON FUNCTION get_latest_readings_per_booth(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_readings_by_store(text)       TO authenticated;
