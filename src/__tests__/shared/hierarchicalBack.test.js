// @vitest-environment happy-dom
// J-NAV-BACK-HIERARCHICAL-01: 戻るボタン階層化ユーティリティのテスト
import { describe, it, expect } from 'vitest'
import { getHierarchicalParent } from '../../shared/nav/hierarchicalBack'

describe('getHierarchicalParent', () => {
  describe('クレサポ系', () => {
    it('booth → /clawsupport (URL に store_code 無いためフォールバック)', () => {
      expect(getHierarchicalParent('/clawsupport/booth/MNK01-M01-B01')).toBe('/clawsupport')
    })
    it('store/dash → store', () => {
      expect(getHierarchicalParent('/clawsupport/store/MNK01/dash', { storeCode: 'MNK01' })).toBe('/clawsupport/store/MNK01')
    })
    it('store → /clawsupport', () => {
      expect(getHierarchicalParent('/clawsupport/store/MNK01')).toBe('/clawsupport')
    })
    it('alerts → /clawsupport', () => {
      expect(getHierarchicalParent('/clawsupport/alerts')).toBe('/clawsupport')
    })
    it('hub → /launcher', () => {
      expect(getHierarchicalParent('/clawsupport')).toBe('/launcher')
    })
  })

  describe('タナサポ系', () => {
    it('store → /tanasupport', () => {
      expect(getHierarchicalParent('/tanasupport/store/MNK01')).toBe('/tanasupport')
    })
    it('location/stocktake → /tanasupport', () => {
      expect(getHierarchicalParent('/tanasupport/location/abc/stocktake')).toBe('/tanasupport')
    })
    it('arrival → /tanasupport', () => {
      expect(getHierarchicalParent('/stock/arrival')).toBe('/tanasupport')
    })
    it('out → /tanasupport', () => {
      expect(getHierarchicalParent('/stock/out')).toBe('/tanasupport')
    })
    it('hub → /launcher', () => {
      expect(getHierarchicalParent('/tanasupport')).toBe('/launcher')
    })
  })

  describe('マネサポ (admin)', () => {
    it('masters/staff → masters', () => {
      expect(getHierarchicalParent('/admin/masters/staff')).toBe('/admin/masters')
    })
    it('masters → /admin', () => {
      expect(getHierarchicalParent('/admin/masters')).toBe('/admin')
    })
    it('audit/operations → audit', () => {
      expect(getHierarchicalParent('/admin/audit/operations')).toBe('/admin/audit')
    })
    it('import → /admin', () => {
      expect(getHierarchicalParent('/admin/import')).toBe('/admin')
    })
    it('admin hub → /launcher', () => {
      expect(getHierarchicalParent('/admin')).toBe('/launcher')
    })
    it('booth-edit dynamic → /admin/audit/booth-edit/:storeCode/machines (機械一覧、1段戻り)', () => {
      // J-ADMIN-BACK-NAV-fix-01 2026-05-31: ヒロ ad-hoc で 2段戻り bug 修正、
      // booth_code 先頭 split('-')[0] = store_code で機械一覧 URL 組立。
      expect(getHierarchicalParent('/admin/audit/booth-edit/STX01-M01-B01')).toBe('/admin/audit/booth-edit/STX01/machines')
    })
  })

  describe('集金', () => {
    it('history → input', () => {
      expect(getHierarchicalParent('/collection/history')).toBe('/collection/input')
    })
    it('input → /launcher', () => {
      expect(getHierarchicalParent('/collection/input')).toBe('/launcher')
    })
  })

  describe('top level / generic', () => {
    it('launcher → null (戻り先なし)', () => {
      expect(getHierarchicalParent('/launcher')).toBeNull()
    })
    it('login → null', () => {
      expect(getHierarchicalParent('/login')).toBeNull()
    })
    it('dashboard → /launcher', () => {
      expect(getHierarchicalParent('/dashboard')).toBe('/launcher')
    })
    it('generic 2 segments → strip last', () => {
      expect(getHierarchicalParent('/foo/bar')).toBe('/foo')
    })
    it('generic 1 segment → /launcher', () => {
      expect(getHierarchicalParent('/something-unknown')).toBe('/launcher')
    })
  })
})
