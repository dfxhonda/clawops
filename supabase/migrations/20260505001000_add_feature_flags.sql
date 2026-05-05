-- feature_flags テーブル (J章原則4: v1.x モジュール管理基盤)
-- flag_key  : 機能識別子 (例: 'patrol_core', 'collection_v11')
-- enabled   : false にすると全ユーザーで無効化
-- description: 何を制御するかのメモ

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key    TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_feature_flags_updated_at();

-- RLS: 読み取りは全認証ユーザー、書き込みは service_role のみ
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_read_all"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- ど安定ver5点の初期フラグ
INSERT INTO feature_flags (flag_key, enabled, description) VALUES
  ('patrol_core',     true, 'in/out メーター記録 (ど安定ver1)'),
  ('setting_record',  true, '設定値記録 (ど安定ver2)'),
  ('prize_inventory', true, '景品在庫記録 (ど安定ver3)'),
  ('restock_record',  true, '補充数記録 (ど安定ver4)'),
  ('collection_basis',true, '集金根拠 (ど安定ver5)')
ON CONFLICT (flag_key) DO NOTHING;
