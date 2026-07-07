// SPEC-ADMIN-STAFF-SOFT-DELETE-01: confirmDelete must call the atomic soft-delete RPC
// instead of the two raw client .delete() calls, and must not double-log the audit
// (audit now happens inside the RPC transaction). Source-contract test in the repo style
// (cf. patrolSwipeLatencyFix03.test.js). DB-level ACs (AC2-AC6) are verified via live SQL
// against the project and recorded in the spec status_log.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = readFileSync(
  fileURLToPath(new URL('../../admin/pages/AdminStaffListPage.jsx', import.meta.url)),
  'utf8'
)

// Extract the confirmDelete() function body for scoped assertions.
function fnBody(source, name) {
  const start = source.indexOf(`async function ${name}(`)
  if (start === -1) throw new Error(`function ${name} not found`)
  // find matching close: next 'async function ' at column 0-ish, else end
  const rest = source.slice(start + 1)
  const nextFn = rest.indexOf('\n  async function ')
  const nextTop = rest.indexOf('\n  const gridCellCls')
  const ends = [nextFn, nextTop].filter(i => i !== -1)
  const end = ends.length ? Math.min(...ends) : rest.length
  return rest.slice(0, end)
}

describe('SPEC-ADMIN-STAFF-SOFT-DELETE-01 confirmDelete contract', () => {
  const confirmDelete = fnBody(src, 'confirmDelete')

  it('calls the fn_admin_delete_staff RPC with p_staff_id and p_actor_staff_id', () => {
    expect(confirmDelete).toContain("supabase.rpc('fn_admin_delete_staff'")
    expect(confirmDelete).toContain('p_staff_id: modal.staff_id')
    expect(confirmDelete).toContain('p_actor_staff_id: staffId')
  })

  it('no longer issues raw client deletes on staff or staff_stores', () => {
    expect(confirmDelete).not.toMatch(/from\(['"]staff['"]\)\s*\.delete\(/)
    expect(confirmDelete).not.toMatch(/from\(['"]staff_stores['"]\)\s*\.delete\(/)
  })

  it('does not double-log via client writeAuditLog inside confirmDelete (RPC audits atomically)', () => {
    expect(confirmDelete).not.toContain('writeAuditLog(')
  })

  it('keeps the ERR-STAFF-004 error path', () => {
    expect(confirmDelete).toContain("code: 'ERR-STAFF-004'")
  })

  it('preserves the 24h-login pre-delete warning (startDelete queries device_login_history)', () => {
    const startDelete = fnBody(src, 'startDelete')
    expect(startDelete).toContain("from('device_login_history')")
    expect(startDelete).toContain('active_within_24h')
  })
})
