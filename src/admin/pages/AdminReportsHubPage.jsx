import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

// J-ADMIN-NAV-BADGE-01 2026-05-30: AdminHubTilesGrid に集約 (準備中バッジ + toast)。
const TILES = [
  { label: '日次ブース', desc: 'ブース単位の日次集計',   path: '/admin/reports/daily-booths',   impl: false },
  { label: '時別ブース', desc: 'ブース単位の時別集計',   path: '/admin/reports/hourly-booths',  impl: false },
  { label: '日次機械',   desc: '機械単位の日次集計',     path: '/admin/reports/daily-machines', impl: false },
  { label: '集金抽出',   desc: '集金データのCSV出力',    path: '/admin/reports/collections',    impl: false },
  { label: '課金',       desc: '課金レポート一覧',       path: '/admin/reports/billing',        impl: false },
]

export default function AdminReportsHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-reports-hub" />
}
