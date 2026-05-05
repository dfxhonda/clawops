# 実装計画: PatrolPage 機種別フォーム制御 + play_price パイプライン

## Phase 1: play_price パイプライン接続（必須） ✅ 完了

- [x] 1.1 getMachineInfo() 戻り値に playPrice 追加 (patrolV2.js)
- [x] 1.2 getBoothHistory() SELECT に revenue, play_price 追加 (readings.js)
- [x] 1.3 usePatrolForm で playPrice 解決（booth > model > 100）
- [x] 1.4 save() で patrolData / changeData に playPrice 注入
- [x] 1.5 PatrolHeader に @{playPrice}円 表示追加
- [x] 1.6 PatrolPage から PatrolHeader へ playPrice を渡す
- [x] 1.7 BoothHistoryTable で revenue 計算実装（MonthlySummary は不使用）

## Phase 2: ガチャ巡回ゾーン editable 化（完了確認）

- [x] 2.1 D1 巡回ゾーン: PrizeCard が cost/zan/ho を NumpadField で編集可能（確認済み）
- [x] 2.2 D2 巡回ゾーン: OutGroupRow は readonly=false デフォルト、全ハンドラ接続済み（確認済み）

## Phase 3: クリーンアップ（オプション）

- [ ] 3.1 PatrolOverview の isGacha() 簡素化（本番データ確認後）
- [ ] 3.2 CalcBar に revenue 表示追加

## Phase 4: バグ修正・セキュリティ

- [x] 4.1 patrolV2.js getBoothHistory: 先頭レコードの in_diff/out_diff を 0 で上書きするバグ修正
- [x] 4.2 NativeCamera.jsx: VITE_ANTHROPIC_API_KEY 直叩き → ocr-meter Edge Function 経由に移行（ADR-003）

## 検証

- [ ] npm run build
- [ ] npm test
