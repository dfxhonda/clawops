import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-AUTH-01: 認証 + ハブ + 自動ログアウト基盤
// Stage 1 Acceptance 検証
// - /clawsupport ハブで店舗リスト表示
// - 50音タブで絞り込み
// - 15分無操作 → /login 強制遷移
// - 14分目に警告バナー表示
// - タップでタイマーリセット（バナー消去 + ログアウト回避）

// あ行 (アキハバラ) とか行 (カワサキ) に分けて絞り込みテストを可能にする
const MOCK_STORES = [
  { store_code: 'AKB01', store_name: 'アキバ本店', locality: '秋葉原', locality_kana: 'アキハバラ' },  // あ tab
  { store_code: 'KWS01', store_name: 'カワサキ店', locality: '川崎市', locality_kana: 'カワサキ' },   // か tab
]

async function setupHubMocks(page) {
  await page.route('**/rest/v1/stores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STORES),
    })
  })
  await page.route('**/rest/v1/staff_pinned_stores**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    }
  })
  // Login.jsx が fetch するスタッフ情報
  await page.route('**/rest/v1/staff**',        async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/staff_public**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

test.describe('J-AUTH-01: ハブ表示 + 自動ログアウト', () => {
  test('ハブで店舗リストが表示される（50音タブ経由）', async ({ page }) => {
    await setupAuth(page)
    await setupHubMocks(page)
    await page.goto('/clawsupport')

    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 5000 })

    // デフォルトは★タブ（ピン留めなし）→ あ タブで表示確認
    await page.getByRole('button', { name: 'あ' }).click()
    await expect(page.getByText('アキバ本店')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'か' }).click()
    await expect(page.getByText('カワサキ店')).toBeVisible({ timeout: 3000 })
  })

  test('50音タブで絞り込み: あ行のみ表示', async ({ page }) => {
    await setupAuth(page)
    await setupHubMocks(page)
    await page.goto('/clawsupport')

    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 5000 })

    // 「あ」タブ → アキバ本店だけ見える、カワサキ店は見えない
    await page.getByRole('button', { name: 'あ' }).click()
    await expect(page.getByText('アキバ本店')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('カワサキ店')).not.toBeVisible()
  })

  test('14分無操作で警告バナーが表示される', async ({ page }) => {
    await page.clock.install()
    await setupAuth(page)
    await setupHubMocks(page)
    await page.goto('/clawsupport')

    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 5000 })

    // 14分経過 → 警告バナー出現
    await page.clock.fastForward(14 * 60 * 1000)
    await expect(page.getByTestId('idle-warning-banner')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('あと60秒で自動ログアウトします')).toBeVisible()
  })

  test('15分無操作で /login に強制遷移', async ({ page }) => {
    await page.clock.install()
    await setupAuth(page)
    await setupHubMocks(page)
    await page.goto('/clawsupport')

    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 5000 })

    // 15分 + 余裕 500ms で完全タイムアウト
    await page.clock.fastForward(15 * 60 * 1000 + 500)
    await page.waitForURL('**/login', { timeout: 5000 })
  })

  test('タップでタイマーリセット: バナーが消えてログアウトされない', async ({ page }) => {
    await page.clock.install()
    await setupAuth(page)
    await setupHubMocks(page)
    await page.goto('/clawsupport')

    await expect(page.getByText('クレサポ')).toBeVisible({ timeout: 5000 })

    // 14分後: バナー出現
    await page.clock.fastForward(14 * 60 * 1000)
    await expect(page.getByTestId('idle-warning-banner')).toBeVisible({ timeout: 3000 })

    // タップ → タイマーリセット → バナー消去
    await page.click('body')
    await expect(page.getByTestId('idle-warning-banner')).not.toBeVisible({ timeout: 3000 })

    // さらに 14分経過しても /login に遷移しない（タイマーリセット済）
    await page.clock.fastForward(60 * 1000)
    await expect(page).not.toHaveURL(/.*\/login/)
  })
})
