# ClawOps 設計正本（Notionより抜粋）

> 最終更新: 2026-04-07
> 出典: Notion「現在のフェーズ（正本）」+ 「司令塔」

---

## IDルール（厳守）

| ID種別 | フォーマット | 例 |
|--------|------------|-----|
| store_code | 英大文字3桁+数字2桁 | KIK01 |
| machine_code | store_code + `-M` + 2桁 | KOS01-M02 |
| booth_code | `B` + 2桁 | **B01** |
| full_booth_code | store-machine-booth | KIK01-M01-B01 |
| prize_id | `PZ-` + 5桁 | PZ-00001 |

> ⚠️ DBの `booths.booth_code` カラムにはフルコード（`KOS01-M02-B01`）が入っている。
> アプリ表示では `booth_number` から `B${pad2(n)}` に整形すること。

---

## 正本は3つだけ

| 正本 | 用途 |
|------|------|
| `prize_masters` | 景品定義 |
| `prize_orders` | 発注履歴 |
| `prize_stocks` | 在庫数量（Single Source of Truth） |

---

## 単価管理（最終仕入原価法）

- `original_cost`（prize_masters）= 在庫評価用。値下げ時に更新
- `unit_cost`（prize_orders）= 発注当時単価。分析用、履歴として残す
- 在庫金額 = `quantity × original_cost`

---

## prize_orders.status（4値確定）

`ordered` → `shipped` → `arrived` / `cancelled`

> `distributed` は入れない。仕分けは `stock_movements.movement_type='distribution'` で記録。

---

## movement_type 一覧（確定）

`arrival` / `distribution` / `transfer` / `replenish` / `adjust` / `count` / `demote_gacha` / `demote_assort` / `capsule_produce` / `reversal`

---

## 失敗パターン（チャッピー指摘）

1. 最初から全部入れようとする → Phase 1は3機能のみ
2. 現場入力を重くする → 現場が触るのは短縮名の手直しのみ
3. 正本が複数できる → 正本は上記3つだけ
4. 元データが弱いのに分析へ進みすぎる → AI・KPIはPhase 3
5. 作ること自体が目的になる → 毎週使って詰まる所だけ直す

---

## 運用ルール

- 発注取込のデフォルト status: `ordered`（入荷チェックは現場手動）
- 出率（`daily_booth_stats.payout_rate`）= 常に実績値（OUTメーター差分ベース）
- 本番ファイル = `public/docs/*.html`（`docs/` ではない）
- 本番URL: clawops-tau.vercel.app/docs/
