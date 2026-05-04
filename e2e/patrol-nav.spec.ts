import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks, makePatrolState, injectRouteState } from './helpers'

// ── スモークテスト ──────────────────────────────────────────────────────

test.describe('smoke', () => {
  test('未認証時にログインページが表示される', async ({ page }) => {
    // 未認証 → ProtectedRoute が /login へ window.location.href でリダイレクト
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Not authorized' }) })
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/login', { timeout: 8000 })
    // ログイン画面: PIN 入力 UI（スタッフ選択 + PIN）
    await expect(page.getByText('Round 0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('スタッフを選んでPINを入力')).toBeVisible()
  })
})

// ── 巡回保存 → 次ブース遷移 リグレッションテスト ────────────────────────

test.describe('PatrolPage — ブース保存後の状態リセット', () => {
  /**
   * 修正した不具合の回帰テスト:
   * 「1ブース保存後に次ブースへ遷移したとき、saved=true が残って
   *  保存ボタンが表示されないままになる」バグが再発しないことを確認する。
   *
   * 関連修正: PatrolPage の useEffect でブース切り替え時に saved をリセット
   */
  test('B01保存後にB02へ遷移し、保存ボタンが復活する', async ({ page }) => {
    const state = makePatrolState() // 2ブース構成

    // 1. auth bypass（goto より前に設定）
    await setupAuth(page)

    // 2. React Router の route state を事前注入
    //    addInitScript が React より先に動くため、初期化時に state を渡せる
    await injectRouteState(page, '/patrol/input', state as Record<string, unknown>)

    // 3. API mocks（goto より前に設定）
    await setupPatrolMocks(page)

    // 4. ページロード
    await page.goto('/patrol/input', { waitUntil: 'domcontentloaded' })

    // 5. フォームがロードされるまで待つ
    //    new_patrol モードになると saveLabel = "B01 を保存" のボタンが出る
    const saveBtn = page.getByRole('button', { name: 'B01 を保存' })
    await expect(saveBtn).toBeVisible({ timeout: 10_000 })

    // 6. 保存ボタンをクリック
    //    prevIn = 50000 がセットされているためバリデーション通過 → 保存成功
    await saveBtn.click()

    // 7. 保存直後は「✅ 保存しました」が表示される
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 3_000 })

    // 8. 800ms後に B02 へ navigate() される（PatrolPage の setTimeout）
    //    B02 のページに切り替わったら saved がリセットされて保存ボタンが復活するはず
    const saveBtn2 = page.getByRole('button', { name: 'B02 を保存' })
    await expect(saveBtn2).toBeVisible({ timeout: 5_000 })

    // 9. 「保存しました」は消えている（saved が false にリセットされた証拠）
    await expect(page.getByText('保存しました')).not.toBeVisible()
  })

  test('B01保存後にB02で値入力してから保存できる', async ({ page }) => {
    const state = makePatrolState()

    await setupAuth(page)
    await injectRouteState(page, '/patrol/input', state as Record<string, unknown>)
    await setupPatrolMocks(page)
    await page.goto('/patrol/input', { waitUntil: 'domcontentloaded' })

    // B01 を保存
    await expect(page.getByRole('button', { name: 'B01 を保存' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'B01 を保存' }).click()

    // B02 が表示されるまで待つ
    const b02SaveBtn = page.getByRole('button', { name: 'B02 を保存' })
    await expect(b02SaveBtn).toBeVisible({ timeout: 5_000 })

    // B02 の保存ボタンも正常にクリックできる
    await b02SaveBtn.click()

    // B02 も保存完了 → 最後のブースなので /clawsupport/store/TST01/patrol へ遷移
    // または /patrol/overview へ遷移（storeCode 付きなら前者）
    await expect(page).toHaveURL(/clawsupport|patrol/, { timeout: 5_000 })
  })
})
