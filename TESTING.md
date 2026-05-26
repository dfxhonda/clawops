# テストの書き方 (clawops)

CLAUDE.md「テスト方針」の実務ガイド。全テストはトークン0で回る（`npm test` / `npm run test:e2e`、pre-push + CI 自動）。

## コマンド
| 目的 | コマンド |
|---|---|
| ロジック/コンポーネント (vitest) | `npm test` (= `vitest run`) |
| カバレッジ付き | `npm run test:coverage` |
| 1ファイルだけ | `npx vitest run src/path/to/file.test.js` |
| E2E (Playwright) | `npm run test:e2e` |
| E2E 1ファイル | `npx playwright test e2e/xxx.spec.js --project=chromium` |
| ブラウザ未導入時 | `npx playwright install chromium` |

## テストピラミッド（どこに書くか）
1. **ロジック（関数単位）= Vitest**：最速、最初に書く。例 `src/services/*.test.js`, `src/clawsupport/utils/*.test.js`。`// @vitest-environment node`。
2. **コンポーネント / hook = React Testing Library + Vitest**：`// @vitest-environment happy-dom` + `render/screen/fireEvent`。例 `*.test.jsx`。
3. **ユーザー操作シナリオ = Playwright E2E**：`e2e/*.spec.js`。リグレッション最強。
4. **外部依存は必ずモック**：Supabase は MSW（`src/__tests__/msw/`）か E2E の `page.route('**/rest/v1/...')`。ネットに出ない。

## ルール（CLAUDE.md より）
- 新機能・バグ修正は **失敗ケースのテストを先に**書く（TDD）。
- バグ修正 commit には **再現テストをペア**で入れる。
- test 名は **when_X_should_Y**（「〜の時 X が起こるべき」）。原則 **1 test 1 assertion**。

## Vitest: supabase を import する純関数のテスト
`supabase.js` は env 必須で import 時に throw するためモックする（`patrolCore` 等）。
```js
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))
const { classifyEntryType } = await import('../../services/patrolCore')
```
env 依存の module-level const を差し替える時は `vi.stubEnv` → `vi.resetModules()` → 動的 import（例 `src/pages/DualTrackSelectPage.test.jsx`）。

## E2E: 認証バイパス & API モック（`e2e/helpers.ts`）
```js
import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

test('when_X_should_Y', async ({ page }) => {
  await setupAuth(page, { role: 'patrol' })   // admin|manager|patrol|staff のペルソナ
  await setupPatrolMocks(page)                 // machines/meter_readings(PREV_READING)/stores 等を全モック
  await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })
  // ...
})
```
- **ペルソナ**: `setupAuth({ role })` で localStorage セッション注入 + `/auth/v1/**` モック。
- **route state 注入**: `injectRouteState(page, path, state)`（React Router の `history.state.usr`）。本リポの新ブース入力は `state:{machine,booth,storeCode,boothList,boothIndex}` を渡す。
- **追加モック**: `page.route('**/functions/v1/ocr-meter', ...)`（OCR）, `**/storage/v1/**`（写真）, `**/rest/v1/prize_masters**`（景品検索）など。
- **ファイル入力**（読み取り＝純正カメラ/ギャラリー）: `page.locator('input[type="file"]').setInputFiles({ name, mimeType:'image/jpeg', buffer })`。

## 主な testid（E2E セレクタ）
- 巡回入力: `field-in-meter` / `field-out-meter` / `field-stock` / `field-restock` / `field-prize-name-8`
- 保存ボタン: `save-next-button`（保存して次へ）/ `save-list-button`（保存してリストへ）/ `save-button`（単一）
- OCR確認: `ocr-confirm-in` / `ocr-confirm-out`、✕ は role=button name「閉じる」
- リスト: `machine-row-<code>` / `booth-row-<code>` / `launcher-tile-<key>`
- 景品サジェスト: `prize-autocomplete-list` / `prize-candidate-0`

## 例（このリポの実テスト）
- ロジック: `src/clawsupport/utils/patrolStockCalc.test.js`（理論在庫）, `meterValidation.test.js`, `src/__tests__/services/classifyEntryType.test.js`
- コンポーネント: `src/clawsupport/components/NumpadField.test.jsx`, `src/pages/DualTrackSelectPage.test.jsx`
- E2E: `e2e/journey-patrol-booth-input.spec.js`, `e2e/journey-launcher-persona.spec.js`, `e2e/journey-patrol-ocr-confirm.spec.js`
