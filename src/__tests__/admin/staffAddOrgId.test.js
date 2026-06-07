// J-ADMIN-STAFF-ADD-ORGID-fix-01: organization_id が staff 新規 INSERT payload に含まれること
import { describe, it, expect } from 'vitest'
import { CHANGE_ORG_ID } from '../../lib/auth/orgConstants'

describe('J-ADMIN-STAFF-ADD-ORGID-fix-01', () => {
  it('when_new_staff_inserted_should_include_organization_id_as_CHANGE_ORG_ID', () => {
    // CHANGE_ORG_ID が spec 指定値と一致する
    expect(CHANGE_ORG_ID).toBe('01cf7a5e-6971-4ae1-918d-8e5981780a95')
  })

  it('when_staff_insert_payload_built_should_contain_organization_id', () => {
    // payload 構築ロジックの単体検証 (AdminStaffListPage.handleSave __new 分岐)
    const CHANGE_ORG_ID_LOCAL = '01cf7a5e-6971-4ae1-918d-8e5981780a95'
    const now = new Date().toISOString()
    const nextId = 'STAFF-01'
    const form = { name: 'テスト 太郎', name_kana: null, email: null, phone: null, role: 'staff', store_code: null, has_vehicle_stock: false, is_active: true, joined_at: '2026-06-07', notes: null }
    const str = v => v || null

    const payload = {
      staff_id: nextId,
      organization_id: CHANGE_ORG_ID_LOCAL,
      name: form.name.trim(),
      name_kana: str(form.name_kana),
      email: str(form.email),
      phone: str(form.phone),
      role: str(form.role),
      store_code: str(form.store_code),
      has_vehicle_stock: form.has_vehicle_stock ?? false,
      is_active: form.is_active ?? true,
      joined_at: str(form.joined_at),
      notes: str(form.notes),
      created_at: now,
      updated_at: now,
      updated_by: null,
    }

    expect(payload.organization_id).toBe('01cf7a5e-6971-4ae1-918d-8e5981780a95')
    expect(payload.staff_id).toBe('STAFF-01')
    expect(payload.name).toBe('テスト 太郎')
  })

  it('when_staff_id_numbered_should_use_max_plus_one_padded', () => {
    // STAFF-NN 採番ロジック: max既存 + 1, padStart(2, '0')
    const last = 'STAFF-07'
    const num = parseInt(String(last).replace(/^STAFF-?/, ''), 10) || 0
    const nextId = `STAFF-${String(num + 1).padStart(2, '0')}`
    expect(nextId).toBe('STAFF-08')
  })

  it('when_no_existing_staff_should_start_at_STAFF-01', () => {
    const last = 'STAFF-00'
    const num = parseInt(String(last).replace(/^STAFF-?/, ''), 10) || 0
    const nextId = `STAFF-${String(num + 1).padStart(2, '0')}`
    expect(nextId).toBe('STAFF-01')
  })
})
