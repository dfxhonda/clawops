import { test, expect } from '@playwright/test'
import { PrizeMasterRowSchema } from '../src/services/schemas/prizeMasters.js'
import { MeterReadingRowSchema } from '../src/services/schemas/meterReadings.js'

// J-INFRA-04: Zod スキーマ検証 (prize_masters / meter_readings)

const VALID_PRIZE_ROW = {
  prize_id:              'PM-001',
  prize_name:            'テスト景品',
  prize_name_kana:       null,
  aliases:               null,
  short_name:            null,
  jan_code:              null,
  original_cost:         null,
  category:              null,
  size:                  null,
  supplier_id:           null,
  supplier_name:         null,
  default_case_quantity: null,
  status:                'active',
  notes:                 null,
  image_url:             null,
  organization_id:       '14e907a7-65a3-4891-9a3c-20ea0a7c14fd',
  created_at:            null,
  updated_at:            null,
}

const VALID_READING_ROW = {
  reading_id:         'RD-001',
  booth_id:           null,
  booth_code:         'TST-B01',
  full_booth_code:    'TST-B01',
  store_code:         'TST01',
  machine_code:       'TST01-M001',
  patrol_date:        '2026-05-07',
  read_time:          '2026-05-07T10:00:00+09:00',
  in_meter:           50000,
  out_meter:          45000,
  out_meter_2:        null,
  out_meter_3:        null,
  in_diff:            null,
  out_diff_1:         null,
  out_diff_2:         null,
  out_diff_3:         null,
  prize_id:           null,
  prize_name:         null,
  prize_name_2:       null,
  prize_name_3:       null,
  prize_cost:         null,
  prize_cost_1:       null,
  prize_cost_2:       null,
  prize_cost_3:       null,
  prize_stock_count:  20,
  prize_restock_count: 0,
  stock_2:            null,
  stock_3:            null,
  restock_2:          null,
  restock_3:          null,
  theoretical_stock:  null,
  payout_rate:        null,
  set_a:              null,
  set_c:              null,
  set_l:              null,
  set_r:              null,
  set_o:              null,
  entry_type:         'patrol',
  revenue:            null,
  play_price:         null,
  note:               null,
  source:             'manual',
  input_method:       'manual',
  staff_id:           null,
  ocr_confidence:     null,
  ocr_raw_text:       null,
  ocr_attempted_at:   null,
  photo_url:          null,
  cropped_photo_url:  null,
  organization_id:    '14e907a7-65a3-4891-9a3c-20ea0a7c14fd',
  created_at:         '2026-05-07T10:00:00Z',
  created_by:         null,
  updated_at:         null,
  updated_by:         null,
}

test.describe('J-INFRA-04: Zod スキーマ検証', () => {
  test('正常な prize_masters 行が parse できる', () => {
    const result = PrizeMasterRowSchema.parse(VALID_PRIZE_ROW)
    expect(result.prize_id).toBe('PM-001')
    expect(result.status).toBe('active')
    expect(result.organization_id).toBe('14e907a7-65a3-4891-9a3c-20ea0a7c14fd')
  })

  test('必須列 (organization_id) 欠損で ZodError が throw される', () => {
    const { organization_id: _, ...noOrgId } = VALID_PRIZE_ROW
    expect(() => PrizeMasterRowSchema.parse(noOrgId)).toThrow()
  })

  test('nullable 列は null を許容する', () => {
    const result = PrizeMasterRowSchema.parse({ ...VALID_PRIZE_ROW, original_cost: null, prize_name_kana: null })
    expect(result.original_cost).toBeNull()
    expect(result.prize_name_kana).toBeNull()

    const reading = MeterReadingRowSchema.parse(VALID_READING_ROW)
    expect(reading.out_meter_2).toBeNull()
    expect(reading.prize_name).toBeNull()
  })

  test('array 全件 parse — prize_masters 複数行を一括検証できる', () => {
    const rows = [
      VALID_PRIZE_ROW,
      { ...VALID_PRIZE_ROW, prize_id: 'PM-002', prize_name: 'テスト景品2', status: 'inactive' },
      { ...VALID_PRIZE_ROW, prize_id: 'PM-003', prize_name: 'テスト景品3', original_cost: 1500 },
    ]
    const result = PrizeMasterRowSchema.array().parse(rows)
    expect(result).toHaveLength(3)
    expect(result[1].status).toBe('inactive')
    expect(result[2].original_cost).toBe(1500)
  })
})
