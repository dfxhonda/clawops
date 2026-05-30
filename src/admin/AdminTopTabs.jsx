import { useNavigate, useLocation } from 'react-router-dom'

// J-NAV-CONSOLIDATE-01: PCH取込タブを削除、AdminMastersHubPage の '取込' カードに一本化。
// /admin/import ルートと AdminImportHubPage 本体は変更しない (forbidden)。
const TABS = [
  { key: 'masters',  label: 'マスタ',         path: '/admin/masters'  },
  { key: 'collection', label: '集金',         path: '/admin/collection' },
  { key: 'audit',    label: '監査・履歴',     path: '/admin/audit'    },
  { key: 'reports',  label: '集計・レポート', path: '/admin/reports'  },
  { key: 'settings', label: '設定',           path: '/admin/settings' },
  { key: 'labels',   label: 'QRラベル',       path: '/admin/labels'   },
]

export default function AdminTopTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav data-testid="admin-top-tabs" className="flex overflow-x-auto">
      <button
        onClick={() => navigate('/launcher')}
        className="mr-4 text-sm text-gray-400 hover:text-white flex items-center gap-1 whitespace-nowrap px-4 py-3"
      >
        ← ホーム
      </button>
      {TABS.map(tab => {
        const active = pathname.startsWith(tab.path)
        return (
          <button
            key={tab.key}
            data-testid={`admin-tab-${tab.key}`}
            onClick={() => navigate(tab.path)}
            className={`px-4 py-3 text-base whitespace-nowrap border-b-2 transition-colors ${
              active
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
