import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: 'Feature Flags',  desc: '機能フラグのON/OFF管理',  path: '/admin/settings/flags',         impl: false },
  { label: '入替提案ルール', desc: '入替判定ルールの設定',     path: '/admin/settings/replace-rules', impl: false },
  { label: 'SGP連携設定',    desc: 'SGPデータ取込の設定',      path: '/admin/settings/sgp',           impl: false },
  // J-DEV-ASSET-HANDOFF-01: 開発資産受け渡し (admin/manager) — RLS で staff/patrol ブロック
  { label: 'ファイル受け渡し', desc: '開発資産 (PNG/xlsx/pdf 等) を bytes 保持で受け渡し', path: '/admin/dev-assets', impl: true },
]

export default function AdminSettingsHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-settings-hub" className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="relative rounded-xl p-4 min-h-[100px] w-full text-center bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border border-border transition-colors cursor-pointer"
          >
            {!t.impl && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold bg-gray-600 text-gray-300">
                未実装
              </span>
            )}
            <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
            <p className="text-sm text-muted mt-1 line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
