# 観察可能性
- meter_readings に audit列: input_method, ocr_attempted_at, ocr_raw_text, backfilled_*, backfill_session_id
- input_method: 'manual' / 'ocr' / 'ocr_corrected' / 'ocr_failed'
- Sentry: NativeCamera と保存処理に captureMessage/captureException 必須
- audit_logs テーブル: 修正(UPDATE)時に必ず投入
- /api/health: 死活監視エンドポイント、CRON_SECRET認証
