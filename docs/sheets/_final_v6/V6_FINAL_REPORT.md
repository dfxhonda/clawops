# v6 最終レポート — 福岡取り込み自動分類完了

## 件数推移(v5 → v6)

| 指標 | v5 | v6 | 差分 | 改善率 |
|---|---:|---:|---:|---:|
| total | 22,349 | 22,235 | -114 | -|
| normal | 22,054 | 22,204 | +150 | +0.68% |
| **anomaly** | **295** | **31** | **-264** | **89.5% 削減** |

## クラスタ分類結果(37 クラスタ)

### confirmed_2nd_round (11 クラスタ) — 景品名一致+メーター連続 → ロールバックして normal化

| store | machine | area | pairs | prize_match | meter_cont | 備考 |
|---|---|---|---:|---:|---:|---|
| bayside | BUZZ⑤ | - | 2 | 2 | 2 |  |
| SAG01 | BUZZクレ⑥ | - | 4 | 4 | 4 |  |
| SAG01 | BUZZクレ⑦ | - | 4 | 4 | 4 |  |
| KRT01 | 唐津R3004 BUZZ② | - | 4 | 4 | 4 |  |
| KRT01 | BUZZ③ | - | 4 | 4 | 4 |  |
| KRT01 | BUZZ④ | - | 4 | 2 | 4 |  |
| KRT01 | 唐津R3004 トライデッキ | - | 4 | 2 | 4 |  |
| TKT01 | BUZZ② | - | 20 | 12 | 12 |  |
| TKT01 | BUZZ④ | - | 16 | 8 | 12 |  |
| TKT01 | トライデッキ | - | 8 | 8 | 4 |  |
| FKS01 | 福重BUZZクレ⑤ | 2F | 8 | 5 | 4 |  |

### split_to_separate_unit (12 クラスタ) — 景品名違い → 別ユニット(U2/U3) として normal化

| store | machine | area | pairs | prize_match | meter_cont | 備考 |
|---|---|---|---:|---:|---:|---|
| daikyo | BUZZミニ② | - | 2 | 0 | 2 |  |
| bayside | BUZZミニ① | - | 2 | 0 | 2 |  |
| bayside | BUZZミニ② | - | 12 | 0 | 12 |  |
| KRT01 | 唐津BUZZmini① | - | 4 | 0 | 4 |  |
| KRT01 | 唐津BUZZmini② | - | 4 | 0 | 4 |  |
| KRT01 | 唐津BUZZmini③ | - | 4 | 0 | 4 |  |
| KRT01 | 唐津BUZZmini④ | - | 4 | 0 | 4 |  |
| HMN01 | BUZZ② | - | 8 | 0 | 0 |  |
| HMN01 | BUZZ③ | - | 8 | 0 | 8 |  |
| FKS01 | 福重BUZZ⑥ | 2F | 4 | 0 | 0 |  |
| FKS01 | 福重BUZZ⑦ | 2F | 8 | 2 | 2 |  |
| FKS01 | 福重BUZZ⑨ | 2F | 8 | 2 | 2 |  |

### aggregate_or_inventory (10 クラスタ) — 棚卸/集計混入 → 除外

| store | machine | area | pairs | prize_match | meter_cont | 備考 |
|---|---|---|---:|---:|---:|---|
| daikyo | BUZZ② | - | 4 | 0 | 0 | meter_decreased |
| daikyo | BUZZミニ③ | - | 42 | 0 | 41 | meter_decreased |
| bayside | BUZZ③ | - | 4 | 0 | 4 | meter_decreased |
| bayside | BUZZ④ | - | 2 | 0 | 2 | meter_decreased |
| NKS01 | BUZZ① | - | 6 | 0 | 2 | meter_decreased |
| KRT01 | 唐津R3003 BUZZ① | - | 18 | 3 | 4 | meter_decreased |
| HMN01 | BUZZ① | - | 10 | 0 | 4 | meter_decreased |
| FKS01 | 福重BUZZミニ⑩ | 1F | 1 | 0 | 0 | meter_decreased |
| FKS01 | 福重BUZZ⑧ | 2F | 8 | 2 | 1 | meter_decreased |
| nishijin | BUZZ① | - | 2 | 0 | 0 | meter_decreased |

