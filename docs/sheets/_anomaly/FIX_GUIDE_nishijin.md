# FIX_GUIDE: nishijin (西新)

## 問題サマリ

- anomaly 行数: **2** 件
- 問題のある機械: **1** 個

## 問題機械リスト(max_booth 降順)

| machine_name | area | unit | max_booth | anomaly行 | 想定問題 |
|---|---|---:|---:|---:|---|
| BUZZ① | - | U1 | **5** | 2 | 日付記入漏れで継承暴走 |

## 想定される修正方針(Excel側で)

### 3. max_booth=5〜7 の軽微異常(日付記入漏れの可能性)

該当行で「本来別日のデータなのに日付セルが空 → 前日付を継承してブース番号がズレた」可能性。
Excel で「同じ日付の連続行が4を超える箇所」を見つけて、5行目以降の日付セルに正しい日付を入れる。

## 確認用 CSV

- `docs/sheets/_anomaly/nishijin_anomaly.csv` 開いて、Excel ファイルと突き合わせ。
- anomaly 行のうち `booth_number>=5` の行を Excel で見つけて、上記方針で修正。
- CSV には文脈用に **同機械の normal 行も含めて** ある(時系列順)。
