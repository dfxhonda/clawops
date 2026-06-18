/**
 * SPEC-E2E-STORE-PIN-ASSERT-RESTORE-01 (star assertion restored 2026-06-18)
 * SPEC-STORE-SELECT-UNIFY-TO-PICKER-01 (migration complete 2026-06-18)
 *
 * ALL 6 tests GREEN: StorePickerSheet on all screens, pin star verified.
 *
 * ASSERTION RULE: Each test MUST assert the pin star (.text-yellow-400), not merely
 * that the sheet opens. Do NOT weaken to sheet-open-only. A red->green flip that
 * drops the original assertion is a silent weakening and is rejected at gate_3
 * (incident: SPEC-E2E-STORE-PIN-ASSERT-RESTORE-01, detected at afd09da gate_3).
 *
 * Star facts (StorePickerSheet, develop):
 *   - Initial tab = ★ (pinned tab) → pinned stores shown first, no tab click needed.
 *   - STAFF-03 pins: TST01, MNK01, SMD01, KOS01, KKY01 (all is_active).
 *   - Sheet star: [data-testid="store-picker-sheet"] .text-yellow-400
 *   - Card star:  [data-testid="store-picker-item-MNK01"] .text-yellow-400
 *
 * Migrated (4): /admin/machines, /datasearch, /admin/booths, /admin/lockers
 * Original controls (2): /admin/audit/booth-edit, /collection/input
 *
 * Actor: STAFF-03 (has pinned stores → pin star assertions are meaningful).
 * PIN: E2E_HIRO_PIN env var (never hardcoded).
 */

import { test, expect, type Page } from '@playwright/test'
import { loginViaUI } from './helpers/login'

test.beforeEach(async ({ page }) => {
  await loginViaUI(page)
})

/** Assert the pin star renders after the sheet is open. ★ tab is default; no tab click needed. */
async function assertPinStar(page: Page) {
  await expect(page.locator('[data-testid="store-picker-sheet"] .text-yellow-400').first()).toBeVisible()
  await expect(page.locator('[data-testid="store-picker-item-MNK01"] .text-yellow-400')).toBeVisible()
}

// ─── GREEN (migrated): StorePickerSheet pages ────────────────────────────────

test('green-machine-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/machines')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})

test('green-booth-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/booths')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})

test('green-locker-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/lockers')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})

test('green-data-search: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/datasearch')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})

// ─── GREEN: StorePickerSheet positive controls (MUST PASS) ───────────────────

// AdminMachineListPage at /admin/audit/booth-edit uses StorePickerSheet (ProtectedRoute).
test('green-admin-booth-edit: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/audit/booth-edit')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})

// CollectionInputPage at /collection/input uses StorePickerSheet (ManagerRoute).
test('green-collection-input: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/collection/input')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
  await assertPinStar(page)
})
