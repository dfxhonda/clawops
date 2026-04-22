# J2-b: 日付ドロップダウン削除 + モード自動セット完全化

## 目標
- 巡回入力画面から date input を完全削除
- patrolDate は mode 判定ロジック（loadCorrectionData/loadReplaceData）経由でのみ更新
- 全モードバッジに日付を内包（二重表示回避）
- JST 違反 (toISOString) を修正

## 変更ファイル

- [ ] `src/patrol/components/PatrolHeader.jsx` — date input 削除、関連 props 除去
- [ ] `src/patrol/pages/PatrolPage.jsx` — date props 除去、モードバッジ統合
- [ ] `src/hooks/usePatrolForm.js` — toISOString 3箇所修正、setReadDate/dateOpts を return から除外
- [ ] `src/__tests__/components/PatrolHeader.test.jsx` — date input 不在アサーション (新規)

## やらないこと
- 過去日付入力機能 (J2-c)
- ChangeZone 改修 (J2-d/e)
- store_name_official はsrc内に存在しないことを確認済み → 対応不要

## 完了条件
- [ ] npm run build 通過
- [ ] npm test 全通過
- [ ] PatrolHeader に `input[type="date"]` が存在しないことをテストで確認
