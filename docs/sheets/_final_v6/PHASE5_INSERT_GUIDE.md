# Phase 5 投入手順 — 残作業ガイド

## 現在の投入済み状態(Claude が完了させた部分)

- ✅ visit_index カラムを meter_readings に追加 (migration: `add_visit_index_to_meter_readings`)
- ✅ machines: 138 件 INSERT 済み (ON CONFLICT DO NOTHING)
- ✅ booths: 399 件 INSERT 済み (ON CONFLICT DO NOTHING)
- ⏳ prize_masters: 645 件 — 未投入(SQL ファイル準備済)
- ⏳ meter_readings: 22,204 件 — 未投入(SQL ファイル準備済)

## 未投入の理由

Claude のセッション内で大量 SQL(1 batch あたり 1.3MB × 5 batch + prize 84KB × 2)を
順次手動コピペで送るのは context window 制約上、現実的に不可能。
SQL ファイルは生成完了しているので、Supabase Studio から実行可能。

## 残作業の SQL ファイル一覧

すべて `~/clawops/src/scripts/fukuoka_import_v2/insert_payload/sql/` 配下:

| # | ファイル | サイズ | 行数 | 内容 |
|---:|---|---:|---:|---|
| 1 | 03_prize_masters_01.sql | 84KB | 400 | 景品マスタ 1/2 |
| 2 | 03_prize_masters_02.sql | 50KB | 245 | 景品マスタ 2/2 |
| 3 | 04_meter_readings_001.sql | 1.3MB | 4,500 | メーター読み取り 1/5 |
| 4 | 04_meter_readings_002.sql | 1.5MB | 4,500 | メーター読み取り 2/5 |
| 5 | 04_meter_readings_003.sql | 1.3MB | 4,500 | メーター読み取り 3/5 |
| 6 | 04_meter_readings_004.sql | 1.3MB | 4,500 | メーター読み取り 4/5 |
| 7 | 04_meter_readings_005.sql | 1.3MB | 4,204 | メーター読み取り 5/5 |

## 実行手順(Supabase Studio)

1. https://supabase.com/dashboard/project/gedxzunoyzmvbqgwjalx を開く
2. 左メニュー → **SQL Editor**
3. 上記 7 ファイルを **順番通り** 1 つずつコピペして実行
4. 各 INSERT は `ON CONFLICT DO NOTHING` 付きなので、重複エラーは出ない
5. 03_prize_masters は中断/再実行 OK
6. 04_meter_readings は `ON CONFLICT` 無し(reading_id は uuid 自動生成)→ 重複実行すると同データが2倍入る、要注意

### 各ファイルを Mac の Finder からダブルクリックで開く方法

```bash
open ~/clawops/src/scripts/fukuoka_import_v2/insert_payload/sql/
```

各 .sql ファイルを VS Code / テキストエディタで開いて、全選択 → コピー → SQL Editor に貼り付け → Run。

## 投入後の確認クエリ(Supabase SQL Editor で実行)

```sql
-- 件数確認
SELECT
  (SELECT COUNT(*) FROM prize_masters WHERE prize_id LIKE 'FUKUOKA-V2-%') AS prize_masters_v2,
  (SELECT COUNT(*) FROM meter_readings WHERE source = 'import_fukuoka_2026_v2') AS meter_readings_v2,
  (SELECT COUNT(*) FROM meter_readings WHERE source = 'import_fukuoka_2026_v2' AND visit_index = 2) AS visit_2,
  (SELECT COUNT(*) FROM meter_readings WHERE source = 'import_fukuoka_2026_v2' AND visit_index >= 3) AS visit_3_plus;

-- 店舗別件数
SELECT store_code, COUNT(*) AS readings
FROM meter_readings
WHERE source = 'import_fukuoka_2026_v2'
GROUP BY store_code
ORDER BY readings DESC;

-- 機械別 booth数 (4ブースで揃ってるか)
SELECT m.store_code, m.machine_name, COUNT(DISTINCT b.booth_number) AS booths
FROM machines m
JOIN booths b ON b.machine_code = m.machine_code
WHERE m.notes LIKE 'fukuoka v2 import%'
GROUP BY m.store_code, m.machine_name
ORDER BY booths DESC, m.store_code;
```

## 期待される結果

- prize_masters_v2 = 645
- meter_readings_v2 = 22,204
- visit_2 = 70
- visit_3_plus = 28 (visit=3:12 + 4:8 + 5:8)

## inconclusive 4 機械の扱い(保留)

以下 4 機械 × 31 行は v6 で判定不能(anomaly のまま)。投入対象外:
- NKS01 / BuZZ DX② U1 (8 行)
- TKT01 / BUZZ① U1 (7 行)
- TKT01 / BUZZ③ U1 (8 行)
- HMN01 / BUZZ④ U1 (8 行)

ヒロが Excel と inconclusive CSV (`docs/sheets/_final_v6/<store>_inconclusive.csv`) を
突き合わせて判定後、別途投入する。

## Round Zero Dashboard 確認

投入完了後、`https://<clawops vercel URL>/round-zero` で 12 店舗のデータが表示されるか確認。
12 店舗:
- ファミリーマート呉服町 (familyma_gofukumachi)
- 福江 (fukue)
- ダイキョー弥永 (daikyo)
- ベイサイドプレイス博多 (bayside)
- 西新 (nishijin)
- ドンキ中州 (NKS01)
- ドンキ佐賀 (SAG01)
- ドンキ唐津 (KRT01)
- ドンキ時津 (TKT01)
- ドンキ浜の町 (HMN01)
- ドンキ福重 (FKS01)
- ドンキ那珂川 (NKG01)
