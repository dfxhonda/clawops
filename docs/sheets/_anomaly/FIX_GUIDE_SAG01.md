# FIX_GUIDE: SAG01 (ドンキ佐賀)

## 問題サマリ

- anomaly 行数: **32** 件
- 問題のある機械: **2** 個

## 問題機械リスト(max_booth 降順)

| machine_name | area | unit | max_booth | anomaly行 | 想定問題 |
|---|---|---:|---:|---:|---|
| BUZZクレ⑥ | - | U1 | **20** | 16 | 棚卸/履歴データ混入 |
| BUZZクレ⑦ | - | U1 | **20** | 16 | 棚卸/履歴データ混入 |

## 想定される修正方針(Excel側で)

### 2. max_booth ≥ 10 の異常(棚卸/履歴データ混入の可能性)

該当機械の異常行(下の CSV で `booth_number >= 10`)を Excel で目視確認、
- 集計行/棚卸行なら「日付列に『月末合計』『棚卸』等のラベル」を入れる(parserがskip)
- そもそも不要なら行削除

## 確認用 CSV

- `docs/sheets/_anomaly/SAG01_anomaly.csv` 開いて、Excel ファイルと突き合わせ。
- anomaly 行のうち `booth_number>=5` の行を Excel で見つけて、上記方針で修正。
- CSV には文脈用に **同機械の normal 行も含めて** ある(時系列順)。
