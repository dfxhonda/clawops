// J-STOCK-OCR-COUNT-TEST-01 (司令塔Opus spec): 棚卸 景品個数 OCR 精度テスト一時モジュール。
// DB 保存なし、localStorage 一時保存のみ。完了後削除 or 棚卸本体統合可能な疎結合設計。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/ui/PageHeader'
import OcrCountCapture from '../components/OcrCountCapture'

const STORAGE_KEY = 'ocr_count_test_log_v1'

function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveLog(arr) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)) } catch { /* ignore */ }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tokyo' })
}

export default function OcrCountTestPage() {
  const navigate = useNavigate()
  const [log, setLog] = useState([])

  useEffect(() => { setLog(loadLog()) }, [])

  function append(entry) {
    setLog(prev => {
      const next = [...prev, entry]
      saveLog(next)
      return next
    })
  }
  function clearLog() {
    if (!confirm('テストログを全て削除します。よろしいですか？')) return
    setLog([])
    saveLog([])
  }

  const total = log.length
  const correct = log.filter(l => l.correct).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null

  return (
    <div data-testid="ocr-count-test-page" className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="OCRカウントテスト"
        variant="compact"
        menuToLauncher
        onBack={() => navigate('/stock')}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <p className="text-xs text-muted">
          景品個数 OCR の精度確認用 (テスト版)。撮影 → 自動OCR → 確認 → 記録。
          DB 保存なし、ブラウザに一時保存のみ。
        </p>

        <OcrCountCapture onLog={append} />

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-text">テスト結果ログ</h2>
            <button
              type="button"
              onClick={clearLog}
              disabled={log.length === 0}
              data-testid="ocr-count-clear-log"
              className="text-xs px-3 py-1 rounded border border-border text-muted disabled:opacity-30"
            >
              ログをクリア
            </button>
          </div>
          <p data-testid="ocr-count-accuracy" className="text-xs text-muted mb-2">
            {total > 0
              ? `${correct}/${total} 一致 (${accuracy}%)`
              : 'まだ記録がありません'}
          </p>
          <ul className="space-y-1 text-xs">
            {log.slice().reverse().map((l, i) => (
              <li
                key={`${l.ts}-${i}`}
                data-testid="ocr-count-log-row"
                className={`flex items-center gap-2 px-2 py-1.5 rounded border ${l.correct ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-rose-900/20 border-rose-700/40'}`}
              >
                <span className="font-mono text-muted shrink-0">{formatTime(l.ts)}</span>
                <span className="text-text">
                  OCR <span className="font-mono">{l.ocr_value ?? '?'}</span>
                  {' → '}
                  確定 <span className="font-mono font-bold">{l.confirmed_value}</span>
                </span>
                <span className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded ${l.correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {l.correct ? '一致' : '修正'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
