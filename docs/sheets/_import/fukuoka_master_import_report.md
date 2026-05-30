# 福岡 12 店舗 マスタ整備レポート

実施日: 2026-05-30
対象: Round Zero 管理画面用、株式会社change (org `01cf7a5e-...`) スコープ
ソース: `meter_readings` 32,036件 (福岡 12店舗, 2023-04-24 ~ 2026-05-29)

---

## 1. 登録件数

| マスタ | 件数 | 備考 |
|---|---:|---|
| `stores` | **12** | 新規挿入、既存無し |
| `machines` | **56** | 全件 `machine_code = store_code:booth_code` 形式で挿入 |
| `machines` うち DFX 所有マーク | **3** | `karatsu:唐津R3003` / `karatsu:唐津R3004` / `fukushige:福重バーバーR1014` |
| `prize_masters` | **235** | PZ-02356 ~ PZ-02590 (CHANGE org) |

### 仕様逸脱: R-始まりブースの判定基準

仕様書: 「R20xx で始まるブースは DFX 所有」
実データ: `R20xx` 該当ゼロ。実在は `R10xx` (1件) と `R30xx` (2件) のみ。
判断: `R\d{3,4}` パターン全件を DFX 所有マーク。要レビュー、必要なら note 列で修正。

---

## 2. meter_readings リンク状況

対象 32,036件。

| 項目 | 件数 | 比率 |
|---|---:|---:|
| `booth_id` → `machines.machine_code` 一致 | **32,036** | **100.0%** |
| `prize_id` 埋め込み成功 | **6,440** | 20.1% |
| `prize_id` 未リンク残 | 25,596 | 79.9% |

### prize_id 未リンクの内訳

| 原因 | 件数 |
|---|---:|
| `prize_name` が NULL | 5,088 |
| `prize_name` が数値ノイズ (`0`, `0.4399...` 等) | 20,495 |
| `prize_name` が `差` 等の Excel ラベル残骸 | 13 |
| 計 | 25,596 |

---

## 3. 店舗別 meter_readings カウント

| store_code | 店舗 | 件数 | ブース | prize 埋め込み | 期間 |
|---|---|---:|---:|---:|---|
| fukushige | 福重 | 9,476 | 27 | 7.7% | 2025-04-21 ~ 2026-05-25 |
| daikyo | ダイキョー弥永 | 5,652 | 1 | 36.0% | 2023-04-24 ~ 2026-05-28 |
| bayside | ベイサイドプレイス博多 | 4,809 | 1 | 23.5% | 2023-04-24 ~ 2026-05-22 |
| karatsu | 唐津 | 3,599 | 8 | 24.8% | 2025-04-14 ~ 2026-05-25 |
| togitsu | 時津 | 1,891 | 1 | 17.3% | 2025-08-17 ~ 2026-05-25 |
| nakagawa | 那珂川 | 1,790 | 1 | 3.1% | 2025-04-14 ~ 2026-05-25 |
| saga | 佐賀 | 1,423 | 1 | 14.8% | 2026-02-17 ~ 2026-05-27 |
| hamanomachi | 浜の町 | 1,180 | 2 | 25.7% | 2025-08-17 ~ 2026-05-25 |
| nakasu | 中洲 | 1,135 | 1 | 26.0% | 2025-08-17 ~ 2026-05-26 |
| nishijin | 西新 | 792 | 1 | 49.4% | 2025-06-26 ~ 2026-05-26 |
| fukue | 福江 | 197 | 6 | 8.6% | 2026-05-22 ~ 2026-05-26 |
| familyma_gofukumachi | ファミリーマート呉服町 | 92 | 6 | 58.7% | 2026-04-28 ~ 2026-05-25 |
| **合計** | | **32,036** | **56** | **20.1%** | |

---

## 4. 管理画面で動く / 動かないこと

**今すぐ動く:**
- 店舗別集計 (12 店舗マスタ整合、全件 store_code 紐付)
- 機械別 (ブース別) 集計 (56 machines 100% リンク)
- DFX 所有 R 機の絞り込み (`machines.notes LIKE '%DFX所有%'`)

**部分的に動く (約 20%):**
- 景品別売上・原価集計 — 6,440 件のみ。`prize_name` のクリーンアップ次第で大幅向上。

**動かない/要改修:**
- `prize_name` が数値で入ってる 20,495 件 — 上流 import パイプラインの調査必要 (payout_rate 列の取り違え疑い)
- `prize_name` NULL の 5,088 件 — 元エクセルでセル空欄、再入力 or 諦め

---

## 5. 推奨フォローアップ

1. **import パイプライン調査** (最優先): `docs/sheets/_import/sql_batches/` の生成スクリプトを見直し。`prize_name` カラムに `payout_rate` (0.x の小数) が混入する経路を特定。
2. **R 識別子の整合性確認**: 仕様の「R20xx」と実データの「R10xx/R30xx」の差。元データに R20xx 期待があったか確認。
3. **prize_masters の summary label 削除**: `原価` `利益` `単価` `トータル原価` `払出合計` `月末在庫金額` `余り物` `補充` `景品` `差` 等が混入。手動で `status='deprecated'` 等にマークするか削除。
4. **booth_id → machines に FK 制約追加** (任意): 現状は値一致のみ、FK 制約無し。将来の参照整合性確保のため `ALTER TABLE meter_readings ADD CONSTRAINT fk_meter_readings_booth FOREIGN KEY (booth_id) REFERENCES machines(machine_code);` 検討。

---

## 6. 採番ログ

- `prize_masters.prize_id`: 既存最大 `PZ-02355` の続き → `PZ-02356` ~ `PZ-02590` (235件)
- `machines.machine_code`: `meter_readings.booth_id` の値をそのまま使用 (`store_code:booth_code` 形式、56件)
- `stores.store_code`: 仕様通り lowercase (`daikyo`, `bayside`, ...)、12件

全変更は `organization_id = '01cf7a5e-6971-4ae1-918d-8e5981780a95'` (株式会社change) スコープ。DFX 既存マスタ (`14e907a7-...`) に影響なし。
