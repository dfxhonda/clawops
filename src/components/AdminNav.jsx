import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { icon: '🎮', label: '機種', path: '/admin/models' },
  { icon: '🕹️', label: '機械', path: '/admin/machines' },
  { icon: '📦', label: 'ブース', path: '/admin/booths' },
  { icon: '📖', label: 'マニュアル', path: '/admin/manuals' },
  { icon: '🔐', label: 'ロッカー', path: '/admin/lockers' },
]

export default function AdminNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <div className="sticky top-[45px] z-40 flex border-b border-border bg-bg print:hidden">
      {TABS.map(tab => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[10px] font-bold transition-colors
            ${pathname === tab.path ? 'text-accent border-b-2 border-accent' : 'text-muted'}`}
        >
          <span className="text-base leading-none">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
