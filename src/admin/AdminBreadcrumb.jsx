import { useLocation, useNavigate } from 'react-router-dom'

const LABELS = {
  admin:               'マネサポ',
  masters:             'マスタ',
  stores:              '店舗',
  'store-list':        '店舗',
  machines:            '機械',
  prizes:              '景品',
  lockers:             'ロッカー',
  staff:               'スタッフ',
  suppliers:           '取引先',
  categories:          '区分',
  'settings-patterns': '設定パターン',
  glossary:            '用語マスタ',
  manuals:             'マニュアル',
  audit:               '監査・履歴',
  'booth-edit':        '過去メーター編集',
  operations:          '全操作ログ',
  logins:              'ログイン履歴',
  'prize-phases':      '景品phase履歴',
  'locker-ops':        'ロッカー操作履歴',
  'stock-moves':       '在庫移動履歴',
  reports:             'レポート',
  'daily-booths':      '日次ブース',
  'hourly-booths':     '時別ブース',
  'daily-machines':    '日次機械',
  collections:         '集金抽出',
  billing:             '課金',
  settings:            '設定',
  flags:               'Feature Flags',
  'replace-rules':     '入替提案ルール',
  sgp:                 'SGP連携設定',
  orders:              '発注履歴',
  'bulk-import':       'Excel一括取込',
  labels:              'QRラベル',
  import:              '取込',
  collection:          '集金',
  'collection-flag':   '集金フラグ',
  'dev-assets':        'ファイル受け渡し',
  'booth-ranking':     'ブース売上ランキング',
  'payout-trend':      '払い出し率トレンド',
  '7dma':              '7日移動平均',
  'collection-cycle':  '集金サイクル',
  'prize-cost':        '景品コスト回収',
  'store-comparison':  '店舗間比較',
  'profit-calendar':   '利益率カレンダー',
}

export default function AdminBreadcrumb() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const parts = pathname.split('/').filter(Boolean)
  const segments = []
  let built = ''
  for (const part of parts) {
    built += '/' + part
    const label = LABELS[part]
    if (label) segments.push({ path: built, label })
  }

  if (segments.length <= 2) return null

  return (
    <nav data-testid="admin-breadcrumb" className="flex items-center gap-1 px-4 py-2 border-b border-border text-sm text-muted bg-bg shrink-0">
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1">
          {i > 0 && <span className="mx-1 text-border">/</span>}
          <button
            onClick={() => navigate(seg.path)}
            className={i === segments.length - 1 ? 'text-text font-semibold pointer-events-none' : 'hover:text-text transition-colors'}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
