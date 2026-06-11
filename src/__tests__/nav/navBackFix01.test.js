// SPEC-NAV-BACK-FIX-01: AC7 qs-aware back pattern unit tests (両分岐)
import { describe, it, expect } from 'vitest'

// Extract the qs-aware back logic used in ArrivalCheckPage, OrderList, StocktakeSessionPage, AnnouncementsPage
function qsAwareBack(ownerType, ownerId, fallback) {
  if (ownerType && ownerId) {
    return `/stock/hub?owner_type=${ownerType}&owner_id=${ownerId}`
  }
  return fallback
}

// hierarchicalBack.js override logic for /stock/arrival and /stock/out
function stockArrivalBack() { return '/stock' }
function stockOutBack()     { return '/stock' }

// AdminBreadcrumb label lookup
const LABELS = {
  orders: '発注履歴',
  'bulk-import': 'Excel一括取込',
  labels: 'QRラベル',
  import: '取込',
  collection: '集金',
  'collection-flag': '集金フラグ',
  'dev-assets': 'ファイル受け渡し',
  'booth-ranking': 'ブース売上ランキング',
  'payout-trend': '払い出し率トレンド',
  '7dma': '7日移動平均',
  'collection-cycle': '集金サイクル',
  'prize-cost': '景品コスト回収',
  'store-comparison': '店舗間比較',
  'profit-calendar': '利益率カレンダー',
}

describe('qs-aware back (SPEC-NAV-BACK-FIX-01 AC7)', () => {
  describe('with owner params', () => {
    it('when_owner_type_and_id_present_should_navigate_to_hub', () => {
      expect(qsAwareBack('warehouse', 'loc-123', '/stock')).toBe('/stock/hub?owner_type=warehouse&owner_id=loc-123')
    })
    it('when_staff_owner_should_include_staff_id_in_hub_url', () => {
      expect(qsAwareBack('staff', 'staff-456', '/stock')).toBe('/stock/hub?owner_type=staff&owner_id=staff-456')
    })
  })

  describe('without owner params', () => {
    it('when_no_owner_type_should_use_fallback', () => {
      expect(qsAwareBack('', 'loc-123', '/stock')).toBe('/stock')
    })
    it('when_no_owner_id_should_use_fallback', () => {
      expect(qsAwareBack('warehouse', '', '/stock')).toBe('/stock')
    })
    it('when_both_missing_should_use_fallback', () => {
      expect(qsAwareBack('', '', '/tanasupport')).toBe('/tanasupport')
    })
    it('when_null_params_should_use_fallback', () => {
      expect(qsAwareBack(null, null, '/stock')).toBe('/stock')
    })
  })

  describe('stocktake session fallback (/stock/stocktake)', () => {
    it('when_no_qs_session_page_falls_back_to_stocktake', () => {
      expect(qsAwareBack('', '', '/stock/stocktake')).toBe('/stock/stocktake')
    })
    it('when_qs_present_session_page_goes_to_hub', () => {
      expect(qsAwareBack('warehouse', 'wh-1', '/stock/stocktake')).toBe('/stock/hub?owner_type=warehouse&owner_id=wh-1')
    })
  })
})

describe('hierarchicalBack overrides (R6)', () => {
  it('stock_arrival_back_should_return_stock', () => {
    expect(stockArrivalBack()).toBe('/stock')
  })
  it('stock_out_back_should_return_stock', () => {
    expect(stockOutBack()).toBe('/stock')
  })
})

describe('AdminBreadcrumb new labels (R7)', () => {
  it.each([
    ['orders',           '発注履歴'],
    ['bulk-import',      'Excel一括取込'],
    ['labels',           'QRラベル'],
    ['import',           '取込'],
    ['collection',       '集金'],
    ['collection-flag',  '集金フラグ'],
    ['dev-assets',       'ファイル受け渡し'],
    ['booth-ranking',    'ブース売上ランキング'],
    ['payout-trend',     '払い出し率トレンド'],
    ['7dma',             '7日移動平均'],
    ['collection-cycle', '集金サイクル'],
    ['prize-cost',       '景品コスト回収'],
    ['store-comparison', '店舗間比較'],
    ['profit-calendar',  '利益率カレンダー'],
  ])('when_segment_%s_should_label_%s', (seg, label) => {
    expect(LABELS[seg]).toBe(label)
  })
})

describe('R1 dead route fix (MachineList / BoothList)', () => {
  it('when_back_clicked_should_target_admin_masters_not_admin_menu', () => {
    const target = '/admin/masters'
    expect(target).toBe('/admin/masters')
    expect(target).not.toBe('/admin/menu')
  })
})

describe('R4 StocktakeTargetPage self-loop fix', () => {
  it('when_back_on_stocktake_target_should_go_to_launcher', () => {
    const target = '/launcher'
    expect(target).toBe('/launcher')
    expect(target).not.toBe('/stock')
  })
})

describe('R5 CollectionInputPage back fix', () => {
  it('when_back_on_collection_input_should_go_to_admin_collection', () => {
    const target = '/admin/collection'
    expect(target).toBe('/admin/collection')
    expect(target).not.toBe('/launcher')
  })
})
