import { useNavigate } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'

const ITEMS = [
  { label: '機種マスタ',  desc: '機種の登録・編集・削除',     path: '/admin/models' },
  { label: '機械管理',    desc: '機械の追加・編集・削除',     path: '/admin/machines' },
  { label: '機械モデル紐付', desc: '全店横断でmodel_id紐付・全カラム編集', path: '/admin/machine-links' },
  { label: 'ブース管理',  desc: 'ブース設定の確認・編集',     path: '/admin/booths' },
  { label: 'マニュアル',  desc: '機種マニュアルの作成・編集', path: '/admin/manuals' },
  { label: 'ロッカー',   desc: 'ガチャ機のロッカー設定',     path: '/admin/lockers' },
]

export default function AdminTop() {
  const navigate = useNavigate()
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button
          type="button"
          onClick={() => navigate('/launcher')}
          data-testid="header-launcher-menu"
          className="text-sm font-bold text-muted shrink-0 py-1 active:opacity-70"
        >
          ☰ メニュー
        </button>
        <div className="flex-1 text-base font-bold">管理メニュー</div>
        <LogoutButton to="/admin" />
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
