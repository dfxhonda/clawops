// J-REPORTS-ANALYTICS-01 2026-05-30: 6 report pages 共通レイアウト
// タイトル + 子コンテンツ。各 page で再利用してナビ統一。戻る動線は共通[←][⌂]バー担保。
export default function ReportPageLayout({ title, children, testid }) {
  return (
    <div data-testid={testid} className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-20 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
      </div>
      <div className="px-4 py-4">
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ message = 'データがありません' }) {
  return (
    <div className="py-16 text-center text-muted text-sm">
      <p>{message}</p>
    </div>
  )
}

export function ReferenceBadge({ days }) {
  return (
    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300">
      参考値 ({days}日)
    </span>
  )
}
