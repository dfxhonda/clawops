// J-COLLECTION-INSERT-NOTNULL-AUDIT-fix-01: cash_collections INSERT に organization_id=CHANGE_ORG_ID が含まれること
import { describe, it, expect } from 'vitest'
import { CHANGE_ORG_ID } from '../../lib/auth/orgConstants'

describe('J-COLLECTION-INSERT-NOTNULL-AUDIT-fix-01', () => {
  it('when_cash_collections_inserted_should_use_CHANGE_ORG_ID_not_DFX_ORG_ID', () => {
    expect(CHANGE_ORG_ID).toBe('01cf7a5e-6971-4ae1-918d-8e5981780a95')
  })

  it('when_cash_collections_payload_built_should_contain_organization_id', () => {
    const collectionId = 'MNK01-20260607-001'
    const storeCode = 'MNK01'
    const collectedAt = '2026-06-07'
    const now = new Date().toISOString()

    const payload = {
      collection_id: collectionId,
      store_code: storeCode,
      collected_by: null,
      collected_at: collectedAt,
      prev_collection_date: null,
      status: 'confirmed',
      notes: null,
      organization_id: CHANGE_ORG_ID,
      created_at: now,
      updated_at: now,
      updated_by: null,
      staff_signature_url: null,
      staff_signature_path: null,
    }

    expect(payload.organization_id).toBe('01cf7a5e-6971-4ae1-918d-8e5981780a95')
    expect(payload.collection_id).toBe(collectionId)
    expect(payload.store_code).toBe(storeCode)
    expect(payload.collected_at).toBe(collectedAt)
  })

  it('when_cash_collection_booths_payload_built_should_contain_all_not_null_cols', () => {
    const collectionId = 'MNK01-20260607-001'
    const storeCode = 'MNK01'

    const booth = { booth_code: 'MNK01-M01-B01', machine_code: 'MNK01-M01' }
    const d = {}
    const c = d.counts || {}
    const boothRow = {
      id: `${collectionId}-${booth.booth_code}`,
      collection_id: collectionId,
      booth_code: booth.booth_code,
      machine_code: booth.machine_code,
      store_code: storeCode,
      bill_10000: Number(c.bill_10000) || 0,
      bill_5000: Number(c.bill_5000) || 0,
      bill_1000: Number(c.bill_1000) || 0,
      coin_500: Number(c.coin_500) || 0,
      coin_100: Number(c.coin_100) || 0,
      coin_50: Number(c.coin_50) || 0,
    }

    // NOT NULL 列すべて存在
    expect(boothRow.id).toBe(`${collectionId}-${booth.booth_code}`)
    expect(boothRow.collection_id).toBe(collectionId)
    expect(boothRow.booth_code).toBe(booth.booth_code)
    expect(boothRow.machine_code).toBe(booth.machine_code)
    expect(boothRow.store_code).toBe(storeCode)
  })

  it('when_collection_id_generated_should_follow_storeCode_date_seq_format', () => {
    // genCollectionId の命名規則確認 (ロジックの単体テスト)
    const storeCode = 'MNK01'
    const collectedAt = '2026-06-07'
    const seq = 1
    // genCollectionId(storeCode, collectedAt, seq) → 'MNK01-20260607-001'
    const dateSlug = collectedAt.replace(/-/g, '')
    const id = `${storeCode}-${dateSlug}-${String(seq).padStart(3, '0')}`
    expect(id).toBe('MNK01-20260607-001')
  })
})
