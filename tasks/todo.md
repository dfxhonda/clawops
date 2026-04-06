# 実装計画: useAsync統一 + reason_code/reason_note UI

## Task 1: useAsync統一
- [x] Step 1a: InventoryTransfer.jsx
- [x] Step 1b: InventoryCount.jsx
- [x] Step 1c: InventoryReceive.jsx
- [x] Step 1d: DataSearch.jsx

## Task 2: reason_code/reason_note UI
- [x] Step 2a: ReasonSelect コンポーネント作成
- [x] Step 2b: サービス関数の拡張（transferStock, countStock, updateReading, markOrderArrived）
- [x] Step 2c: InventoryTransfer.jsx にReasonSelect追加
- [x] Step 2d: InventoryCount.jsx にReasonSelect追加
- [x] Step 2e: EditReading.jsx にReasonSelect追加
- [x] Step 2f: InventoryReceive.jsx にReasonSelect追加

## 検証
- [x] `npm test` 全パス (108/108)
- [x] `npm run build` 成功
