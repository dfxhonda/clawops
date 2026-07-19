-- SPEC-INF-MAIL-IMPORT-01 (D-086) S0: Gmail internalDate(メール実受信時刻)を記録する列。
-- cron 頻度後追い最適化の判断材料 (created_at=cron実行時刻では代替不可)。
-- 本番適用は chat Claude (ヒロGO後)。CC は本番 DDL 禁止 = 本ファイルは repo 記録用 (IF NOT EXISTS で冪等)。
-- ※ 2026-07-18 時点で本番 prize_announcements には既に email_received_at 列が存在 (適用済) を information_schema で確認済。
ALTER TABLE prize_announcements
  ADD COLUMN IF NOT EXISTS email_received_at timestamptz NULL;
