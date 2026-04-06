import { useNavigate } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'

const DOCS_BASE = '/docs/'

const SECTIONS = [
  {
    title: '現場作業',
    items: [
      { icon: '📦', title: '棚卸し管理', desc: '入庫・移管・棚卸し・マッチング', path: '/inventory', highlight: true },
      { icon: '🔍', title: 'データ検索', desc: '過去データの検索・修正', path: '/datasearch' },
      { icon: '📋', title: '監査ログ', desc: '操作履歴の確認・追跡', path: '/admin/audit' },
    ]
  },
  {
    title: '本部管理',
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
    title: '開発ツール',
    devOnly: true,
    items: [
      { icon: '📷', title: 'QRスキャン', desc: 'ブースQRで直接入力', path: '/patrol' },
      { icon: '🔧', title: 'シートセットアップ', desc: '新規シート作成・初期化', path: '/admin/setup-sheets' },
      { icon: '🧪', title: 'テストデータ投入', desc: 'シミュレーションデータ', path: '/admin/test-data' },
    ]
  },
]

export default function AdminMenu() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center justify-between">
        <div className="text-base font-bold">メニュー</div>
        <LogoutButton />
      </div>

      {SECTIONS.map(sec => (
        <div key={sec.title}>
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider px-4 pt-4 pb-1">
            {sec.title}
            {sec.external && <span className="ml-1 text-blue-400 normal-case">(別ページで開きます)</span>}
          </div>
          <div className="px-3 space-y-1.5">
            {sec.items.map(item => {
              if (item.href) {
                // 外部リンク（静的HTML）
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
    </div>
  )
}
