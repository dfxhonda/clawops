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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="relative rounded-xl p-4 min-h-[100px] w-full text-center bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border border-border transition-colors cursor-pointer"
          >
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-600 text-gray-300">
              未実装
            </span>
            <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
            <p className="text-xs text-muted mt-1 line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
