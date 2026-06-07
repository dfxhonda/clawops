# 再取り込み手順 (RESTART_GUIDE)

ヒロが Excel を手直ししたあと、ここから再開する手順。

## 前提状態 (2026-05-30 時点)

- meter_readings の source='import_fukuoka_2026'(旧 v1 汚染データ)は既に **削除済み**
- 昨日生成の booths(56) / machines(56) / prize_masters(235) も **削除済み**
- stores テーブルは change org 下 **12店舗** が維持されている(削除しない)
- 本番 INSERT は **まだ実施していない**(待機状態)

## 完璧店舗(無修正でOK、いつでも投入可)

- **familyma_gofukumachi** (ファミリーマート呉服町): normal 54 行
- **fukue** (福江): normal 54 行
- **NKG01** (ドンキ那珂川): normal 1352 行

## 修正対象店舗(Excel手直し後に再 dry-run)

優先順位(anomaly行数の少ない=直しやすい順):

| 順 | 店舗 | anomaly行 | FIX_GUIDE |
|---:|---|---:|---|
| 1 | nishijin (西新) | 2 | `_anomaly/FIX_GUIDE_nishijin.md` |
| 2 | NKS01 (ドンキ中洲) | 11 | `_anomaly/FIX_GUIDE_NKS01.md` |
| 3 | HMN01 (ドンキ浜町) | 23 | `_anomaly/FIX_GUIDE_HMN01.md` |
| 4 | FKS01 (ドンキ福重) | 25 | `_anomaly/FIX_GUIDE_FKS01.md` |
| 5 | SAG01 (ドンキ佐賀) | 32 | `_anomaly/FIX_GUIDE_SAG01.md` |
| 6 | bayside (ベイサイドプレイス博多) | 42 | `_anomaly/FIX_GUIDE_bayside.md` |
| 7 | KRT01 (ドンキ唐津) | 50 | `_anomaly/FIX_GUIDE_KRT01.md` |
| 8 | daikyo (ダイキョー弥永) | 55 | `_anomaly/FIX_GUIDE_daikyo.md` |
| 9 | TKT01 (ドンキ時津) | 55 | `_anomaly/FIX_GUIDE_TKT01.md` |

## 修正後の再 dry-run コマンド

ヒロが Excel を直したら、clawops リポジトリ root で:

```bash
# 全12ファイル再 dry-run
python3 src/scripts/fukuoka_import_v2/parser_v4.py --mode emit

# 特定店舗のみ再 dry-run(例: 唐津)
python3 src/scripts/fukuoka_import_v2/parser_v4.py \
  --only '★唐津　クレーン売上表.xlsx' --mode emit

# anomaly CSV 再生成
python3 src/scripts/fukuoka_import_v2/generate_anomaly_reports.py
```

## 確認ポイント

- 全店舗で anomaly=0 になっているか
- max_booths_seen が 1/2/4 のいずれかに収まっているか
- 機械名+エリア の組み合わせが実機と合っているか

## 本番投入手順(全 anomaly が消えてから)

Claude Code に以下を依頼:

> 福岡 v2 取り込み Phase 5 再開。
> dry-run v4 で anomaly=0 確認済み。本番INSERT実行。
> 
> 投入手順:
> 1. machines / booths / prize_masters のマスタ整備(機械名+エリアで unique)
> 2. meter_readings に source='import_fukuoka_2026_v2' で200件ずつ batch INSERT
> 3. Round Zero Dashboard で 12店舗が正しく表示されることを確認

## parser バージョン履歴

- v1: 5/29 旧スクリプト(import_fukuoka_meter_readings.mjs) — 汚染あり、削除済み
- v2 (parser.py): 列方向ブース解釈 → ヒロ修正で廃止
- v3 (parser_v3.py): 行方向ブース解釈 + R1空無視
- v4 (parser_v4.py): + エリア分離 + 100円厳密数値 + anomaly フラグ ← **最新**
