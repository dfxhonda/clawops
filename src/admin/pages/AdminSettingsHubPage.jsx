import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: 'Feature Flags',  desc: '機能フラグのON/OFF管理',   path: '/admin/settings/flags',        impl: false },
  { label: '入替提案ルール', desc: '入替判定ルールの設定',      path: '/admin/settings/replace-rules', impl: false },
  { label: 'SGP連携設定',    desc: 'SGPデータ取込の設定',       path: '/admin/settings/sgp',           impl: false },
]

export default function AdminSettingsHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-settings-hub" className="p-4">
      <h1 className="text-lg font-bold text-text mb-4">設定</h1>
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
