import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/',          icon: '✏️', label: '入力' },
  { path: '/dashboard', icon: '📊', label: '売上' },
  { path: '/admin',     icon: '⚙️', label: '管理' },
]

export default function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border z-[100] flex">
      {TABS.map(t => {
        const active = t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)
        return (
          <button key={t.path} onClick={() => navigate(t.path)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] min-h-[48px]
              ${active ? 'text-blue-400' : 'text-muted/60'}`}>
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
