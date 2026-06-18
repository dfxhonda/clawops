/**
 * SPEC-E2E-GATE4-STORE-PIN-COVERAGE-01
 *
 * RED tests (6): Pages that still use StoreSelectSheet (no pin star) — MUST FAIL.
 *   These are intentionally left failing to document upgrade debt.
 *   Do NOT xfail / skip them.
 *
 * GREEN tests (2): Pages upgraded to StorePickerSheet — MUST PASS.
 *
 * Route notes:
 *   - PatrolOverview.jsx: route-orphan, /patrol/overview redirects to ClawsupportHub.
 *     ClawsupportHub has no StoreSelectSheet → store-select-sheet absent → RED.
 *   - BoothQrPrint.jsx: route deleted (J-NAV-ORPHAN-CLEANUP-01).
 *     /admin/qr-print → not-found → store-select-sheet absent → RED.
 */

import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/login'

test.beforeEach(async ({ page }) => {
  await loginViaUI(page)
})

// ─── RED: StoreSelectSheet pages (pin star absent → all FAIL) ────────────────

test('red-machine-list: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/admin/machines')
  await page.getByTestId('store-select-trigger').click()
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  // StoreSelectSheet has no pin star → assertion FAILS (RED)
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
})

test('red-booth-list: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/admin/booths')
  await page.getByTestId('store-select-trigger').click()
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
})

test('red-locker-list: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/admin/lockers')
  await page.getByTestId('store-select-trigger').click()
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
})

test('red-data-search: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/datasearch')
  await page.getByTestId('store-select-trigger').click()
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
})

// PatrolOverview is a route-orphan. /patrol/overview redirects to ClawsupportHub.
// ClawsupportHub does not render StoreSelectSheet → store-select-sheet absent → RED.
test('red-patrol-overview: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/patrol/overview')
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
})

// BoothQrPrint route was deleted (J-NAV-ORPHAN-CLEANUP-01).
// /admin/qr-print → redirect/not-found → store-select-sheet absent → RED.
test('red-booth-qr-print: store-select-sheet should show pinned star', async ({ page }) => {
  await page.goto('/admin/qr-print')
  await page.getByTestId('store-select-trigger').click()
  await expect(page.getByTestId('store-select-sheet')).toBeVisible()
  await expect(page.locator('[data-testid="store-select-sheet"] .text-yellow-400').first()).toBeVisible()
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
