import { useNavigate } from 'react-router-dom'

// J-NAV-ORPHANS-fix-01 2026-05-30 ヒロ ad-hoc: 機械登録 (実機) / ブース一覧 の動線が UI に無い問題を解消。
// 既存の「機械」(/admin/masters/machines = 機種マスタ) のラベルを「機種」に明確化。
const TILES = [
  { label: '取込',         desc: 'PCH Excel取込 / SGP状態',  path: '/admin/import',                    impl: true  },
  { label: '店舗',         desc: '店舗マスタ管理 (機械/ブース追加もここから)', path: '/admin/masters/store-list', impl: true  },
  { label: '機械登録',     desc: '店舗の実機を追加・編集',  path: '/admin/machines',                  impl: true  },
  { label: 'ブース一覧',   desc: 'ブース設定の確認・編集・追加', path: '/admin/booths',                impl: true  },
  { label: '機種',         desc: '機種マスタ (型番) 管理',  path: '/admin/masters/machines',          impl: true  },
  { label: '景品',         desc: '景品マスタ管理',         path: '/admin/masters/prizes',            impl: true  },
  { label: 'ロッカー',     desc: 'ロッカーマスタ管理',     path: '/admin/masters/lockers',           impl: false },
  { label: 'スタッフ',     desc: 'スタッフマスタ管理',     path: '/admin/masters/staff',             impl: true  },
  { label: '取引先',       desc: '取引先マスタ管理',       path: '/admin/masters/suppliers',         impl: true  },
  { label: '区分',         desc: '入替区分マスタ管理',     path: '/admin/masters/categories',        impl: false },
  { label: '設定パターン', desc: '機械設定パターン管理',   path: '/admin/masters/settings-patterns', impl: false },
  { label: '用語マスタ',   desc: '用語・略語マスタ管理',   path: '/admin/masters/glossary',          impl: false },
  { label: 'マニュアル',   desc: '機械マニュアル管理',     path: '/admin/masters/manuals',           impl: false },
]

export default function AdminMastersHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-masters-hub" className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="relative rounded-xl p-4 min-h-[100px] w-full text-center bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border border-border transition-colors cursor-pointer"
          >
            <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold ${
              t.impl ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {t.impl ? '実装済' : '未実装'}
            </span>
            <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
            <p className="text-sm text-muted mt-1 line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
