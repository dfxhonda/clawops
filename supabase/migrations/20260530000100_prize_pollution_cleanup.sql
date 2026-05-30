-- J-PATROL-99_adhoc_prize_pollution_cleanup (2026-05-30)
-- 景品マスタ汚染の cleanup (C-1 + C-2 + C-3)
-- ヒロ approved (cowork session 2026-05-30)
--
-- 背景:
--   change Excel 元データはピボット表で、行ラベル/列値ズレが発生:
--     - prize_name 列に prize_cost 値が混入 (純数値 20,495 件 = 63%)
--     - 「利益」「単価」「原価」「合計」等のピボット集計行が
--       景品レコードとして prize_masters に取り込まれた (11 件)
--   meter_readings 32,036 件中 prize_id 紐付き 6,750 件 (20.7%) のうち
--   2,118 件は上記汚染ラベルへの誤紐付け。
--
-- 実行内容:
--   C-1: 11 件のラベル景品を status='deprecated' (削除はしない、参照保全)
--   C-2: meter_readings の prize_id 誤紐付けを NULL に解除
--   C-3: meter_readings.prize_name に数値混入した 20,495 行を NULL に
--        (実値は prize_cost 列に保持されているので情報損失なし)
--   C-4: 上流パイプライン (docs/sheets/_import/) の修正は別 task

UPDATE prize_masters
SET status = 'deprecated',
    notes = COALESCE(notes || ' / ', '') || 'pollution_cleanup_2026-05-30: Excel pivot label / aggregate row',
    updated_at = NOW(),
    updated_by = 'J-PATROL-99'
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND prize_id IN (
    'PZ-02357', -- ３店舗 月間合計
    'PZ-02491', -- トータル出率
    'PZ-02492', -- トータル原価
    'PZ-02568', -- 利益
    'PZ-02570', -- 単価
    'PZ-02571', -- 原価
    'PZ-02573', -- 払出合計
    'PZ-02574', -- 払出額
    'PZ-02576', -- 景品
    'PZ-02577', -- 月末在庫金額
    'PZ-02587'  -- 補充
  );

UPDATE meter_readings
SET prize_id = NULL,
    updated_at = NOW()
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND prize_id IN (
    'PZ-02357','PZ-02491','PZ-02492','PZ-02568','PZ-02570',
    'PZ-02571','PZ-02573','PZ-02574','PZ-02576','PZ-02577','PZ-02587'
  );

UPDATE meter_readings
SET prize_name = NULL,
    updated_at = NOW()
WHERE organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
  AND prize_name ~ '^[0-9]+(\.[0-9]+)?$';
