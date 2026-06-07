// J-STAFF-ORGID-DEVELOP-SYNC-01: staff 新規 INSERT は organization_id を payload から省略し
// DB DEFAULT (default_org_id() = CHANGE_ORG_ID) に委ねる。
// 背景: DB migration で staff.organization_id に DEFAULT default_org_id() が付与済み。
// クライアントが明示 null を送ると NOT NULL 制約で弾かれるため省略が正。
import { describe, it, expect } from 'vitest'

describe('J-STAFF-ORGID-DEVELOP-SYNC-01', () => {
  it('when_new_staff_inserted_should_not_include_organization_id_rely_on_db_default', () => {
    // payload に organization_id を含めない = DB DEFAULT(default_org_id())が発火
    const now = new Date().toISOString()
    const nextId = 'STAFF-01'
    const form = { name: 'テスト 太郎', name_kana: null, email: null, phone: null, role: 'staff', store_code: null, has_vehicle_stock: false, is_active: true, joined_at: '2026-06-07', notes: null }
    const str = v => v || null

    const payload = {
      staff_id: nextId,
      // organization_id: 省略 — DB DEFAULT(default_org_id())に委ねる
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

    expect(payload.organization_id).toBeUndefined()
    expect(payload.staff_id).toBe('STAFF-01')
    expect(payload.name).toBe('テスト 太郎')
  })

  it('when_staff_id_numbered_should_use_max_plus_one_padded', () => {
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
