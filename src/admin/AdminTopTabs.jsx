import { useNavigate, useLocation } from 'react-router-dom'
import { MODULE_COLORS } from '../shared/ui/moduleColors'

// J-NAV-CONSOLIDATE-01: PCH取込タブを削除、AdminMastersHubPage の '取込' カードに一本化。
// /admin/import ルートと AdminImportHubPage 本体は変更しない (forbidden)。
// J-ADMIN-TAB-ORDER-fix-01 2026-05-31: タブ並び替え (集計/集金/監査/マスタ/設定/QR)、ラベル変更なし
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R1+R2: ラベル変更 + pill style
const TABS = [
  { key: 'reports',    label: '分析',     path: '/admin/reports'    },
  { key: 'collection', label: '集金',     path: '/admin/collection' },
  { key: 'audit',      label: '各履歴',   path: '/admin/audit'      },
  { key: 'masters',    label: 'マスタ',   path: '/admin/masters'    },
  { key: 'settings',   label: '設定',     path: '/admin/settings'   },
  { key: 'labels',     label: 'QRラベル', path: '/admin/labels'     },
]

export default function AdminTopTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav data-testid="admin-top-tabs" className="flex overflow-x-auto gap-1 px-2 py-1.5" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: MODULE_COLORS.admin }}>
      <button
        onClick={() => navigate('/launcher')}
        className="mr-2 text-sm text-gray-400 hover:text-white flex items-center gap-1 whitespace-nowrap px-3 py-2.5"
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
            className={`px-4 py-2.5 text-base whitespace-nowrap rounded-lg transition-colors font-bold ${
              active
                ? 'bg-accent text-white'
                : 'bg-surface/40 text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
