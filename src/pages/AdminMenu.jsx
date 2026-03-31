import { useNavigate } from 'react-router-dom'
import { clearToken } from '../services/sheets'

const SECTIONS = [
  {
    title: '棚卸し・在庫',
    items: [
      { icon: '📦', title: '棚卸し管理', desc: '入庫・移管・棚卸し・マッチング', path: '/inventory', highlight: true },
    ]
  },
  {
    title: 'マスタ管理',
    items: [
      { icon: '🏪', title: '店舗管理', desc: '店舗の追加・編集・契約率', path: '/admin/stores' },
      { icon: '🎰', title: '機械管理', desc: '機械の追加・ブース生成', path: '/admin/machines' },
      { icon: '🎁', title: '景品管理 (Sheets)', desc: '景品マスタ・発注・在庫', path: '/admin/prizes' },
      { icon: '🗄️', title: '景品マスタ (Supabase)', desc: 'クラウドDB版・高速検索', path: '/db/prizes', highlight: true },
      { icon: '🎰', title: '機械管理 (Supabase)', desc: '機械登録・ブース自動生成', path: '/db/machines', highlight: true },
    ]
  },
  {
    title: 'マスタ設定 (Supabase)',
    items: [
      { icon: '🏷️', title: 'マシンタイプ', desc: 'クレーン機種の種類管理', path: '/db/machine-types', highlight: true },
      { icon: '📂', title: 'マシンカテゴリ', desc: 'クレーン・ガチャ等の分類', path: '/db/machine-categories', highlight: true },
      { icon: '📋', title: '所有形態', desc: '購入・リース・レンタル', path: '/db/ownership-types', highlight: true },
      { icon: '🚚', title: '仕入先', desc: '景品の仕入先マスタ', path: '/db/suppliers', highlight: true },
      { icon: '🔄', title: '移管タイプ', desc: '在庫移管の種類管理', path: '/db/transfer-types', highlight: true },
      { icon: '🔍', title: '巡回ステータス', desc: '巡回時の状態選択肢', path: '/db/patrol-statuses', highlight: true },
    ]
  },
  {
    title: 'データ',
    items: [
      { icon: '🔍', title: 'データ検索', desc: '過去データの検索・修正', path: '/datasearch' },
      { icon: '📄', title: '集金帳票', desc: 'インポート・出力', path: '/admin/import-slips' },
    ]
  },
  {
    title: 'ツール',
    items: [
      { icon: '📷', title: 'QRスキャン', desc: 'ブースQRで直接入力', path: '/patrol' },
      { icon: '🔧', title: 'シートセットアップ', desc: '新規シート作成・初期化', path: '/admin/setup-sheets' },
      { icon: '🧪', title: 'テストデータ投入', desc: '3名×3ヶ月のシミュレーション', path: '/admin/test-data' },
    ]
  },
]

export default function AdminMenu() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center justify-between">
        <div className="text-base font-bold">管理</div>
        <button onClick={() => { clearToken(); navigate('/login') }}
          className="text-xs text-muted hover:text-accent2 transition-colors">
          ログアウト
        </button>
      </div>

      {SECTIONS.map(sec => (
        <div key={sec.title}>
          <div className="text-[10px] text-muted font-bold uppercase tracking-wider px-4 pt-4 pb-1">{sec.title}</div>
          <div className="px-3 space-y-1.5">
            {sec.items.map(item => (
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
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
