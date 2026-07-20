// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 座標ユーティリティ (純関数・テスト可)。
// 直線距離(haversine)のみ。道なり実距離ではない(選択の目安と割り切る)。有料API不使用。

const EARTH_R_KM = 6371

const toRad = (deg) => (deg * Math.PI) / 180

// 2点 {lat,lng} 間の直線距離 km。座標欠落は null。
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Google Maps ナビ経由地URL (api=1, 無料・URL丸投げ)。
// origin=現地 {lat,lng}|null (nullなら省略=Googleが現地を使う)。
// stops=順序付き [{lat,lng}]: 最終店=destination、途中店=waypoints(パイプ区切り)。
// Google waypoints 上限内に収めるため最大 MAX_ROUTE_STOPS 店に丸める。
export const MAX_ROUTE_STOPS = 10

export function buildMapsDirUrl(origin, stops) {
  const valid = (stops ?? []).filter(s => s && s.lat != null && s.lng != null).slice(0, MAX_ROUTE_STOPS)
  if (valid.length === 0) return null
  const parts = ['https://www.google.com/maps/dir/?api=1']
  if (origin && origin.lat != null && origin.lng != null) {
    parts.push(`origin=${origin.lat},${origin.lng}`)
  }
  const destination = valid[valid.length - 1]
  parts.push(`destination=${destination.lat},${destination.lng}`)
  const waypoints = valid.slice(0, -1)
  if (waypoints.length > 0) {
    parts.push(`waypoints=${waypoints.map(s => `${s.lat},${s.lng}`).join('|')}`)
  }
  parts.push('travelmode=driving')
  return parts.join('&')
}
