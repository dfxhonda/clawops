-- staff.name_kana: ログイン画面50音インデックス用カタカナ読み
ALTER TABLE staff ADD COLUMN IF NOT EXISTS name_kana TEXT;
COMMENT ON COLUMN staff.name_kana IS 'ログイン画面の50音行分類用カタカナ読み(濁点・半濁点OK、行分類は清音代表)';

-- staff_public ビューに name_kana を追加
CREATE OR REPLACE VIEW staff_public AS
  SELECT staff_id,
    name,
    email,
    phone,
    role,
    operator_id,
    store_code,
    has_vehicle_stock,
    is_active,
    joined_at,
    notes,
    created_at,
    updated_at,
    CASE WHEN pin_hash IS NOT NULL THEN true ELSE false END AS has_pin,
    name_kana
  FROM staff;
