import { test, expect } from 'vitest'

// Canary: CI-only intentional fail to verify rollback gate works without 403.
// Remove this file after rollback step is confirmed green.
test.skipIf(!process.env.GITHUB_ACTIONS)('rollback-gate canary: intentional CI fail', () => {
  expect('rollback-gate-verified').toBe('FAIL')
})
