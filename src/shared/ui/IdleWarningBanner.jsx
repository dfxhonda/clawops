/**
 * 自動ログアウト警告バナー
 * useIdleLogout が showWarning=true になった時に表示する
 * 画面上部に固定、タップ（= タイマーリセット）で非表示
 */
export function IdleWarningBanner({ onDismiss }) {
  return (
    <div
      role="alert"
      data-testid="idle-warning-banner"
      className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white px-4 py-3 flex items-center justify-center gap-3 text-sm font-bold shadow-md"
    >
      <span>⚠️ あと60秒で自動ログアウトします</span>
      <button
        onClick={onDismiss}
        className="underline text-white text-xs whitespace-nowrap"
      >
        継続する
      </button>
    </div>
  )
}
