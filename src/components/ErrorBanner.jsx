import { useState } from 'react'

export default function ErrorBanner({ errCode, message, onClose, onRetry }) {
  const [copied, setCopied] = useState(false)

  if (!errCode && !message) return null

  function handleCopy() {
    const text = `${errCode ?? 'UNKNOWN'}: ${message ?? ''}`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div
      role="alert"
      className="mx-4 mb-3 rounded-xl bg-red-950/60 border border-red-500/40 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {errCode && (
            <div className="text-xs font-bold text-red-400 font-mono mb-0.5">{errCode}</div>
          )}
          {message && (
            <div className="text-sm text-red-200 break-words">{message}</div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 text-red-400 text-lg leading-none px-1"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-bold text-red-400/80 border border-red-500/30 rounded px-2 py-0.5"
        >
          {copied ? 'コピー済み' : 'コピー'}
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-bold text-white bg-red-700/60 border border-red-500/40 rounded px-3 py-0.5"
          >
            再試行
          </button>
        )}
      </div>
    </div>
  )
}
