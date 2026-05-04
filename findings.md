# findings.md — 使われていない機能 調査結果

## 調査日: 2026-04-21

---

## [F-01] ルート — 到達不能・実質未使用

### 確定: 到達不能なルート（UI導線なし）

| ルート | コンポーネント | 理由 |
|--------|--------------|------|
| `/patrol/input-legacy` | PatrolInput | "legacy" と明記、どこからもリンクなし |
| `/input` | MainInput | `/input` への navigate が一切なし（`/patrol/input` は使用中） |
| `/ranking/:storeId` | RankingView | MainInputからのみリンク → MainInput自体が到達不能 |
| `/patrol/camera` | PatrolCameraPage | Phase 4一時無効化（PatrolOverviewで導線コメントアウト） |
| `/patrol/batch-ocr` | PatrolBatchOcrPage | Phase 4一時無効化 |

### 確認済: 実際には使われているルート（要疑念解消済み）

| ルート | コンポーネント | 確認結果 |
|--------|--------------|---------|
| `/dashboard` | Dashboard | AdminMenuからリンクあり ✓ |
| `/patrol/booth` | BoothInput | PatrolScan/PatrolOverviewから遷移あり ✓ |
| `/machines/:storeId` | MachineList(patrol版) | PatrolOverviewから遷移あり ✓ |

---

## [F-02] サービス層 — 完全未使用ファイル

### services/movements.js — 全関数未使用
UIコンポーネントが一切インポートしていない。index.js に再エクスポートされているだけ。
StocktakeSummary.jsx は stock_movements テーブルに直接 supabase クエリを叩いており、このサービスを経由しない。

| 関数 | 状況 |
|------|------|
| `MOVEMENT_TYPES` | 0 usages（UI） |
| `getStockMovements` | 0 usages |
| `addStockMovement` | 0 usages |
| `transferStock` | 0 usages |
| `countStock` | 0 usages |

### services/inventory.js — 大部分未使用
movements.js が内部で import しているが、movements.js 自体がUIで未使用。

| 関数 | 状況 |
|------|------|
| `getPrizeStocksExtended` | movements.js 内部のみ（UI: 0） |
| `getStocksByOwner` | movements.js 内部のみ（UI: 0） |
| `addPrizeStock` | movements.js 内部のみ（UI: 0） |
| `updatePrizeStock` | movements.js 内部のみ（UI: 0） |
| `adjustPrizeStockQuantity` | 完全に未使用（movements.jsでも未使用） |

---

## [F-03] OCR関連コンポーネント（Phase 4一時無効化中）

| ファイル | 状況 |
|---------|------|
| patrol/pages/PatrolCameraPage.jsx | ルート存在、導線なし |
| patrol/pages/PatrolBatchOcrPage.jsx | ルート存在、導線なし |
| patrol/components/MeterOcr.jsx | OcrConfirmのReferenceError調査中 |
| patrol/components/OcrConfirm.jsx | ReferenceError中、無効化中 |
| patrol/components/OcrBatchList.jsx | PatrolBatchOcrPageで使用予定（無効化中） |
| patrol/services/ocrApi.js | OCR系ページが全滅なら実質未使用 |
| patrol/utils/exifReader.js | OCR系から使用（現在死コード） |
| patrol/utils/imageResize.js | OCR系から使用（現在死コード） |

---

## [F-04] フック — 完全未使用

| ファイル | 状況 |
|---------|------|
| `src/hooks/useMeterCalc.js` | テストのみ（`hooks.test.js`）。本番import 0件 |
| `src/hooks/usePatrolInput.js` | PatrolInput.jsx（legacy route）のみで使用 → 実質未使用 |

---

## [F-05] コンポーネント — 完全未使用

| ファイル | 状況 |
|---------|------|
| `src/components/RoleGuard.jsx` | テストのみ（`RoleAccess.test.jsx`）。本番import 0件 |

---

## [F-06] ユーティリティ関数 — 未使用

`src/utils/format.js` 内:

| 関数 | 状況 |
|------|------|
| `fmtDiff(n)` | 外部から一切使用なし |
| `fmtRate(n)` | 外部から一切使用なし |
| `fmtNum(n)` | fmtDiff内部でのみ使用（fmtDiff自体が未使用のため実質デッド） |

---

## [F-07] patrolV2.js — 部分的未使用

| 関数 | 状況 |
|------|------|
| `getLockerSlots` | export されているが、呼び出し元なし（0 usages） |

---

## 総合サマリー

| 分類 | アイテム |
|------|---------|
| 到達不能ルート（完全） | /patrol/input-legacy, /input, /ranking/:storeId |
| 一時無効化ルート（Phase 4） | /patrol/camera, /patrol/batch-ocr |
| 未使用サービスファイル | movements.js（全関数）, inventory.js（全関数） |
| 未使用フック | useMeterCalc.js |
| 未使用コンポーネント | RoleGuard.jsx |
| 未使用関数（部分） | fmtDiff, fmtRate, fmtNum（format.js）, getLockerSlots（patrolV2.js） |
| 実質デッドコード（legacy経由） | PatrolInput.jsx, usePatrolInput.js |
