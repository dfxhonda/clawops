-- M1 Stage 3: machine_type 吸収 + multi-OUT 対応
-- machines: meter_unit_price / out_meter_count
-- meter_readings: out_meter_2 / out_meter_3

-- ─── machines ─────────────────────────────────────────────
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS meter_unit_price NUMERIC NOT NULL DEFAULT 100;
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS out_meter_count INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN machines.meter_unit_price IS
  'メーター1カウントの円換算（100=クレーン/500円ガチャ、1000=高額ガチャ）';
COMMENT ON COLUMN machines.out_meter_count IS
  'この機械が持つアウトメーター数（1〜3）';

-- ─── meter_readings ───────────────────────────────────────
ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS out_meter_2 NUMERIC;
ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS out_meter_3 NUMERIC;

COMMENT ON COLUMN meter_readings.out_meter_2 IS
  '2つ目のアウトメーター（ティアラのロッカーアウト等、NULL許可）';
COMMENT ON COLUMN meter_readings.out_meter_3 IS
  '3つ目のアウトメーター（NULL許可）';
