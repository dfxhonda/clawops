# v4 → v5 比較レポート

## 全体サマリ

| 指標 | v4 | v5 | 差分 |
|---|---:|---:|---:|
| 総 parse 行 | 22,349 | 22,349 | +0 |
| normal 行 | 22,054 | 22,054 | +0 |
| anomaly 行 | 295 | 295 | +0 |

## v5 anomaly タグ分布

| タグ | 件数 | 比率 | 意味 |
|---|---:|---:|---|
| `possible_2nd_round` | 240 | 81.4% | 1日2回巡回(4ブース×2回=8行) |
| `possible_aggregate` | 55 | 18.6% | 集計行/棚卸混入(booth≥9) |

## 店舗別 v4 vs v5

| 店舗 | v4 normal | v5 normal | v4 anomaly | v5 anomaly | 支配タグ(v5) |
|---|---:|---:|---:|---:|---|
| FKS01 | 6,408 | 6,408 | 25 | 25 | possible_2nd_round(25) |
| HMN01 | 867 | 867 | 23 | 23 | possible_2nd_round(23) |
| KRT01 | 2,660 | 2,660 | 50 | 50 | possible_2nd_round(50) |
| NKG01 | 1,352 | 1,352 | 0 | 0 |  |
| NKS01 | 834 | 834 | 11 | 11 | possible_2nd_round(11) |
| SAG01 | 871 | 871 | 32 | 32 | possible_aggregate(24), possible_2nd_round(8) |
| TKT01 | 1,316 | 1,316 | 55 | 55 | possible_2nd_round(51), possible_aggregate(4) |
| bayside | 3,035 | 3,035 | 42 | 42 | possible_2nd_round(22), possible_aggregate(20) |
| daikyo | 4,015 | 4,015 | 55 | 55 | possible_2nd_round(48), possible_aggregate(7) |
| familyma_gofukumachi | 54 | 54 | 0 | 0 |  |
| fukue | 54 | 54 | 0 | 0 |  |
| nishijin | 588 | 588 | 2 | 2 | possible_2nd_round(2) |

## v5 で追加された機能

1. **日付列の異常検出**: シート全体の日付中央値から±90日乖離→null化(継承)
   - 効果: 6件 null化(daikyo 3 + bayside 3)、件数大きく動かず
2. **機械名 数値のみ検出**: 数値だけの R1 ラベルを skip
   - 効果: 該当ブロック 0件(現状の福岡12ファイルには存在せず)
3. **anomaly タグ分類**: possible_2nd_round / possible_aggregate / possible_duplicate
   - 効果: ヒロが Excel 手直しの優先度判断できるようになった

## ヒロが Excel 手直しすべき優先度(タグ別)

### 優先度1: `possible_aggregate` 機械(棚卸混入で件数歪み大)

- **bayside / BUZZ③**: 20件 (max_booth=28)
- **SAG01 / BUZZクレ⑥⑦**: 各12件 (max_booth=20)
- **daikyo / BUZZミニ③**: 7件 (max_booth=11)
- **TKT01 / トライデッキ**: 4件 (max_booth=12)

対処: 該当行の日付セルに『棚卸』『月末合計』等のラベル追加 or 行削除

### 優先度2: `possible_2nd_round` 機械(同日2回巡回想定)

ナイスランド系(KRT01/TKT01/HMN01)の BUZZ①〜④ ほとんど全部。
対処: R1 セルに『1F』『2F』『午前』『午後』等の分離タグ追記
