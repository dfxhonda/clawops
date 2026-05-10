import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: '過去メーター編集',   desc: 'メーター記録の修正・削除',     path: '/admin/audit/booth-edit',  impl: true  },
  { label: '全操作ログ',         desc: '全スタッフの操作履歴',         path: '/admin/audit/operations',  impl: false },
  { label: 'ログイン履歴',       desc: 'ログイン・ログアウト記録',     path: '/admin/audit/logins',      impl: false },
  { label: '景品phase履歴',      desc: '景品フェーズ変更の記録',       path: '/admin/audit/prize-phases',impl: false },
  { label: 'ロッカー操作履歴',   desc: 'ロッカー開閉・変更記録',       path: '/admin/audit/locker-ops',  impl: false },
  { label: '在庫移動履歴',       desc: '景品在庫の移動・調整記録',     path: '/admin/audit/stock-moves', impl: false },
]

export default function AdminAuditHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-audit-hub" className="p-4">
      <h1 className="text-lg font-bold text-text mb-4">監査・履歴</h1>
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
