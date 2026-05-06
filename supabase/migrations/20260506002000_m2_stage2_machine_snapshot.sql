-- M2 棚卸し Stage 2: 機械スナップショット + 個人ゼロ申告

-- 1. スタッフ個人ゼロ申告テーブル
CREATE TABLE IF NOT EXISTS stocktake_zero_declarations (
  session_id  uuid NOT NULL REFERENCES stocktake_sessions(session_id) ON DELETE CASCADE,
  staff_id    text NOT NULL,
  declared_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, staff_id)
);

ALTER TABLE stocktake_zero_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "szd_anon_all" ON stocktake_zero_declarations
  FOR ALL USING (true) WITH CHECK (true);

-- 2. 月末スナップショット関数 (pg_cron で毎月末 23:59 JST に実行)
CREATE OR REPLACE FUNCTION take_stocktake_machine_snapshot()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today      date;
  v_next_day   date;
  v_month      date;
  v_session_id uuid;
  v_org_id     uuid;
  v_inserted   int := 0;
BEGIN
  -- DFX 組織 ID (シングルテナント固定)
  v_org_id   := '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'::uuid;
  v_today    := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  v_next_day := v_today + 1;

  -- 月末チェック: 翌日が月初なら今日が月末
  IF date_trunc('month', v_next_day) = v_next_day THEN
    v_month := date_trunc('month', v_today)::date;

    -- セッション取得 or 作成
    INSERT INTO stocktake_sessions (organization_id, month, status)
    VALUES (v_org_id, v_month, 'open')
    ON CONFLICT (organization_id, month) DO NOTHING;

    SELECT session_id INTO v_session_id
    FROM stocktake_sessions
    WHERE organization_id = v_org_id AND month = v_month;

    -- prize_stocks の booth 在庫を snapshot (既存レコードは上書きしない)
    WITH ins AS (
      INSERT INTO stocktake_items
        (session_id, prize_id, owner_type, owner_code, actual_count, theoretical_count)
      SELECT
        v_session_id,
        ps.prize_id,
        'booth',
        ps.owner_id,
        ps.quantity,
        ps.quantity
      FROM prize_stocks ps
      WHERE ps.owner_type = 'booth'
        AND ps.quantity > 0
      ON CONFLICT (session_id, prize_id, owner_type, owner_code)
      DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM ins;

    RETURN json_build_object(
      'status',   'ok',
      'month',    v_month,
      'inserted', v_inserted
    );
  ELSE
    RETURN json_build_object(
      'status', 'skipped',
      'reason', 'not last day of month',
      'today',  v_today
    );
  END IF;
END;
$$;

-- 3. pg_cron: 毎日 14:59 UTC (= 23:59 JST) に実行。28-31日限定。
--    関数内で月末チェックするので余分な日は即 skipped で終了。
SELECT cron.schedule(
  'stocktake-month-end-snapshot',
  '59 14 28-31 * *',
  $$SELECT take_stocktake_machine_snapshot()$$
);
