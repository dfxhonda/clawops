# J-PATROL-15 実装計画
> generated: 2026-05-10

## 目的
machine_centric_view + booth_collapse + store_total_inline + remove_revenue_profit_chips
ブース単位リスト → 機械単位リスト変更、売上/粗利 chip 全面削除、PatrolStorePage sticky bar 廃止

## 影響範囲

### 新規作成
- `src/clawsupport/components/MachineRow.jsx`
- `src/clawsupport/components/MachineRowExpandedBoothList.jsx`
- `src/services/storeMachineSummary.js`
- `e2e/journey-patrol-15.spec.js`

### 変更
- `src/clawsupport/pages/PatrolMachineListPage.jsx`
- `src/clawsupport/pages/PatrolStorePage.jsx`
- `e2e/journey-patrol-11.spec.js` (11c/11d/gotoStorePage 更新)

### 触らない (scope.forbidden)
- `src/services/patrolCore.js`
- `src/types/supabase.d.ts`
- `src/admin/`
- `scripts/eval/`
- `supabase/migrations/`
- `src/clawsupport/components/NumpadField.jsx`
- `src/clawsupport/components/Tooltip.jsx`
- `src/clawsupport/components/PrizeNameAutocomplete.jsx`

## 実装ステップ

- [ ] Step 1: `storeMachineSummary.js` 作成
  - `fetchStoreMachineDiffs(machines)` — fetchBoothDiffMap ラップ、diffMap + storeInTotal/storeOutTotal を返す
  - SELECT専用、revenue/profit は計算しない (meterUnitPriceMap={} で渡す)

- [ ] Step 2: `MachineRowExpandedBoothList.jsx` 作成
  - booths の各行: `data-testid="booth-row-{booth_code}"`
  - IN差/OUT差 chip 2個のみ (diff-chip-IN, diff-chip-OUT)
  - ml-6 インデント、各ブース tap → onBoothClick(booth)

- [ ] Step 3: `MachineRow.jsx` 作成
  - `data-testid="machine-row-{machine_code}"` コンテナ
  - `data-testid="machine-row-btn-{machine_code}"` ボタン
  - 1ブース機械: ChevronRight なし、row 全体 tappable → onBoothClick(booths[0])
  - 多ブース機械: ChevronRight + useState(isExpanded) + transition-transform duration-200
  - 機械合計 IN差/OUT差 chip 2個 (diff-chip-IN, diff-chip-OUT)
  - 展開時: MachineRowExpandedBoothList (max-h-0→max-h-screen, overflow-hidden, duration-200)

- [ ] Step 4: `PatrolMachineListPage.jsx` 更新
  - MachineListRow import 削除 → MachineRow import 追加
  - fetchBoothDiffMap 直接呼び出し → fetchStoreMachineDiffs に変更
  - machines.map: 機械名ヘッダ + booth loop → MachineRow に一本化
  - onBoothClick: navigate('/clawsupport/booth/' + booth.booth_code, { state: ... })

- [ ] Step 5: `PatrolStorePage.jsx` 更新
  - fetchStoreSummary, SummaryChip, fmtMoney, fmtRate 削除
  - fetchStoreMachineDiffs でまとめて diffMap + storeInTotal/storeOutTotal 取得
  - sticky bar (`data-testid="store-summary-bar"`) → 削除
  - PageHeader 下に `data-testid="store-inline-total"` div + DiffChip 2個 (IN/OUT 店舗合計)
  - MachineListRow → MachineRow に変更

- [ ] Step 6: `journey-patrol-11.spec.js` 更新
  - `gotoStorePage`: waitForSelector を `store-summary-bar` → `store-inline-total` に変更
  - `J-PATROL-11c`: 機械行ボタンクリック→展開後にブース行確認、chip 2個 (IN/OUT のみ)
  - `J-PATROL-11d`: sticky bar チェック削除 → store-inline-total + IN/OUT chip チェックに変更

- [ ] Step 7: `journey-patrol-15.spec.js` 作成
  - mockCommon: machines API で 1ブース機械 + 多ブース機械をモック
  - 15a: 機械単位グルーピング確認 (machine-row testid 存在、booth-row は展開前非表示)
  - 15b: 1ブース機械行 tap → /clawsupport/booth/{code} ナビゲート
  - 15c: 多ブース機械 → ChevronRight 表示 + 折り畳みデフォルト
  - 15d: クリック展開 → chevron rotate + ブース行表示
  - 15e: 折り畳み時 機械合計 chip 2個のみ (diff-chip-IN, diff-chip-OUT)
  - 15f: 展開時 各ブース行 chip 2個 (diff-chip-IN, diff-chip-OUT)
  - 15g: PatrolStorePage store-inline-total に IN差/OUT差 chip 2個
  - 15h: 200ms transition (ChevronRight rotate)
  - 15i: diff-chip-売上, diff-chip-粗利 が画面に 0件
  - 15j: store-summary-bar が 0件

- [ ] Step 8: `npm run build` green
- [ ] Step 9: `npm run lint` green
- [ ] Step 10: `npm run test` (vitest) green
- [ ] Step 11: `npx playwright test journey-patrol-15` green
- [ ] Step 12: `npx playwright test journey-patrol-11` green
- [ ] Step 13: `npx playwright test` (全体) green
- [ ] Step 14: git commit + push main
- [ ] Step 15: ntfy 通知

## 検証方法
- build: vite build エラー 0件
- lint: eslint エラー 0件
- vitest: npm run test 全 pass
- playwright: journey-patrol-15 10テスト全 green
- playwright: journey-patrol-11 全 green (gotoStorePage wait 変更後)
- playwright: journey-patrol-06/07/12/13-14 変更なし → 全 green

## リスク・注意点
- PatrolMachineListPage は現在 App.jsx でルート未登録 → 更新はするが e2e は PatrolStorePage で実施
- gotoStorePage の waitForSelector 変更で他テストが壊れていないか確認必須
- J-PATROL-11g (text-xs 0件チェック) は booth-history-list スコープのみ → MachineRow は影響外
- storeMachineSummary.js は fetchBoothDiffMap を内部で呼ぶ → meterUnitPriceMap={} で渡す
- MachineRow の DiffChip を MachineListRow.jsx の DiffChip と別定義 (scope.write に MachineListRow なし)
