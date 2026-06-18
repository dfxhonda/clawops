/**
 * SPEC-E2E-GATE4-STORE-PIN-COVERAGE-01 (fixed by SPEC-E2E-GATE4-FIX-01)
 *
 * RED tests (4): Pages that still use StoreSelectSheet (no pin star) — MUST FAIL.
 *   These are intentionally left failing to document upgrade debt.
 *   Do NOT xfail / skip them.
 *   Target: /admin/machines, /admin/booths, /admin/lockers, /datasearch
 *
 * GREEN tests (2): Pages upgraded to StorePickerSheet — MUST PASS.
 *   Target: /admin/audit/booth-edit, /collection/input
 *
 * Removed (SPEC-E2E-GATE4-FIX-01): red-patrol-overview and red-booth-qr-print
 *   were route-orphans: /patrol/overview redirects to ClawsupportHub (no StoreSelectSheet),
 *   /admin/qr-print route was deleted (J-NAV-ORPHAN-CLEANUP-01 2026-05-30).
 *   They failed for the wrong reason (unreachable, not star-absent). Removed.
 *   Their dead StoreSelectSheet imports will be cleaned up at StoreSelectSheet deletion time.
 *
 * Actor: STAFF-03 (has pinned stores → GREEN star assertions are meaningful).
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
