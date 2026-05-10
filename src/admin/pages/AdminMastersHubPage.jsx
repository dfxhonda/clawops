import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: '店舗',         desc: '店舗マスタ管理',           path: '/admin/masters/stores',            impl: true  },
  { label: '機械',         desc: '機械/機種マスタ管理',      path: '/admin/masters/machines',          impl: false },
  { label: '景品',         desc: '景品マスタ管理',           path: '/admin/masters/prizes',            impl: false },
  { label: 'ロッカー',     desc: 'ロッカーマスタ管理',       path: '/admin/masters/lockers',           impl: false },
  { label: 'スタッフ',     desc: 'スタッフマスタ管理',       path: '/admin/masters/staff',             impl: false },
  { label: '取引先',       desc: '取引先マスタ管理',         path: '/admin/masters/suppliers',         impl: false },
  { label: '区分',         desc: '入替区分マスタ管理',       path: '/admin/masters/categories',        impl: false },
  { label: '設定パターン', desc: '機械設定パターン管理',     path: '/admin/masters/settings-patterns', impl: false },
  { label: '用語マスタ',   desc: '用語・略語マスタ管理',     path: '/admin/masters/glossary',          impl: false },
  { label: 'マニュアル',   desc: '機械マニュアル管理',       path: '/admin/masters/manuals',           impl: false },
]

export default function AdminMastersHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-masters-hub" className="p-4">
      <h1 className="text-lg font-bold text-text mb-4">マスタ管理</h1>
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
              <span className={`text-xs px-1.5 py-0.5 rounded ${t.impl ? 'bg-emerald-400/20 text-emerald-400' : 'border border-border text-gray-400'}`}>
                {t.impl ? '実装済' : '未実装'}
              </span>
            </div>
            <p className="text-xs text-muted">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
