export default function UpdateBanner({ onDismiss }) {
  return (
    <div className="fixed bottom-14 left-0 right-0 z-[150] px-3">
      <div className="bg-accent text-bg rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <span className="text-xs flex-1">🔄 新しいバージョンがあります</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-bold bg-bg/20 hover:bg-bg/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          更新
        </button>
        <button onClick={onDismiss} className="text-xs text-bg/60 hover:text-bg px-1">✕</button>
      </div>
    </div>
  )
}
