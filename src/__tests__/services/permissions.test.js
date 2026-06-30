// permissions: isAdmin + canEditMeter
import { describe, it, expect } from 'vitest'
import { isAdmin, canEditMeter } from '../../services/permissions'

describe('permissions', () => {
  it('when_role_admin_isAdmin_should_return_true', () => {
    expect(isAdmin('admin')).toBe(true)
  })
  it('when_role_manager_isAdmin_should_return_false', () => {
    expect(isAdmin('manager')).toBe(false)
  })
  it('when_role_admin_canEditMeter_should_return_true', () => {
    expect(canEditMeter('admin')).toBe(true)
  })
  it('when_role_patrol_canEditMeter_should_return_false', () => {
    expect(canEditMeter('patrol')).toBe(false)
  })
})
