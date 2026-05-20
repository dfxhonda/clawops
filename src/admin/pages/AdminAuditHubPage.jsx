import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: '過去メーター編集',   desc: 'メーター記録の修正・削除',     path: '/admin/audit/booth-edit',    impl: true  },
  { label: '発注履歴',           desc: '景品発注の一覧・詳細閲覧',     path: '/admin/audit/orders',        impl: true  },
  { label: '全操作ログ',         desc: '全スタッフの操作履歴',         path: '/admin/audit/operations',    impl: true  },
  { label: 'ログイン履歴',       desc: 'ログイン・ログアウト記録',     path: '/admin/audit/logins',        impl: true  },
  { label: '景品phase履歴',      desc: '景品フェーズ変更の記録',       path: '/admin/audit/prize-phases',  impl: true  },
  { label: 'ロッカー操作履歴',   desc: 'ロッカー開閉・変更記録',       path: '/admin/audit/locker-ops',    impl: false },
  { label: '在庫移動履歴',       desc: '景品在庫の移動・調整記録',     path: '/admin/audit/stock-moves',   impl: true  },
  { label: 'Excel一括取込',     desc: '過去ラウンドデータを一括登録', path: '/admin/audit/bulk-import',   impl: true  },
]

export default function AdminAuditHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-audit-hub" className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="relative rounded-xl p-4 min-h-[100px] w-full text-center bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border border-border transition-colors cursor-pointer"
          >
            <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              t.impl ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {t.impl ? '実装済' : '未実装'}
            </span>
            <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
            <p className="text-xs text-muted mt-1 line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
