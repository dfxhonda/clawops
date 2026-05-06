ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS ocr_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ocr_raw_text     TEXT;

COMMENT ON COLUMN meter_readings.ocr_attempted_at IS 'OCR を試みた日時（クロップ+Otsu 処理後に Edge Function を呼び出したタイムスタンプ）';
COMMENT ON COLUMN meter_readings.ocr_raw_text     IS 'ocr-meter Edge Function が返した生テキスト（認識率チューニング用）';
