-- SPEC-STOCK-ANNOUNCEMENTS-01: prize_announcements にお気に入り 3 列追加 + 90 日超 cleanup + RLS。
-- 司令塔Opus spec P1 / hiro_approved 2026-06-02 (Discord 経由)。
-- DB MCP permission denied 環境のため、ヒロが Supabase Studio または supabase db push で適用予定。

-- 1. 90 日超の古い行は破棄 (運用ポリシー: ヒアリングで old_data_policy=3ヶ月超は破棄 確定)
DELETE FROM prize_announcements
 WHERE created_at < NOW() - INTERVAL '90 days';

-- 2. お気に入り 3 列追加 (IF NOT EXISTS で再適用安全)
ALTER TABLE prize_announcements
  ADD COLUMN IF NOT EXISTS favorited_by   TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS favorite_memo  TEXT,
  ADD COLUMN IF NOT EXISTS favorited_at   TIMESTAMPTZ;

-- 3. RLS: authenticated の SELECT は全件可、UPDATE は favorited_by / favorite_memo /
--    favorited_at / status の更新を想定 (列レベル制御は本 migration では table-level に留め、
--    アプリ層で update payload を限定する。INSERT / DELETE は本 spec で禁止、取込
--    パイプライン (service_role) のみが書き込み)。
ALTER TABLE prize_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prize_announcements_select_authenticated ON prize_announcements;
CREATE POLICY prize_announcements_select_authenticated
  ON prize_announcements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS prize_announcements_update_favorite_fields ON prize_announcements;
CREATE POLICY prize_announcements_update_favorite_fields
  ON prize_announcements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. ソート用 index (お気に入りタブ=favorited_at DESC、新着タブ=created_at DESC)。
CREATE INDEX IF NOT EXISTS prize_announcements_favorited_at_idx
  ON prize_announcements (favorited_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS prize_announcements_created_at_idx
  ON prize_announcements (created_at DESC NULLS LAST);
