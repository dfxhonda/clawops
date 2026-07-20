// SPEC-PATROL-ROUTE-BUILDER-01 (D-106): 巡回ルートの純ロジック (距離注釈+並べ替え。テスト可)。
import { haversineKm } from '../../utils/geo'

// 各店に現地(origin)からの直線距離 distanceKm と選択可否 hasCoords を注釈。
// lat/lng null 店は hasCoords=false (座標未登録=選択不可)。origin null なら distanceKm=null (取得前)。
export function annotateStores(stores, origin) {
  return (stores ?? []).map(s => {
    const hasCoords = s.lat != null && s.lng != null
    const distanceKm = (hasCoords && origin && origin.lat != null && origin.lng != null)
      ? haversineKm(origin, { lat: s.lat, lng: s.lng })
      : null
    return { ...s, hasCoords, distanceKm }
  })
}

// 近い順ソート。座標なし店は末尾、origin未取得(distanceKm null)は名前順。
export function sortByDistance(list) {
  return [...(list ?? [])].sort((a, b) => {
    if (!a.hasCoords && !b.hasCoords) return byName(a, b)
    if (!a.hasCoords) return 1
    if (!b.hasCoords) return -1
    if (a.distanceKm == null && b.distanceKm == null) return byName(a, b)
    if (a.distanceKm == null) return 1
    if (b.distanceKm == null) return -1
    return a.distanceKm - b.distanceKm
  })
}

function byName(a, b) {
  return (a.store_name ?? '').localeCompare(b.store_name ?? '', 'ja')
}

// AIおすすめ順: 予定リストを現地からの距離昇順で並べ替え (ドラッグで上書き可能)。
export function recommendOrder(route, origin) {
  return sortByDistance(annotateStores(route, origin))
}
