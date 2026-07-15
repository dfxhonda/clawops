// J-NAV-ORPHANS-fix-02 2026-05-30 ヒロ ad-hoc: マネサポ 集金タブを Hub 化。
// SPEC-ADMIN-REPORTS-BADGE-CLEANUP-02: 独自インラインのタイル markup を廃止し、
// 共通 AdminHubTilesGrid に統合 (実装済=バッジなし / 準備中のみ灰バッジのルールを共有)。
// testid は既存互換のため tileTestidPrefix で collection-hub-tile- を維持。
import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

const TILES = [
  { label: '集金帳票',     desc: '金種カウント・売上伝票PDF',      path: '/collection/input',          impl: true },
  { label: '集金フラグ編集', desc: '巡回 reading の集金済フラグ管理', path: '/admin/collection-flag',   impl: true },
  { label: '集金履歴',     desc: '過去の集金帳票一覧',             path: '/collection/history',        impl: true },
  // SPEC-CASH-RECONCILE-PAGE-01 (D-067): 金庫照合 (手持ち金種 vs 集金総計の差額照合)
  { label: '金庫照合',     desc: '手持ち金種と集金の差額照合',       path: '/collection/reconciliation', impl: true },
  // SPEC-COLLECTION-EXPORT-TAB-PLACE-01: 集金タブから集金抽出へ (route 共用)
  { label: '集金抽出',     desc: '集金データのxlsx出力',           path: '/admin/reports/collections', impl: true },
]

export default function AdminCollectionHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-collection-hub" tileTestidPrefix="collection-hub-tile-" />
}
