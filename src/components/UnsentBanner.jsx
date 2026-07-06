// SPEC-LF1-STORE-LOCAL-CACHE-01: 未送信件数を表示する固定バナー。件数 0 の時は非表示。
// SPEC-LF1-IDEMPOTENT-SYNC-01 D7: タップで未送信レコードの読み取り専用詳細 + 再送ボタン。
// server 側で不可視な stuck record を端末側から診断・救済するため。UI は [A] 系 text-xs 密度。

import { useState } from 'react'
import { useUnsentBanner } from '../hooks/useUnsentBanner'
import { uploadAllUnsynced } from '../services/storeSync'
import { useAuth } from '../hooks/useAuth'

export default function UnsentBanner() {
  const { count, storeCount, records, refresh } = useUnsentBanner()
  const { staffId } = useAuth()
  const [open, setOpen] = useState(false)
  const [resending, setResending] = useState(false)

  if (!count) return null

  async function handleResend() {
    setResending(true)
    try {
      await uploadAllUnsynced({ staff: { staffId } })
    } catch { /* 失敗は storeSync が logger.error 済み */ }
    setResending(false)
    await refresh()
  }

  return (
    <>
      <button
        type="button"
        data-testid="unsent-banner"
        onClick={() => setOpen(o => !o)}
        aria-label={`未送信 ${count}件 詳細を開く`}
        className="fixed top-1 left-1/2 -translate-x-1/2 z-[110] px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold shadow active:scale-95"
      >
        未送信 {count}件 / {storeCount}店舗
      </button>

      {open && (
        <div
          data-testid="unsent-detail"
          className="fixed inset-0 z-[111] flex items-start justify-center bg-black/50 pt-10 px-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-xl p-3 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted">未送信レコード ({count}件)</p>
              <button type="button" onClick={() => setOpen(false)} className="text-muted text-lg px-2" aria-label="閉じる">×</button>
            </div>

            <div className="overflow-y-auto">
              <table className="w-full text-xs" data-testid="unsent-detail-table">
                <thead>
                  <tr className="text-muted border-b border-border">
                    <th className="text-left py-1 pr-1 font-normal">ブース</th>
                    <th className="text-left py-1 px-1 font-normal">日付</th>
                    <th className="text-right py-1 px-1 font-normal">IN</th>
                    <th className="text-right py-1 px-1 font-normal">OUT</th>
                    <th className="text-left py-1 pl-1 font-normal">err</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.localId} data-testid="unsent-row" className="border-b border-border/50">
                      <td className="py-1 pr-1 font-mono truncate max-w-[8rem]">{r.booth_code ?? '—'}</td>
                      <td className="py-1 px-1 font-mono">{r.patrol_date ?? '—'}</td>
                      <td className="py-1 px-1 text-right font-mono">{r.in_meter ?? '—'}</td>
                      <td className="py-1 px-1 text-right font-mono">{r.out_meter ?? '—'}</td>
                      <td className="py-1 pl-1 text-[10px] text-accent">{r.lastErrCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              data-testid="unsent-resend"
              onClick={handleResend}
              disabled={resending}
              className={`mt-3 w-full py-2 rounded-lg text-sm font-bold ${resending ? 'bg-surface2 text-muted opacity-50' : 'bg-accent text-bg active:scale-[0.98]'}`}
            >
              {resending ? '送信中…' : '再送'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
