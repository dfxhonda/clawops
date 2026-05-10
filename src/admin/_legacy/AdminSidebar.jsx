import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const CATEGORIES = [
  {
    id: 'masters', label: 'マスタ', path: '/admin/masters', testid: 'admin-nav-masters',
    items: [
      { label: '店舗',         path: '/admin/masters/stores',            impl: true,  testid: 'admin-nav-masters-stores' },
      { label: '機械',         path: '/admin/masters/machines',          impl: false },
      { label: '景品',         path: '/admin/masters/prizes',            impl: false },
      { label: 'ロッカー',     path: '/admin/masters/lockers',           impl: false },
      { label: 'スタッフ',     path: '/admin/masters/staff',             impl: false },
      { label: '取引先',       path: '/admin/masters/suppliers',         impl: false },
      { label: '区分',         path: '/admin/masters/categories',        impl: false },
      { label: '設定パターン', path: '/admin/masters/settings-patterns', impl: false },
      { label: '用語マスタ',   path: '/admin/masters/glossary',          impl: false },
      { label: 'マニュアル',   path: '/admin/masters/manuals',           impl: false },
    ],
  },
  {
    id: 'audit', label: '監査・履歴', path: '/admin/audit', testid: 'admin-nav-audit',
    items: [
      { label: '過去メーター編集',   path: '/admin/audit/booth-edit',  impl: true,  testid: 'admin-nav-audit-booth-edit' },
      { label: '全操作ログ',         path: '/admin/audit/operations',  impl: false },
      { label: 'ログイン履歴',       path: '/admin/audit/logins',      impl: false },
      { label: '景品phase履歴',      path: '/admin/audit/prize-phases',impl: false },
      { label: 'ロッカー操作履歴',   path: '/admin/audit/locker-ops',  impl: false },
      { label: '在庫移動履歴',       path: '/admin/audit/stock-moves', impl: false },
    ],
  },
  {
    id: 'reports', label: 'レポート', path: '/admin/reports', testid: 'admin-nav-reports',
    items: [
      { label: '日次ブース', path: '/admin/reports/daily-booths',   impl: false },
      { label: '時別ブース', path: '/admin/reports/hourly-booths',  impl: false },
      { label: '日次機械',   path: '/admin/reports/daily-machines', impl: false },
      { label: '集金抽出',   path: '/admin/reports/collections',    impl: false },
      { label: '課金',       path: '/admin/reports/billing',        impl: false },
    ],
  },
  {
    id: 'settings', label: '設定', path: '/admin/settings', testid: 'admin-nav-settings',
    items: [
      { label: 'Feature Flags',  path: '/admin/settings/flags',        impl: false },
      { label: '入替提案ルール', path: '/admin/settings/replace-rules', impl: false },
      { label: 'SGP連携設定',    path: '/admin/settings/sgp',           impl: false },
    ],
  },
]

export default function AdminSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const activeCatId = CATEGORIES.find(c => pathname.startsWith(c.path))?.id

  const [expanded, setExpanded] = useState(() => {
    const s = new Set()
    const active = CATEGORIES.find(c => pathname.startsWith(c.path))
    if (active) s.add(active.id)
    return s
  })

  useEffect(() => {
    if (activeCatId) {
      setExpanded(prev => {
        if (prev.has(activeCatId)) return prev
        return new Set([...prev, activeCatId])
      })
    }
  }, [activeCatId])

  function toggle(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside data-testid="admin-sidebar" className="w-60 h-full bg-surface border-r border-border flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">マネサポ</span>
      </div>
      <nav className="flex-1 py-1">
        {CATEGORIES.map(cat => {
          const isExpanded = expanded.has(cat.id)
          const isActive = activeCatId === cat.id
          return (
            <div key={cat.id}>
              <button
                data-testid={cat.testid}
                onClick={() => { navigate(cat.path); toggle(cat.id) }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-left transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-text hover:bg-surface/80'
                }`}
              >
                {cat.label}
                <span className="text-xs text-muted">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <ul>
                  {cat.items.map(item => {
                    const active = pathname === item.path || pathname.startsWith(item.path + '/')
                    return (
                      <li key={item.path}>
                        <button
                          data-testid={item.testid}
                          disabled={!item.impl}
                          onClick={() => item.impl && navigate(item.path)}
                          className={`w-full flex items-center justify-between px-6 py-1.5 text-sm text-left ${
                            !item.impl
                              ? 'text-muted cursor-not-allowed'
                              : active
                              ? 'bg-blue-50 text-blue-600 font-bold'
                              : 'text-text hover:bg-surface/60 transition-colors'
                          }`}
                        >
                          {item.label}
                          {!item.impl && <span className="text-xs text-gray-400 ml-2">未実装</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
