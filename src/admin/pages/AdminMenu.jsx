import { useNavigate } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'
import { buildLabel } from '../../lib/buildInfo'
import { useAuth } from '../../hooks/useAuth'

const DOCS_BASE = '/docs/'

const ROLE_RANK = { staff: 0, patrol: 1, manager: 2, admin: 3 }
function canAccess(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

const SECTIONS = [
  {
    title: '現場作業',
    minRole: 'staff',
    items: [
      { icon: '🚶', title: '巡回入力', desc: '売上・メーターデータ入力', path: '/patrol/overview' },
      { icon: '📊', title: 'ダッシュボード', desc: '今日の売上サマリ', path: '/dashboard' },
    ]
  },
  {
    title: '入荷確認',
    minRole: 'staff',
    external: true,
    items: [
      { icon: '📋', title: '入荷チェック', desc: '景品の入荷確認', href: DOCS_BASE + 'orders.html' },
    ]
  },
  {
    title: '巡回QR',
    minRole: 'patrol',
    items: [
      { icon: '📷', title: 'QRスキャン', desc: 'ブースQRで直接入力', path: '/patrol' },
    ]
  },
  {
    title: '現場管理',
    minRole: 'manager',
    items: [
      { icon: '🔍', title: 'データ検索', desc: '過去データの検索・修正', path: '/datasearch' },
      { icon: '📋', title: '監査ログ', desc: '操作履歴の確認・追跡', path: '/admin/audit' },
      { icon: '📊', title: '監査サマリ', desc: '棚卸し・移管・入荷の件数集計', path: '/admin/audit-summary' },
      { icon: '📈', title: '日次集計バッチ', desc: '日次ブース統計の手動集計', path: '/admin/daily-stats' },
    ]
  },
  {
    title: 'QR印刷',
    minRole: 'manager',
    items: [
      { icon: '🏷️', title: 'QRコード印刷', desc: 'ブースQRラベルを生成・印刷', path: '/admin/qr-print' },
    ]
  },
  {
    title: '本部管理',
    minRole: 'manager',
    external: true,
    items: [
      { icon: '🏆', title: '景品マスタ', desc: '景品の登録・検索・編集', href: DOCS_BASE + 'prizes.html' },
      { icon: '📋', title: '発注管理', desc: '発注履歴・入荷チェック', href: DOCS_BASE + 'orders.html' },
      { icon: '📦', title: '在庫管理', desc: '在庫検索・移動記録', href: DOCS_BASE + 'inventory.html' },
      { icon: '📬', title: '景品案内', desc: '仕入先からの新商品案内', href: DOCS_BASE + 'announcements.html' },
      { icon: '🖼️', title: '画像マッチング', desc: '景品写真と景品マスタの手動紐付け', href: DOCS_BASE + 'image-match.html' },
      { icon: '⚙️', title: 'マスタ管理・ツール', desc: '店舗・機械・Excel出力', href: DOCS_BASE + 'admin.html' },
    ]
  },
  {
    title: 'マスタ管理',
    minRole: 'admin',
    items: [
      { icon: '🔐', title: 'ロッカー登録', desc: 'ガチャ機のロッカー設定', path: '/admin/lockers' },
      { icon: '🎮', title: '機種マスタ', desc: '機種の登録・編集・削除', path: '/admin/models' },
      { icon: '🕹️', title: '機械登録', desc: '機械の追加・ブース自動生成', path: '/admin/machines' },
      { icon: '📦', title: 'ブース一覧', desc: 'ブース設定の確認・編集', path: '/admin/booths' },
      { icon: '📖', title: 'マニュアル管理', desc: '機種マニュアルの作成・編集・公開', path: '/admin/manuals' },
    ]
  },
  {
    title: '開発ツール',
    minRole: 'admin',
    items: [
      { icon: '🔧', title: 'シートセットアップ', desc: '新規シート作成・初期化', path: '/admin/setup-sheets' },
    ]
  },
]

export default function AdminMenu() {
  const navigate = useNavigate()
  const { staffRole } = useAuth()

  const visibleSections = SECTIONS.filter(sec => canAccess(staffRole, sec.minRole ?? 'staff'))

  return (
    <div className="h-screen flex flex-col">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center justify-between shrink-0">
        <div className="text-base font-bold">メニュー</div>
        <LogoutButton />
      </div>
      <div className="flex-1 overflow-y-auto pb-16">

      {visibleSections.map(sec => (
        <div key={sec.title}>
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider px-4 pt-4 pb-1">
            {sec.title}
            {sec.external && <span className="ml-1 text-blue-400 normal-case">(別ページで開きます)</span>}
          </div>
          <div className="px-3 space-y-1.5">
            {sec.items.map(item => {
              if (item.href) {
                return (
                  <a key={item.href} href={item.href}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left bg-surface border border-border hover:border-blue-600/30 no-underline text-inherit">
                    <span className="text-2xl w-10 text-center">{item.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-[11px] text-muted">{item.desc}</div>
                    </div>
                    <span className="text-muted/30 text-lg">↗</span>
                  </a>
                )
              }
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left
                    active:scale-[0.98] transition-all
                    ${item.highlight ? 'bg-accent/10 border-2 border-accent' : 'bg-surface border border-border hover:border-blue-600/30'}`}>
                  <span className="text-2xl w-10 text-center">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-[11px] text-muted">{item.desc}</div>
                  </div>
                  <span className="text-muted/30 text-lg">›</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="px-4 py-6 text-center text-[10px] text-muted/30">
        {buildLabel()}
      </div>
      </div>
    </div>
  )
}
