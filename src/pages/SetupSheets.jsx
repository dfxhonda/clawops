import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'

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
  {
    name: 'locations',
    headers: ['location_id', 'name', 'parent_location_id', 'store_code', 'location_type', 'note', 'active_flag', 'created_at', 'updated_at'],
  },
  {
    name: 'stock_movements',
    headers: ['movement_id', 'prize_id', 'movement_type', 'from_owner_type', 'from_owner_id', 'to_owner_type', 'to_owner_id', 'quantity', 'note', 'created_at', 'created_by'],
  },
]

// prize_stocks シートの拡張列 (I-M)
const PRIZE_STOCKS_EXTRA_HEADERS = {
  range: 'prize_stocks!I1:M1',
  headers: ['owner_type', 'owner_id', 'tags', 'updated_at', 'updated_by'],
}

// 既存prizesシートに追加する列 (K1:S1)
const PRIZES_EXTRA_HEADERS = {
  range: 'prizes!K1:S1',
  headers: ['short_name', 'item_size', 'category', 'order_at', 'arrival_at', 'restock_count', 'stock_count', 'case_count', 'pieces_per_case'],
}

export default function SetupSheets() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  function addLog(msg, type = 'info') {
    setLog(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])
  }

  async function runSetup() {
    setRunning(true)
    setLog([])
    const token = accessToken
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

    // prizesシートの拡張列を追加 (K-S)
    addLog('prizesシートの拡張列を確認中...')
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(PRIZES_EXTRA_HEADERS.range)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const checkData = await checkRes.json()
      const existingHeaders = checkData.values?.[0] || []
      if (existingHeaders.length > 0 && existingHeaders[0]) {
        addLog('prizes拡張列は既に設定済み → スキップ', 'warn')
      } else {
        const putRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(PRIZES_EXTRA_HEADERS.range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [PRIZES_EXTRA_HEADERS.headers] })
          }
        )
        if (!putRes.ok) throw new Error('prizes列追加エラー: ' + putRes.status)
        addLog('prizes拡張列 (short_name〜pieces_per_case) を追加しました ✅', 'success')
      }
    } catch (e) {
      addLog('prizes列追加エラー: ' + e.message, 'error')
    }

    // locationsシートに初期データ投入
    addLog('拠点マスタデータを確認中...')
    try {
      const locCheck = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('locations!A2:A10')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const locData = await locCheck.json()
      const existingLocs = locData.values || []
      if (existingLocs.length > 0) {
        addLog(`拠点データ ${existingLocs.length}件あり → スキップ`, 'warn')
      } else {
        const now = new Date().toISOString()
        const locationRows = [
          ['KRM01', '久留米', '', 'KRM01', 'warehouse', '本拠点', '1', now, now],
          ['KRM01-S01', 'カウンター裏倉庫', 'KRM01', 'KRM01', 'sub_warehouse', '', '1', now, now],
          ['KRM01-S02', '卓球場倉庫', 'KRM01', 'KRM01', 'sub_warehouse', '', '1', now, now],
          ['TNK01', '田隈', '', 'TNK01', 'warehouse', '', '1', now, now],
          ['IZK01', '飯塚', '', 'IZK01', 'warehouse', '', '1', now, now],
          ['KGS01', '鹿児島', '', 'KGS01', 'warehouse', '', '1', now, now],
        ]
        for (const row of locationRows) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('locations!A:I')}:append?valueInputOption=USER_ENTERED`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ values: [row] }) }
          )
        }
        addLog(`拠点マスタ ${locationRows.length}件を投入しました（久留米+サブ2 / 田隈 / 飯塚 / 鹿児島） ✅`, 'success')
      }
    } catch (e) {
      addLog('拠点マスタ投入エラー: ' + e.message, 'error')
    }

    // prize_stocksシートの拡張列を追加 (I-M: owner_type〜updated_by)
    addLog('prize_stocksシートの拡張列を確認中...')
    try {
      const checkRes2 = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(PRIZE_STOCKS_EXTRA_HEADERS.range)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const checkData2 = await checkRes2.json()
      const existingHeaders2 = checkData2.values?.[0] || []
      if (existingHeaders2.length > 0 && existingHeaders2[0]) {
        addLog('prize_stocks拡張列は既に設定済み → スキップ', 'warn')
      } else {
        const putRes2 = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(PRIZE_STOCKS_EXTRA_HEADERS.range)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [PRIZE_STOCKS_EXTRA_HEADERS.headers] })
          }
        )
        if (!putRes2.ok) throw new Error('prize_stocks列追加エラー: ' + putRes2.status)
        addLog('prize_stocks拡張列 (owner_type〜updated_by) を追加しました ✅', 'success')
      }
    } catch (e) {
      addLog('prize_stocks列追加エラー: ' + e.message, 'error')
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
        <div className="text-sm text-muted mb-3">以下を実行します:</div>
        {SHEETS_TO_CREATE.map(s => (
          <div key={s.name} className="mb-3">
            <div className="text-text font-bold text-sm">新規シート: {s.name}</div>
            <div className="text-muted text-xs font-mono">{s.headers.join(' / ')}</div>
          </div>
        ))}
        <div className="mb-3">
          <div className="text-text font-bold text-sm">prizes列拡張 (K〜S)</div>
          <div className="text-muted text-xs font-mono">{PRIZES_EXTRA_HEADERS.headers.join(' / ')}</div>
        </div>
        <div className="mb-3">
          <div className="text-text font-bold text-sm">prize_stocks列拡張 (I〜M)</div>
          <div className="text-muted text-xs font-mono">{PRIZE_STOCKS_EXTRA_HEADERS.headers.join(' / ')}</div>
        </div>
        <div className="mb-1">
          <div className="text-text font-bold text-sm">拠点マスタ初期データ</div>
          <div className="text-muted text-xs">久留米(+サブ2) / 田隈 / 飯塚 / 鹿児島</div>
        </div>
      </div>

      {!done && (
        <button onClick={runSetup} disabled={running}
          className="w-full bg-accent text-black font-bold rounded-xl py-3 disabled:opacity-50 text-sm mb-4">
          {running ? '実行中...' : 'シートを作成する'}
        </button>
      )}

      {done && (
        <button onClick={() => { window.location.href = '/docs/prizes.html' }}
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
