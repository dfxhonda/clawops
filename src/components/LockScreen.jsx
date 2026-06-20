// SPEC-AUTH-LOCK-S2: 全画面ロックoverlay
// onUnlock('webauthn'|'pin') は S5 で session-unlock Edge と結線
export function LockScreen({ staffName, onUnlock }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="画面ロック中"
      className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center gap-10 select-none"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-16 h-16 rounded-full bg-surface2 border-2 border-border flex items-center justify-center mb-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-dim"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-text-dim text-sm">ロック中</p>
        {staffName && (
          <p className="text-text font-bold text-lg">{staffName}</p>
        )}
      </div>

      <div className="flex flex-col gap-4 w-72 px-4">
        <button
          type="button"
          onClick={() => onUnlock?.('webauthn')}
          className="min-h-[44px] w-full rounded-xl bg-surface2 border border-border text-text font-bold py-3 px-6 flex items-center justify-center active:opacity-70 transition-opacity"
        >
          顔認証 / 生体認証
        </button>
        <button
          type="button"
          onClick={() => onUnlock?.('pin')}
          className="min-h-[44px] w-full rounded-xl bg-accent text-bg font-bold py-3 px-6 flex items-center justify-center active:opacity-70 transition-opacity"
        >
          PIN入力
        </button>
      </div>
    </div>
  )
}