### inconclusive (4 クラスタ) — 判定不能 → anomaly 維持、ヒロ目視確認

| store | machine | area | pairs | prize_match | meter_cont | 備考 |
|---|---|---|---:|---:|---:|---|
| NKS01 | BuZZ DX② | - | 12 | 5 | 11 |  |
| TKT01 | BUZZ① | - | 10 | 3 | 6 |  |
| TKT01 | BUZZ③ | - | 12 | 5 | 9 |  |
| HMN01 | BUZZ④ | - | 12 | 4 | 12 |  |

## 巡回回数分布(visit_index)

ロールバック後、note に `[N回目巡回]` マーカーが付与された行数:

- 2回目: 70 行
- 3回目: 12 行
- 4回目: 8 行
- 5回目: 8 行

## 最終 機械×ブース 分布

| max_booth | 機械数 |
|---:|---:|
| 1 | 38 |
| 2 | 19 |
| 3 | 1 |
| 4 | 76 |
| 8 | 4 |

合計 138 機械(U2/U3 unit含む)、うち **134 機械が max_booth ≤ 4 で完全正常(97.1%)**

## ⚠️ inconclusive 4 機械(ヒロ目視確認待ち)

これらは「景品名は一部一致するがメーター連続性が不完全」「景品名違いだがメーター連続」等で
v6 ロジックでは確定判定できなかった機械。

| store | machine | pairs | prize_match | meter_cont | anomaly行 |
|---|---|---:|---:|---:|---:|
| NKS01 | BuZZ DX② | 12 | 5 | 11 | 8 |
| TKT01 | BUZZ① | 10 | 3 | 6 | 7 |
| TKT01 | BUZZ③ | 12 | 5 | 9 | 8 |
| HMN01 | BUZZ④ | 12 | 4 | 12 | 8 |

**Excel で見るべき箇所**: `docs/sheets/_final_v6/<store>_inconclusive.csv` を開き、
元 Excel ファイルの該当機械列の 5行目以降と突き合わせ → 2回目巡回 or 別ユニット or 棚卸 の判断。

## ロールバック例(confirmed_2nd_round / split_to_separate_unit)

| store | machine | area | unit | booth | date | tag | note |
|---|---|---|---:|---:|---|---|---|
| daikyo | BUZZミニ② -U2 | - | U101 | b1 | 2024-05-13 | split_to_separate_unit |  |
| daikyo | BUZZミニ② -U2 | - | U101 | b2 | 2024-05-13 | split_to_separate_unit | 22.6.11.22 |
| bayside | BUZZ⑤ | - | U1 | b1 | 2024-05-13 | confirmed_2nd_round | [2回目巡回] |
| bayside | BUZZ⑤ | - | U1 | b2 | 2024-05-13 | confirmed_2nd_round | [2回目巡回] |
| bayside | BUZZミニ① -U2 | - | U101 | b1 | 2024-05-13 | split_to_separate_unit |  |
| bayside | BUZZミニ① -U2 | - | U101 | b2 | 2024-05-13 | split_to_separate_unit | 22.6.11.22 |
| bayside | BUZZミニ② -U2 | - | U101 | b1 | 2024-11-04 | split_to_separate_unit |  |
| bayside | BUZZミニ② -U2 | - | U101 | b2 | 2024-11-04 | split_to_separate_unit |  |

## 本投入準備状況

- normal 22,204 行 → `source='import_fukuoka_2026_v2'` で投入候補
- inconclusive 31 行 → ヒロ判定後、必要なら `source='import_fukuoka_2026_v2_manual'` で別途投入
- 除外 114 行(aggregate_or_inventory + meter_reset_artifact)→ 投入しない

INSERT は **未実行**(`generate_v6_reports.py` は CSV/レポート出力のみ)。
