import { useNavigate } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'

const ITEMS = [
  { icon: '🏭', label: '機種マスタ',  desc: '機種の登録・編集・削除',     path: '/admin/models' },
  { icon: '🎰', label: '機械管理',    desc: '機械の追加・編集・削除',     path: '/admin/machines' },
  { icon: '🎯', label: 'ブース管理',  desc: 'ブース設定の確認・編集',     path: '/admin/booths' },
  { icon: '📖', label: 'マニュアル',  desc: '機種マニュアルの作成・編集', path: '/admin/manuals' },
  { icon: '🔒', label: 'ロッカー',   desc: 'ガチャ機のロッカー設定',     path: '/admin/lockers' },
]

export default function AdminTop() {
  const navigate = useNavigate()
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
        <div className="flex-1 text-base font-bold">管理メニュー</div>
        <LogoutButton to="/admin/menu" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-8 grid grid-cols-1 gap-3 md:grid-cols-2 md:max-w-3xl md:mx-auto">
          {ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface border border-border
                active:scale-[0.98] transition-all text-left hover:border-accent/40"
            >
              <span className="text-3xl w-12 text-center">{item.icon}</span>
              <div className="flex-1">
                <div className="font-bold text-text text-sm">{item.label}</div>
                <div className="text-xs text-muted mt-0.5">{item.desc}</div>
              </div>
              <span className="text-muted/30 text-xl">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
