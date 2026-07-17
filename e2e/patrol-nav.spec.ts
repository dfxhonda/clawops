import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

// ── スモークテスト ──────────────────────────────────────────────────────

test.describe('smoke', () => {
  test('未認証時にログインページが表示される', async ({ page }) => {
    // 未認証 → ProtectedRoute が /login へ window.location.href でリダイレクト
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Not authorized' }) })
    })
    // Login.jsx が staff / staff_public を fetch する前に空配列を返してスピナーを即解除
    await page.route('**/rest/v1/staff**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/rest/v1/staff_public**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/login', { timeout: 8000 })
    // ログイン画面: PIN 入力 UI（スタッフ選択 + PIN）
    await expect(page.getByText('Round 0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('スタッフを選んでPINを入力')).toBeVisible()
  })
})

// ── SPEC-UI-B-DECOMM-LEGACY-PATROL-01: 旧巡回ルート削除 → Navigate catch (AC3) ─────────
// (旧 PatrolPage の保存リセット回帰テストは、PatrolPage 削除に伴い撤去)

test.describe('legacy patrol routes redirect to /clawsupport (DECOMM-01)', () => {
  const removed = ['/input', '/patrol', '/patrol/input', '/patrol/booth', '/booth/TST-M01', '/machines/TST01', '/complete', '/drafts']
  for (const path of removed) {
    test(`direct-visit ${path} -> /clawsupport`, async ({ page }) => {
      await setupAuth(page)
      await setupPatrolMocks(page)
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      // Navigate replace catch: 認証済みなら canonical hub へ着地 (404/旧画面にならない)
      await page.waitForURL('**/clawsupport', { timeout: 8000 })
      await expect(page).toHaveURL(/\/clawsupport$/)
    })
  }
})
