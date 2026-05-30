-- J-PATROL-99_adhoc_fukuoka_store_merge (2026-05-30)
-- 福岡ドンキ7店舗を本来の運営会社 (株式会社change) に紐替え + change側重複削除
-- ヒロ approved (cowork session 2026-05-30)
--
-- 背景:
--   change Excel import で福岡ドンキ7店舗 (saga/karatsu/fukushige/nakagawa/nakasu/togitsu/hamanomachi)
--   を地名 store_code で stores に新規追加していたが、DFX 側に既存ドンキ正規コード
--   (SAG01/KRT01/FKS01/NKG01/NKS01/TKT01/HMN01) があり 2重保持されていた。
--   組織関係:
--     - DFX合同会社 (14e907a7-...)         : システム管理者
--     - 株式会社change (01cf7a5e-...)      : 運営会社、九州ドンキ + 福岡その他
--     - ナイスランド (未登録, 小塩社長)   : 契約主
--   福岡ドンキは「ナイスランド契約 × change 運営」なので店舗マスタの所有組織は change が正。
--
-- 実行内容:
--   step 1: 福岡ドンキ7店舗 stores.organization_id を DFX -> change
--   step 2: change の meter_readings.store_code を正規コードに紐替え (20,494 行)
--   step 3: change の machines.store_code 紐替え (41 行)
--   step 4: change の重複 stores 7行削除
--   step 5: audit_logs に記録

UPDATE stores
SET organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95',
    updated_at = NOW(),
    updated_by = 'J-PATROL-99'
WHERE store_code IN ('SAG01','KRT01','FKS01','NKG01','NKS01','TKT01','HMN01')
  AND organization_id = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd';

UPDATE meter_readings
SET store_code = CASE store_code
      WHEN 'saga'        THEN 'SAG01'
      WHEN 'karatsu'     THEN 'KRT01'
      WHEN 'fukushige'   THEN 'FKS01'
      WHEN 'nakagawa'    THEN 'NKG01'
      WHEN 'nakasu'      THEN 'NKS01'
      WHEN 'togitsu'     THEN 'TKT01'
      WHEN 'hamanomachi' THEN 'HMN01'
    END,
    updated_at = NOW()
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND store_code IN ('saga','karatsu','fukushige','nakagawa','nakasu','togitsu','hamanomachi');

UPDATE machines
SET store_code = CASE store_code
      WHEN 'saga'        THEN 'SAG01'
      WHEN 'karatsu'     THEN 'KRT01'
      WHEN 'fukushige'   THEN 'FKS01'
      WHEN 'nakagawa'    THEN 'NKG01'
      WHEN 'nakasu'      THEN 'NKS01'
      WHEN 'togitsu'     THEN 'TKT01'
      WHEN 'hamanomachi' THEN 'HMN01'
    END,
    updated_at = NOW()
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND store_code IN ('saga','karatsu','fukushige','nakagawa','nakasu','togitsu','hamanomachi');

DELETE FROM stores
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND store_code IN ('saga','karatsu','fukushige','nakagawa','nakasu','togitsu','hamanomachi');
