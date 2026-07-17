import { test, expect } from '@playwright/test'

// SPEC-PWA-LOGIN-VERSIONJSON-RELOAD-02 (D-062) gate_4:
// 390x844 login 画面が checkVersionAndReload() 配線後も安定描画し、reload ループが起きないこと。
// version.json を返しつつ guard キーを事前 seed して単発 reload も抑止 → ページロードは1回のみ（=ループ無し）。
// match/mismatch/guard の分岐ロジック本体は vitest (versionReload.test.js) で検証済み。

test.describe('D-062 login version-reload gate_4', () => {
  test('mobile 390x844: login renders stably, no reload loop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    // guard を事前 seed → checkVersionAndReload は 'guarded' で no-op (reload しない)
    await page.addInitScript(() => {
      try { sessionStorage.setItem('pwa-vreload:gate4sha', '1') } catch { /* noop */ }
    })

    let loads = 0
    page.on('load', () => { loads++ })

    await page.route('**/version.json', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'gate4sha' }) }))
    await page.route('**/auth/v1/**', r => r.fulfill({ status: 401, body: JSON.stringify({ message: 'Not authorized' }) }))
    await page.route('**/rest/v1/staff**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/staff_public**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Round 0')).toBeVisible({ timeout: 8000 })

    // 世代検知 + 潜在 reload が落ち着くまで待ち、ループが無いことを確認
    await page.waitForTimeout(2500)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Round 0')).toBeVisible()
    expect(loads, 'login must not reload-loop (guard holds)').toBe(1)

    await page.screenshot({ path: 'test-results/d062-login-390x844.png', fullPage: false })
  })
})
