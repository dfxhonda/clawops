// J-NAV-ORPHANS-fix-02 2026-05-30 ヒロ ad-hoc: マネサポ 集金タブを Hub 化、
// 集金帳票 (/collection/input) と 集金フラグ編集 (/admin/collection-flag) の 2 タイル分岐。
// 既存のタブ直 path (/admin/collection-flag) は AdminTopTabs で /admin/collection に変更済。
import { useNavigate } from 'react-router-dom'

const TILES = [
  { label: '集金帳票',     desc: '金種カウント・売上伝票PDF', path: '/collection/input',       impl: true },
  { label: '集金フラグ編集', desc: '巡回 reading の集金済フラグ管理', path: '/admin/collection-flag', impl: true },
  { label: '集金履歴',     desc: '過去の集金帳票一覧',         path: '/collection/history',     impl: true },
]

export default function AdminCollectionHubPage() {
  const navigate = useNavigate()
  return (
    <div data-testid="admin-collection-hub" className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map(t => (
          <button
            key={t.path}
            data-testid={`collection-hub-tile-${t.label}`}
            onClick={() => navigate(t.path)}
            className="relative rounded-xl p-4 min-h-[100px] w-full text-center bg-surface hover:bg-surface/80 active:ring-2 active:ring-blue-500 border border-border transition-colors cursor-pointer"
          >
            <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold ${
              t.impl ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {t.impl ? '実装済' : '未実装'}
            </span>
            <p className="text-base font-bold text-text whitespace-nowrap mt-3">{t.label}</p>
            <p className="text-sm text-muted mt-1 line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
