import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

const SHEETS_TO_CREATE = [
  {
    name: 'vehicle_stocks',
    headers: ['stock_id', 'staff_name', 'prize_id', 'prize_name', 'quantity', 'note', 'created_at', 'updated_at'],
  },
  {
    name: 'inventory_checks',
    headers: ['check_id', 'check_date', 'prize_id', 'prize_name', 'warehouse_qty', 'checked_by', 'note', 'created_at'],
  },
]

export default function SetupSheets() {
  const navigate = useNavigate()
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  function addLog(msg, type = 'info') {
    setLog(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])
  }

  async function runSetup() {
    setRunning(true)
    setLog([])
    const token = getToken()
    if (!token) {
      addLog('認証トークンがありません。先にログインしてください。', 'error')
      setRunning(false)
      return
    }

    // 既存シート名を取得
    addLog('スプレッドシート情報を取得中...')
    let existingSheets = []
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('API error: ' + res.status)
      const data = await res.json()
      existingSheets = data.sheets.map(s => s.properties.title)
      addLog(`既存シート: ${existingSheets.join(', ')}`, 'success')
    } catch (e) {
      addLog('シート情報の取得に失敗: ' + e.message, 'error')
      setRunning(false)
      return
    }

    for (const sheet of SHEETS_TO_CREATE) {
      if (existingSheets.includes(sheet.name)) {
        addLog(`「${sheet.name}」は既に存在します → スキップ`, 'warn')
        continue
      }

      // シート追加
      addLog(`「${sheet.name}」シートを作成中...`)
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: sheet.name } } }]
            })
          }
        )
        if (!res.ok) throw new Error('シート作成エラー: ' + res.status)
        addLog(`「${sheet.name}」シートを作成しました`, 'success')
      } catch (e) {
        addLog(`「${sheet.name}」作成失敗: ${e.message}`, 'error')
        continue
      }

      // ヘッダー行を書き込み
      addLog(`「${sheet.name}」にヘッダーを書き込み中...`)
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheet.name + '!A1')}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [sheet.headers] })
          }
        )
        if (!res.ok) throw new Error('ヘッダー書き込みエラー: ' + res.status)
        addLog(`「${sheet.name}」ヘッダー設定完了 ✅`, 'success')
      } catch (e) {
        addLog(`ヘッダー書き込み失敗: ${e.message}`, 'error')
      }
    }

    addLog('セットアップ完了！', 'success')
    setDone(true)
    setRunning(false)
  }

  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">シートセットアップ</h1>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <div className="text-sm text-muted mb-3">以下のシートを作成します:</div>
        {SHEETS_TO_CREATE.map(s => (
          <div key={s.name} className="mb-3">
            <div className="text-text font-bold text-sm">{s.name}</div>
            <div className="text-muted text-xs font-mono">{s.headers.join(' / ')}</div>
          </div>
        ))}
      </div>

      {!done && (
        <button onClick={runSetup} disabled={running}
          className="w-full bg-accent text-black font-bold rounded-xl py-3 disabled:opacity-50 text-sm mb-4">
          {running ? '実行中...' : 'シートを作成する'}
        </button>
      )}

      {done && (
        <button onClick={() => navigate('/admin/prizes')}
          className="w-full bg-accent3 text-black font-bold rounded-xl py-3 text-sm mb-4">
          景品管理へ移動
        </button>
      )}

      {/* ログ表示 */}
      {log.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-3 space-y-1.5">
          {log.map((l, i) => (
            <div key={i} className={`text-xs flex gap-2 ${
              l.type === 'error' ? 'text-accent2' :
              l.type === 'success' ? 'text-accent3' :
              l.type === 'warn' ? 'text-accent' : 'text-muted'
            }`}>
              <span className="text-muted/50 shrink-0">{l.time}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
