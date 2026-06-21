// DIAG-COLLECTION-PDF-RECEIPT-MISSING-01 I3
// Reproduces the getCollectionDetail transform for TST01-20260619-01 data
// and asserts receipt_photo_url survives the ...b spread into boothRows.
// This is a LOGIC test — no Supabase mock needed, just the transform itself.

import { describe, it, expect } from 'vitest'

// Mirrors the transform inside getCollectionDetail (src/services/collections.js ~L267-319)
// SQL SELECT * from cash_collection_booths returns raw booth rows; transform spreads ...b
// then overlays machine_name, booth_name, rental_code.
function applyGetCollectionDetailTransform(booths, machineMap, boothNameMap) {
  return (booths ?? []).map(b => {
    const m = machineMap[b.machine_code] || {}
    return {
      ...b,
      machine_name: m.machine_name || b.machine_code,
      booth_name: boothNameMap[b.booth_code] || b.booth_code,
      rental_code: m.machine_number || (b.machine_code?.split('-').pop() ?? b.machine_code),
    }
  })
}

// Realistic raw DB rows for TST01-20260619-01 (verified via live SQL 2026-06-21)
// 10 booths, 4 with receipt_photo_url (M01-B01, M02-B01, M02-B04, M04-B01)
const ORG = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'
const COL = 'TST01-20260619-01'
const BASE_URL = `https://gedxzunoyzmvbqgwjalx.supabase.co/storage/v1/object/public/receipts/${ORG}/${COL}`

const rawBooths = [
  { booth_code: 'TST01-M01-B01', machine_code: 'TST01-M01', total: 1000, advance_payment: 0,
    in_meter_current: 500, in_meter_prev: 400, receipt_photo_url: `${BASE_URL}/TST01-M01-B01.jpg`, receipt_photo_path: `${ORG}/${COL}/TST01-M01-B01.jpg` },
  { booth_code: 'TST01-M01-B02', machine_code: 'TST01-M01', total: 800, advance_payment: 0,
    in_meter_current: 450, in_meter_prev: 380, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M01-B03', machine_code: 'TST01-M01', total: 900, advance_payment: 0,
    in_meter_current: 460, in_meter_prev: 390, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M01-B04', machine_code: 'TST01-M01', total: 700, advance_payment: 0,
    in_meter_current: 420, in_meter_prev: 360, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M02-B01', machine_code: 'TST01-M02', total: 1200, advance_payment: 0,
    in_meter_current: 600, in_meter_prev: 500, receipt_photo_url: `${BASE_URL}/TST01-M02-B01.jpg`, receipt_photo_path: `${ORG}/${COL}/TST01-M02-B01.jpg` },
  { booth_code: 'TST01-M02-B02', machine_code: 'TST01-M02', total: 950, advance_payment: 0,
    in_meter_current: 520, in_meter_prev: 440, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M02-B03', machine_code: 'TST01-M02', total: 850, advance_payment: 0,
    in_meter_current: 480, in_meter_prev: 410, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M02-B04', machine_code: 'TST01-M02', total: 1100, advance_payment: 0,
    in_meter_current: 560, in_meter_prev: 470, receipt_photo_url: `${BASE_URL}/TST01-M02-B04.jpg`, receipt_photo_path: `${ORG}/${COL}/TST01-M02-B04.jpg` },
  { booth_code: 'TST01-M03-B01', machine_code: 'TST01-M03', total: 600, advance_payment: 0,
    in_meter_current: 350, in_meter_prev: 300, receipt_photo_url: null, receipt_photo_path: null },
  { booth_code: 'TST01-M04-B01', machine_code: 'TST01-M04', total: 750, advance_payment: 0,
    in_meter_current: 400, in_meter_prev: 340, receipt_photo_url: `${BASE_URL}/TST01-M04-B01.jpg`, receipt_photo_path: `${ORG}/${COL}/TST01-M04-B01.jpg` },
]

const machineMap = {
  'TST01-M01': { machine_name: 'クレーンA', machine_number: 'R2001' },
  'TST01-M02': { machine_name: 'クレーンB', machine_number: 'R2002' },
  'TST01-M03': { machine_name: 'クレーンC', machine_number: 'R2003' },
  'TST01-M04': { machine_name: 'クレーンD', machine_number: 'R2004' },
}
const boothNameMap = {}

describe('DIAG-COLLECTION-PDF-RECEIPT-MISSING-01 I3: getCollectionDetail transform', () => {
  it('when_transform_applied_to_TST01-20260619-01_should_preserve_4_receipt_photo_urls', () => {
    const boothRows = applyGetCollectionDetailTransform(rawBooths, machineMap, boothNameMap)

    // All 10 booths survive the transform
    expect(boothRows).toHaveLength(10)

    // Exactly 4 booths have receipt_photo_url (M01-B01, M02-B01, M02-B04, M04-B01)
    const withPhoto = boothRows.filter(b => b.receipt_photo_url)
    expect(withPhoto).toHaveLength(4)

    // The 4 URLs are intact (not null, not undefined, correct public URL format)
    const codes = withPhoto.map(b => b.booth_code)
    expect(codes).toContain('TST01-M01-B01')
    expect(codes).toContain('TST01-M02-B01')
    expect(codes).toContain('TST01-M02-B04')
    expect(codes).toContain('TST01-M04-B01')

    // URL format is the Supabase public URL (no signed URL expiry)
    withPhoto.forEach(b => {
      expect(b.receipt_photo_url).toMatch(/^https:\/\/gedxzunoyzmvbqgwjalx\.supabase\.co\/storage\/v1\/object\/public\/receipts\//)
    })
  })

  it('when_transform_applied_should_not_modify_receipt_photo_url_value', () => {
    // ...b spread must not alter the URL — guard against accidental key rename
    const boothRows = applyGetCollectionDetailTransform(rawBooths, machineMap, boothNameMap)
    const m01b01 = boothRows.find(b => b.booth_code === 'TST01-M01-B01')
    expect(m01b01.receipt_photo_url).toBe(`${BASE_URL}/TST01-M01-B01.jpg`)
  })

  it('when_photoBooths_filter_applied_should_return_4_entries_matching_collectionPdf_expectation', () => {
    // Mirrors: const photoBooths = boothsArr.filter(b => b.receipt_photo_url)
    const boothRows = applyGetCollectionDetailTransform(rawBooths, machineMap, boothNameMap)
    const photoBooths = boothRows.filter(b => b.receipt_photo_url)
    expect(photoBooths).toHaveLength(4)
  })
})
