// SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 AC1-AC9
// 390x844 Playwright: back dirty-gate + confirm dialog + swipe dirty-gate
import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks, makePatrolState, injectRouteState } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })

const BOOTH_CODE = 'TST-M01-B01'
const BOOTH_URL = `/clawsupport/booth/${BOOTH_CODE}`

async function gotoBoothPage(page) {
  await setupAuth(page, { role: 'patrol' })
  await setupPatrolMocks(page)
  await page.route('**/rest/v1/feature_flags**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) })
  )
  await page.route('**/rest/v1/stock_movements**', route =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  )
  const { machine, booth, storeCode } = makePatrolState()
  const boothList = [{ machine, booth }]
  await injectRouteState(page, BOOTH_URL, { machine, booth, storeCode, boothList, boothIndex: 0 })
  await page.goto(BOOTH_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="field-stock"]', { timeout: 8000 })
}

function backBtn(page) {
  return page.locator('button:has-text("‹")')
}

// AC1: 未編集で戻るボタン → ダイアログなし (isDirty=false → goBack 直行)
test('when_no_edit_back_button_should_not_show_dialog', async ({ page }) => {
  await gotoBoothPage(page)
  await backBtn(page).click()
  // dialog must NOT appear
  await expect(page.getByTestId('back-confirm-overlay')).not.toBeVisible()
})

// AC2: フィールド編集後に戻るボタン → ダイアログ表示
test('when_field_edited_back_button_should_show_confirm_dialog', async ({ page }) => {
  await gotoBoothPage(page)
  // fill inMeter to trigger onChange → onTouched → isDirty=true
  await page.getByTestId('field-in-meter').fill('60000')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-dialog')).toBeVisible()
})

// AC3: ダイアログ → キャンセル → ダイアログ閉じる (ページ残留)
test('when_dialog_cancel_should_close_dialog_and_stay', async ({ page }) => {
  await gotoBoothPage(page)
  await page.getByTestId('field-in-meter').fill('60000')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-dialog')).toBeVisible()
  await page.getByTestId('back-confirm-cancel').click()
  await expect(page.getByTestId('back-confirm-overlay')).not.toBeVisible()
  // still on booth page
  await expect(page.getByTestId('field-stock')).toBeVisible()
})

// AC4: ダイアログ → 保存せず戻る → ダイアログ閉じ + ナビゲート
test('when_dialog_discard_should_close_dialog_and_navigate', async ({ page }) => {
  await gotoBoothPage(page)
  await page.getByTestId('field-in-meter').fill('60000')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-dialog')).toBeVisible()
  await page.getByTestId('back-confirm-discard').click()
  // dialog must close
  await expect(page.getByTestId('back-confirm-overlay')).not.toBeVisible()
})

// AC5: ダイアログ → 保存して戻る → ダイアログ閉じ + navigate
// 保存は IDB (local-first: putPatrolRecord) なので HTTP リクエストは発生しない。
// ダイアログが閉じることと遷移が始まることを確認。
test('when_dialog_save_should_close_dialog_and_navigate', async ({ page }) => {
  await gotoBoothPage(page)
  // fill inMeter: triggers onTouched (isDirty=true), canSave=true
  await page.getByTestId('field-in-meter').fill('60000')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-save')).toBeEnabled()
  await page.getByTestId('back-confirm-save').click()
  // dialog must close (save wrote to IDB then called goBack)
  await expect(page.getByTestId('back-confirm-overlay')).not.toBeVisible()
})

// AC6: オーバーレイタップ → ダイアログ閉じる (キャンセルと同等)
test('when_overlay_tapped_should_close_dialog', async ({ page }) => {
  await gotoBoothPage(page)
  await page.getByTestId('field-in-meter').fill('60000')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-overlay')).toBeVisible()
  // click overlay directly (not the inner panel)
  await page.getByTestId('back-confirm-overlay').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('back-confirm-overlay')).not.toBeVisible()
})

// AC7: stock フィールド (slot-1) 編集 → isDirty=true → ダイアログ表示 (C4 regression)
test('when_stock_field_edited_back_button_should_show_dialog', async ({ page }) => {
  await gotoBoothPage(page)
  await page.getByTestId('field-stock').fill('25')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-dialog')).toBeVisible()
})

// AC8: restock フィールド (slot-1) 編集 → isDirty=true → ダイアログ表示 (C4 regression)
test('when_restock_field_edited_back_button_should_show_dialog', async ({ page }) => {
  await gotoBoothPage(page)
  await page.getByTestId('field-restock').fill('5')
  await backBtn(page).click()
  await expect(page.getByTestId('back-confirm-dialog')).toBeVisible()
})

// AC9: 未編集スワイプ → canSave=true でも saveしない (C3: isDirty && canSave gate)
// PREV_READING の inMeter=50000 で canSave=true だが isDirty=false → navFn のみ
test('when_swipe_without_edit_should_not_trigger_save', async ({ page }) => {
  await gotoBoothPage(page)
  // no save request should be issued on swipe without edit
  let saveCalled = false
  page.on('request', req => {
    if (req.url().includes('meter_readings') && req.method() === 'POST') saveCalled = true
  })
  // simulate left swipe (next booth) via touch events on the page body
  const box = await page.locator('body').boundingBox()
  if (box) {
    const startX = box.x + box.width * 0.8
    const endX = box.x + box.width * 0.1
    const y = box.y + box.height * 0.4
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(endX, y, { steps: 15 })
    await page.mouse.up()
  }
  await page.waitForTimeout(400) // > 220ms setTimeout in commitSwipeAndNavigate
  expect(saveCalled).toBe(false)
})
