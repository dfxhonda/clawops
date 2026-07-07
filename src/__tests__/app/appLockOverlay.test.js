// SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: App.jsx wires the lock overlay above a still-mounted Routes
// tree and the overlay markup uses fixed inset-0 + existing tokens only. Source-contract test in
// the repo style (cf. staffSoftDelete.test.js) — full App render pulls in lazy routes/providers.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8')

function block(source, header, endMarker = '\n}') {
  const start = source.indexOf(header)
  if (start === -1) throw new Error(`${header} not found`)
  const end = source.indexOf(endMarker, start)
  return source.slice(start, end === -1 ? source.length : end + endMarker.length)
}

describe('SPEC-AUTH-TIMEOUT-LOCKSCREEN-01 App.jsx wiring (AC6)', () => {
  it('captures the hook return value into isLocked', () => {
    expect(src).toContain('const isLocked = useSessionLock(isLoggedIn)')
  })

  it('renders AppLockOverlay only when isLoggedIn && isLocked', () => {
    expect(src).toContain('{isLoggedIn && isLocked && <AppLockOverlay />}')
  })

  it('overlay is a self-closing cover — it never wraps/remounts Routes (no key remount)', () => {
    // self-closing => Routes cannot be a child of the overlay
    expect(src).toMatch(/<AppLockOverlay\s*\/>/)
    // Routes must not be keyed on isLocked (would remount the tree on lock/unlock)
    expect(src).not.toMatch(/<Routes[^>]*key=\{[^}]*isLocked/)
  })
})

describe('SPEC-AUTH-TIMEOUT-LOCKSCREEN-01 AppLockOverlay markup (AC7)', () => {
  const overlay = block(src, 'function AppLockOverlay() {')

  it('uses fixed inset-0 (viewport-anchored), never h-dvh/h-svh/h-screen', () => {
    expect(overlay).toContain('fixed inset-0')
    expect(overlay).not.toMatch(/h-dvh|h-svh|h-screen/)
  })

  it('uses only existing --color-bg / --color-accent / --color-muted tokens', () => {
    expect(overlay).toContain('bg-bg')
    expect(overlay).toContain('text-accent')
    expect(overlay).toContain('text-muted')
  })

  it('has a high z-index above the z-[90] banner/buildLabel', () => {
    expect(overlay).toContain('z-[200]')
  })
})
