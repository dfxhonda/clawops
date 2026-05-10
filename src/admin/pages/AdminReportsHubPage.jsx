import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: '日次ブース', desc: 'ブース単位の日次集計',   path: '/admin/reports/daily-booths',   impl: false },
  { label: '時別ブース', desc: 'ブース単位の時別集計',   path: '/admin/reports/hourly-booths',  impl: false },
  { label: '日次機械',   desc: '機械単位の日次集計',     path: '/admin/reports/daily-machines', impl: false },
  { label: '集金抽出',   desc: '集金データのCSV出力',    path: '/admin/reports/collections',    impl: false },
  { label: '課金',       desc: '課金レポート一覧',       path: '/admin/reports/billing',        impl: false },
]

export default function AdminReportsHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-reports-hub" className="p-4">
      <h1 className="text-lg font-bold text-text mb-4">レポート</h1>
      <div className="grid grid-cols-2 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="p-4 rounded-xl bg-surface border border-border text-left hover:bg-surface/80 transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-sm font-semibold text-text">{t.label}</span>
              <span className="text-xs px-1.5 py-0.5 rounded border border-border text-gray-400">未実装</span>
            </div>
            <p className="text-xs text-muted">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
