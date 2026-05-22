import { test, expect } from 'vitest'

// Full-path canary: CI-only intentional fail to verify secrets-wired rollback + Discord notify.
// Remove immediately after gate confirmed end-to-end.
test.skipIf(!process.env.GITHUB_ACTIONS)('rollback-gate full-path canary: intentional CI fail', () => {
  expect('rollback-gate-e2e').toBe('FAIL')
})
