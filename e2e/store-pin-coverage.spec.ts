/**
 * SPEC-STORE-SELECT-UNIFY-TO-PICKER-01 (migration complete 2026-06-18)
 *
 * ALL 6 tests GREEN: StoreSelectSheet fully replaced by StorePickerSheet.
 *
 * Migrated (4): /admin/machines, /datasearch, /admin/booths, /admin/lockers
 * Original controls (2): /admin/audit/booth-edit, /collection/input
 *
 * StoreSelectSheet.jsx deleted. PatrolOverview+BoothQrPrint dead imports removed
 * (route-orphans: /patrol/overview redirects to ClawsupportHub,
 *  /admin/qr-print route deleted J-NAV-ORPHAN-CLEANUP-01 2026-05-30).
 *
 * Actor: STAFF-03 (has pinned stores → pin star assertions are meaningful).
 * PIN: E2E_HIRO_PIN env var (never hardcoded).
 */

import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/login'

test.beforeEach(async ({ page }) => {
  await loginViaUI(page)
})

// ─── GREEN (migrated): StorePickerSheet pages ────────────────────────────────

test('green-machine-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/machines')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})

test('green-booth-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/booths')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})

test('green-locker-list: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/lockers')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})

test('green-data-search: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/datasearch')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})

// ─── GREEN: StorePickerSheet positive controls (MUST PASS) ───────────────────

// AdminMachineListPage at /admin/audit/booth-edit uses StorePickerSheet (ProtectedRoute).
test('green-admin-booth-edit: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/admin/audit/booth-edit')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})

// CollectionInputPage at /collection/input uses StorePickerSheet (ManagerRoute).
test('green-collection-input: store-picker-trigger present and sheet opens', async ({ page }) => {
  await page.goto('/collection/input')
  const trigger = page.getByTestId('store-picker-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId('store-picker-sheet')).toBeVisible()
})
