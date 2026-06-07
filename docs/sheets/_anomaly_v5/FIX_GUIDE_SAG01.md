# FIX_GUIDE v5: SAG01 (ドンキ佐賀)

## 問題サマリ

- anomaly 行数: **32** 件
- 問題機械: **2** 個

### v5 タグ分類

- `possible_aggregate`: 24 件 — 集計行/棚卸混入の可能性(booth≥9)
- `possible_2nd_round`: 8 件 — 1日2回巡回の可能性(4ブース×2回=8行)

## 機械別詳細(max_booth 降順)

| machine | area | unit | max_booth | anomaly行 | 支配タグ |
|---|---|---:|---:|---:|---|
| BUZZクレ⑥ | - | U1 | **20** | 16 | possible_aggregate(12), possible_2nd_round(4) |
| BUZZクレ⑦ | - | U1 | **20** | 16 | possible_aggregate(12), possible_2nd_round(4) |

## タグ別の Excel 修正方針

### `possible_2nd_round` の対処(同日2回巡回想定)

該当機械の R1 セルに **「1F」「2F」「午前」「午後」など分離タグ** を追記して別機械として扱わせる。
または、5行目以降の日付セルに **改めて日付** を入れて新グループ化する。
もしくは「2回目巡回データを残したくない」ならその行ごと削除でもOK。

### `possible_aggregate` の対処(集計/棚卸混入想定)

該当行の日付セルに **「月末合計」「棚卸」「期末」等のラベル** を入れる(parserが skip)。
そもそも不要なら行削除。
特に **max_booth ≥ 10** の機械は棚卸データが大量に紛れ込んでる可能性大。

## CSV ファイル

- `docs/sheets/_anomaly_v5/SAG01_anomaly.csv` を開いて Excel と突き合わせ。
- `anomaly_tag` 列で分類を確認、タグごとに対処。
- normal 行も文脈として時系列順に含めてある。
