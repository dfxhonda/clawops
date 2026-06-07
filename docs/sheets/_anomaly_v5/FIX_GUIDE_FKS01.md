# FIX_GUIDE v5: FKS01 (ドンキ福重)

## 問題サマリ

- anomaly 行数: **25** 件
- 問題機械: **6** 個

### v5 タグ分類

- `possible_2nd_round`: 25 件 — 1日2回巡回の可能性(4ブース×2回=8行)

## 機械別詳細(max_booth 降順)

| machine | area | unit | max_booth | anomaly行 | 支配タグ |
|---|---|---:|---:|---:|---|
| 福重BUZZクレ⑤ | 2F | U1 | **8** | 8 | possible_2nd_round(8) |
| 福重BUZZ⑥ | 2F | U1 | **8** | 4 | possible_2nd_round(4) |
| 福重BUZZ⑦ | 2F | U1 | **8** | 4 | possible_2nd_round(4) |
| 福重BUZZ⑧ | 2F | U1 | **8** | 4 | possible_2nd_round(4) |
| 福重BUZZ⑨ | 2F | U1 | **8** | 4 | possible_2nd_round(4) |
| 福重BUZZミニ⑩ | 1F | U1 | **5** | 1 | possible_2nd_round(1) |

## タグ別の Excel 修正方針

### `possible_2nd_round` の対処(同日2回巡回想定)

該当機械の R1 セルに **「1F」「2F」「午前」「午後」など分離タグ** を追記して別機械として扱わせる。
または、5行目以降の日付セルに **改めて日付** を入れて新グループ化する。
もしくは「2回目巡回データを残したくない」ならその行ごと削除でもOK。

## CSV ファイル

- `docs/sheets/_anomaly_v5/FKS01_anomaly.csv` を開いて Excel と突き合わせ。
- `anomaly_tag` 列で分類を確認、タグごとに対処。
- normal 行も文脈として時系列順に含めてある。
