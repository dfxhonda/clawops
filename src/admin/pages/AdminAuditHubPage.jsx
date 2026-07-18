import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

// J-ADMIN-NAV-BADGE-01 2026-05-30: AdminHubTilesGrid に集約 (準備中バッジ + toast)。
const TILES = [
  { label: '過去メーター編集',   desc: 'メーター記録の修正・削除',     path: '/admin/audit/booth-edit',    impl: true  },
  { label: '過去集金編集',       desc: '集金の立替金・備考を修正',     path: '/admin/audit/collection-edit', impl: true  },
  { label: '発注履歴',           desc: '景品発注の一覧・詳細閲覧',     path: '/admin/audit/orders',        impl: true  },
  { label: '全操作ログ',         desc: '全スタッフの操作履歴',         path: '/admin/audit/operations',    impl: true  },
  { label: 'ログイン履歴',       desc: 'ログイン・ログアウト記録',     path: '/admin/audit/logins',        impl: true  },
  { label: '景品phase履歴',      desc: '景品フェーズ変更の記録',       path: '/admin/audit/prize-phases',  impl: true  },
  { label: 'ロッカー操作履歴',   desc: 'ロッカー開閉・変更記録',       path: '/admin/audit/locker-ops',    impl: false },
  { label: '在庫移動履歴',       desc: '景品在庫の移動・調整記録',     path: '/admin/audit/stock-moves',   impl: true  },
  { label: 'Excel一括取込',     desc: '過去ラウンドデータを一括登録', path: '/admin/audit/bulk-import',   impl: true  },
]

export default function AdminAuditHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-audit-hub" />
}
