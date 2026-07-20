// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): geo util + 巡回ルート純ロジック。
import { describe, it, expect } from 'vitest'
import { haversineKm, buildMapsDirUrl } from '../../utils/geo'
import { annotateStores, sortByDistance, recommendOrder } from '../../clawsupport/lib/patrolRouteLogic'

describe('AC6: haversineKm 既知座標間の距離が妥当', () => {
  it('東京↔大阪 ≈ 400km (±15km)', () => {
    const d = haversineKm({ lat: 35.6895, lng: 139.6917 }, { lat: 34.6937, lng: 135.5023 })
    expect(d).toBeGreaterThan(385)
    expect(d).toBeLessThan(415)
  })
  it('同一地点=0', () => {
    expect(haversineKm({ lat: 33.5, lng: 130.4 }, { lat: 33.5, lng: 130.4 })).toBeCloseTo(0, 5)
  })
  it('座標欠落→null', () => {
    expect(haversineKm({ lat: null, lng: 130 }, { lat: 33, lng: 130 })).toBeNull()
    expect(haversineKm(null, { lat: 33, lng: 130 })).toBeNull()
  })
})

describe('AC5: buildMapsDirUrl (origin/destination/waypoints/travelmode=driving)', () => {
  const origin = { lat: 33.5, lng: 130.4 }
  const A = { lat: 33.6, lng: 130.5 }, B = { lat: 33.7, lng: 130.6 }, C = { lat: 33.8, lng: 130.7 }

  it('予定3店 → waypoints1店(A) destination(C)、途中Bも waypoints', () => {
    const url = buildMapsDirUrl(origin, [A, B, C])
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=33.5,130.4&destination=33.8,130.7&waypoints=33.6,130.5|33.7,130.6&travelmode=driving'
    )
  })
  it('予定2店 → destination=最終, waypoints=1店', () => {
    const url = buildMapsDirUrl(origin, [A, C])
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=33.5,130.4&destination=33.8,130.7&waypoints=33.6,130.5&travelmode=driving'
    )
  })
  it('予定1店 → waypoints無し, destination のみ', () => {
    expect(buildMapsDirUrl(origin, [A])).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=33.5,130.4&destination=33.6,130.5&travelmode=driving'
    )
  })
  it('origin null → origin 省略 (Googleが現地を使う)', () => {
    expect(buildMapsDirUrl(null, [A, C])).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=33.8,130.7&waypoints=33.6,130.5&travelmode=driving'
    )
  })
  it('空/座標なし → null', () => {
    expect(buildMapsDirUrl(origin, [])).toBeNull()
    expect(buildMapsDirUrl(origin, [{ lat: null, lng: null }])).toBeNull()
  })
})

describe('AC2: annotateStores / sortByDistance (近い順、座標なし末尾)', () => {
  const origin = { lat: 33.5, lng: 130.4 }
  const stores = [
    { store_code: 'FAR', store_name: '遠い', lat: 34.5, lng: 131.4 },
    { store_code: 'NEAR', store_name: '近い', lat: 33.51, lng: 130.41 },
    { store_code: 'NOGEO', store_name: '座標なし', lat: null, lng: null },
  ]
  it('annotate で distanceKm と hasCoords 付与', () => {
    const a = annotateStores(stores, origin)
    expect(a.find(s => s.store_code === 'NEAR').distanceKm).toBeLessThan(a.find(s => s.store_code === 'FAR').distanceKm)
    expect(a.find(s => s.store_code === 'NOGEO').hasCoords).toBe(false)
    expect(a.find(s => s.store_code === 'NOGEO').distanceKm).toBeNull()
  })
  it('sortByDistance: 近い→遠い→座標なし(末尾)', () => {
    const sorted = sortByDistance(annotateStores(stores, origin))
    expect(sorted.map(s => s.store_code)).toEqual(['NEAR', 'FAR', 'NOGEO'])
  })
  it('origin未取得(null)は名前順、座標なしは末尾', () => {
    const sorted = sortByDistance(annotateStores(stores, null))
    expect(sorted[sorted.length - 1].store_code).toBe('NOGEO')
  })
  it('recommendOrder=予定を距離昇順に', () => {
    const r = recommendOrder([stores[0], stores[1]], origin)
    expect(r.map(s => s.store_code)).toEqual(['NEAR', 'FAR'])
  })
})
