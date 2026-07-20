// SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店舗情報Web検索 (Edge store-info-search + AdminStoreListPage.jsx)。
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ then: () => {} }) }), functions: { invoke: () => {} } } }))

const { mergeStoreCandidate } = await import('../../admin/pages/AdminStoreListPage')

const baseForm = {
  store_code: 'KKY01', store_name: '本店', store_name_official: '', brand_name: '旧ブランド',
  address: '', phone: '', region: '', locality: '', locality_kana: '', lat: '', lng: '',
}

describe('AC4: mergeStoreCandidate は store_code/store_name を上書きしない', () => {
  it('候補に store_code/store_name があっても form の値を維持', () => {
    const out = mergeStoreCandidate(baseForm, { store_code: 'HACK', store_name: '偽名', address: '福岡市' })
    expect(out.store_code).toBe('KKY01')
    expect(out.store_name).toBe('本店')
    expect(out.address).toBe('福岡市')
  })
})

describe('AC2: null合体マージ (候補nullは現状温存、値は反映)', () => {
  it('候補.x=null → form現状維持 / 候補.x=値 → 反映', () => {
    const out = mergeStoreCandidate(baseForm, {
      store_name_official: '株式会社DFX本店', brand_name: null, address: '福岡県福岡市中央区', phone: '092-000-0000',
      region: '九州', locality: '福岡市', locality_kana: 'フクオカシ', lat: 33.59, lng: 130.4,
    })
    expect(out.store_name_official).toBe('株式会社DFX本店')
    expect(out.brand_name).toBe('旧ブランド')     // 候補null→温存
    expect(out.address).toBe('福岡県福岡市中央区')
    expect(out.region).toBe('九州')
    expect(out.lat).toBe('33.59')                  // 数値→文字列 (form入力欄用)
    expect(out.lng).toBe('130.4')
  })
  it('候補 undefined → form そのまま', () => {
    expect(mergeStoreCandidate(baseForm, null)).toBe(baseForm)
  })
  it('候補.x=空文字 → 温存 (空で潰さない)', () => {
    const out = mergeStoreCandidate({ ...baseForm, region: '九州' }, { region: '' })
    expect(out.region).toBe('九州')
  })
})

describe('AC1: Edge store-info-search (dfx_api_key + web_search + store JSON + 座標妥当性)', () => {
  const edge = readFileSync(resolve(__dirname, '../../../supabase/functions/store-info-search/index.ts'), 'utf-8')
  it('dfx_api_key 再利用 + web_search ツール + api.anthropic.com', () => {
    expect(edge).toContain("Deno.env.get('dfx_api_key')")
    expect(edge).toContain('web_search_20250305')
    expect(edge).toContain('api.anthropic.com/v1/messages')
  })
  it('入力 storeName/address + 出力 { store }', () => {
    expect(edge).toContain('const { storeName, address }')
    expect(edge).toContain('JSON.stringify({ store })')
  })
  it('日本国内座標の範囲チェック (lat 24-46 / lng 123-146, 範囲外はnull)', () => {
    expect(edge).toMatch(/lat >= 24 && lat <= 46/)
    expect(edge).toMatch(/lng >= 123 && lng <= 146/)
  })
  it('model-spec-search Edge は改変しない (別Edge=別ファイル)', () => {
    const model = readFileSync(resolve(__dirname, '../../../supabase/functions/model-spec-search/index.ts'), 'utf-8')
    expect(model).toContain('const { modelName }') // 元のまま
    expect(model).not.toContain('storeName')
  })
})

describe('AC2/AC3: AdminStoreListPage 配線 (検索ボタン/候補/lat lng)', () => {
  const src = readFileSync(resolve(__dirname, '../../admin/pages/AdminStoreListPage.jsx'), 'utf-8')
  it('検索ボタン + store-info-search invoke + 候補パネル + 反映', () => {
    expect(src).toContain('store-info-search-button')
    expect(src).toContain("invoke('store-info-search'")
    expect(src).toContain('storeCandidate')
    expect(src).toContain('applyStoreCandidate')
  })
  it('AC3: lat/lng が EMPTY_FORM / openEdit / handleSave payload / LIST_SELECT に存在', () => {
    expect(src).toMatch(/lat: '', lng: ''/)                 // EMPTY_FORM
    expect(src).toContain("data.lat ?? ''")                 // openEdit prefill
    expect(src).toMatch(/lat:\s*form\.lat[^\n]*Number\(form\.lat\)/) // handleSave 数値化
    expect(src).toMatch(/LIST_SELECT =[^\n]*lat,lng/)       // openEdit 取得
  })
  it('gps_verified_at は反映保存時のみ打刻', () => {
    expect(src).toContain('gps_verified_at: now')
    expect(src).toContain('latLngVerified')
  })
})
