# 実装計画: PatrolPage 機種別フォーム制御 + play_price パイプライン

## Phase 1: play_price パイプライン接続（必須） ✅ 完了

- [x] 1.1 getMachineInfo() 戻り値に playPrice 追加 (patrolV2.js)
- [x] 1.2 getBoothHistory() SELECT に revenue, play_price 追加 (readings.js)
- [x] 1.3 usePatrolForm で playPrice 解決（booth > model > 100）
- [x] 1.4 save() で patrolData / changeData に playPrice 注入
- [x] 1.5 PatrolHeader に @{playPrice}円 表示追加
- [x] 1.6 PatrolPage から PatrolHeader へ playPrice を渡す
- [x] 1.7 BoothHistoryTable で revenue 計算実装（MonthlySummary は不使用）

## Phase 2: ガチャ巡回ゾーン editable 化（推奨）

- [ ] 2.1 D1 巡回ゾーン: PrizeRow prizeRO/costRO 除去 + ハンドラ追加
- [ ] 2.2 D2 巡回ゾーン: OutGroupRow readonly 除去 + ハンドラ追加

## Phase 3: クリーンアップ（オプション）

- [ ] 3.1 PatrolOverview の isGacha() 簡素化（本番データ確認後）
- [ ] 3.2 CalcBar に revenue 表示追加

## 検証

- [ ] npm run build
- [ ] npm test
