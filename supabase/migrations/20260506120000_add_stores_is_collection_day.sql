-- M1: 集金日フラグ — is_collection_day ON の店舗のみ巡回ブース画面に集金チェックを表示
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_collection_day BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN stores.is_collection_day IS
  '集金日: ON のとき巡回で集金チェックを付与し、ON+チェックで entry_type=collection を記録';
