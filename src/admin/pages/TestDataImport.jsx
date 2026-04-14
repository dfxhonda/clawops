import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthProvider'
import { clearCache } from '../../services/utils'
import { getPrizes } from '../../services/prizes'
import LogoutButton from '../../components/LogoutButton'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'
const SHEET_NAME = 'meter_readings'
const BATCH_SIZE = 50

function parseCSVLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    if (inQ) {
      if (line[i] === '"' && line[i+1] === '"') { cur += '"'; i++ }
      else if (line[i] === '"') inQ = false
      else cur += line[i]
    } else {
      if (line[i] === '"') inQ = true
      else if (line[i] === ',') { result.push(cur.trim()); cur = '' }
      else cur += line[i]
    }
  }
  result.push(cur.trim())
  return result
}

// ========== 棚卸しテストデータ生成 ==========
const TEST_STAFF = [
  { id: 'テストA', name: 'テストA（山田）' },
  { id: 'テストB', name: 'テストB（田中）' },
  { id: 'テストC', name: 'テストC（佐藤）' },
]

const TEST_LOCATIONS = ['KRM01', 'KRM01-S01', 'KRM01-S02', 'TNK01', 'IZK01', 'KGS01']

function dateStr(d) { return d.toISOString() }
function pastDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60), 0, 0)
  return d
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function generateInventoryTestData(prizes) {
  const activePrizes = prizes.filter(p => p.is_active !== 'FALSE').slice(0, 20)
  if (activePrizes.length === 0) return { stocks: [], movements: [] }

  const stockRows = [] // prize_stocks rows
  const movementRows = [] // stock_movements rows
  let mvSeq = 1
  let psSeq = 1

  // 1. 拠点在庫 — 各拠点に景品を分散配置
  const locationStockMap = {} // `${prizeId}__${locId}` → quantity
  for (const loc of TEST_LOCATIONS) {
    const prizeSubset = activePrizes.filter(() => Math.random() > 0.4) // 60%の確率で配置
    for (const p of prizeSubset) {
      const qty = randomInt(5, 50)
      const key = `${p.prize_id}__${loc}`
      locationStockMap[key] = qty
      stockRows.push([
        `TPS${psSeq++}`, p.prize_id, p.prize_name, '', '',
        qty, dateStr(pastDate(90)), 'テストデータ',
        'location', loc, '', dateStr(pastDate(90)), 'テストデータ'
      ])
    }
  }

  // 2. 担当車在庫 — 各スタッフに数種類
  const staffStockMap = {}
  for (const staff of TEST_STAFF) {
    const prizeSubset = activePrizes.filter(() => Math.random() > 0.6).slice(0, 8)
    for (const p of prizeSubset) {
      const qty = randomInt(2, 15)
      const key = `${p.prize_id}__${staff.id}`
      staffStockMap[key] = qty
      stockRows.push([
        `TPS${psSeq++}`, p.prize_id, p.prize_name, '', '',
        qty, dateStr(pastDate(5)), 'テストデータ',
        'staff', staff.id, '', dateStr(pastDate(5)), 'テストデータ'
      ])
    }
  }

  // 3. 3ヶ月分のstock_movements履歴（過去90日分）
  for (let daysAgo = 90; daysAgo >= 1; daysAgo -= randomInt(1, 3)) {
    const ts = dateStr(pastDate(daysAgo))
    const p = activePrizes[randomInt(0, activePrizes.length - 1)]

    // パターンをランダム選択
    const pattern = randomInt(1, 5)

    if (pattern === 1) {
      // 入庫: 外部 → 拠点
      const loc = TEST_LOCATIONS[randomInt(0, TEST_LOCATIONS.length - 1)]
      const qty = randomInt(10, 100)
      movementRows.push([
        `TMV${mvSeq++}`, p.prize_id, 'arrival',
        '', '', 'location', loc, qty,
        `テスト入庫: ${p.prize_name}`, ts, 'テストデータ'
      ])
    }
    else if (pattern === 2) {
      // 移管: 拠点 → スタッフ車
      const loc = TEST_LOCATIONS[randomInt(0, 2)] // 久留米系
      const staff = TEST_STAFF[randomInt(0, TEST_STAFF.length - 1)]
      const qty = randomInt(2, 20)
      movementRows.push([
        `TMV${mvSeq++}`, p.prize_id, 'transfer',
        'location', loc, 'staff', staff.id, qty,
        `積み込み: ${p.prize_name}`, ts, staff.id
      ])
    }
    else if (pattern === 3) {
      // 補充: スタッフ車 → ブース（replenish）
      const staff = TEST_STAFF[randomInt(0, TEST_STAFF.length - 1)]
      const qty = randomInt(1, 5)
      const boothCode = `KIK01-M${String(randomInt(1,10)).padStart(2,'0')}-B${String(randomInt(1,4)).padStart(2,'0')}`
      movementRows.push([
        `TMV${mvSeq++}`, p.prize_id, 'replenish',
        'staff', staff.id, 'booth', boothCode, qty,
        `補充: ${p.prize_name}`, ts, staff.id
      ])
    }
    else if (pattern === 4) {
      // 拠点間移管
      const fromLoc = TEST_LOCATIONS[randomInt(0, 2)]
      const toLoc = TEST_LOCATIONS[randomInt(3, TEST_LOCATIONS.length - 1)]
      const qty = randomInt(5, 30)
      movementRows.push([
        `TMV${mvSeq++}`, p.prize_id, 'transfer',
        'location', fromLoc, 'location', toLoc, qty,
        `拠点移管: ${fromLoc}→${toLoc}`, ts, 'テストデータ'
      ])
    }
    else {
      // 棚卸し調整
      const loc = TEST_LOCATIONS[randomInt(0, TEST_LOCATIONS.length - 1)]
      const qty = randomInt(-3, 3)
      movementRows.push([
        `TMV${mvSeq++}`, p.prize_id, qty !== 0 ? 'adjust' : 'count',
        'location', loc, 'location', loc, Math.abs(qty),
        `棚卸し: ${p.prize_name}`, ts, 'テストデータ'
      ])
    }
  }

  return { stocks: stockRows, movements: movementRows }
}

export default function TestDataImport() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  // meter_readings用
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)

  // 棚卸しテストデータ用
  const [invStatus, setInvStatus] = useState('idle')
  const [invLog, setInvLog] = useState([])

  function addLog(msg) {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`])
  }
  function addInvLog(msg, type = 'info') {
    setInvLog(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])
  }

  // ========== meter_readings テストデータ ==========
  async function loadCSV() {
    setStatus('loading')
    addLog('テストデータCSVを読み込み中...')
    try {
      const res = await fetch('/test-data.csv')
      const text = await res.text()
      const lines = text.split('\n').filter(l => l.trim())
      const rows = lines.slice(1).map(l => parseCSVLine(l).slice(0, 19))
      addLog(`✅ ${rows.length}行のデータを読み込みました`)
      setTotal(rows.length)
      return rows
    } catch (e) {
      addLog('❌ CSV読み込みエラー: ' + e.message)
      setStatus('error')
      setError(e.message)
      return null
    }
  }

  async function batchAppend(rows) {
    const token = accessToken
    if (!token) { addLog('❌ ログインが必要です'); setStatus('error'); return }
    setStatus('running')
    let done = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME + '!A:S')}:append?valueInputOption=USER_ENTERED`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: batch }) }
        )
        if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`) }
        done += batch.length; setProgress(done)
        if (done % 500 === 0 || done === rows.length) addLog(`📊 ${done}/${rows.length}件 投入完了 (${Math.round(done/rows.length*100)}%)`)
      } catch (e) {
        addLog(`❌ バッチエラー: ${e.message}`)
        if (e.message.includes('401') || e.message.includes('403')) { addLog('🔑 再ログインしてください'); setStatus('error'); setError('認証エラー'); return }
        addLog('⏳ 3秒後にリトライ...'); await new Promise(r => setTimeout(r, 3000)); i -= BATCH_SIZE
      }
    }
    addLog(`🎉 全${done}件の投入が完了しました！`)
    setStatus('done')
  }

  async function handleStart() {
    const rows = await loadCSV()
    if (!rows) return
    await batchAppend(rows)
  }

  // ========== 棚卸しテストデータ ==========
  async function handleInventoryTestData() {
    const token = accessToken
    if (!token) { addInvLog('認証トークンがありません', 'error'); return }

    setInvStatus('running')
    setInvLog([])
    addInvLog('景品マスタを取得中...')

    let prizes
    try {
      prizes = await getPrizes()
      addInvLog(`景品マスタ: ${prizes.length}件取得`, 'success')
    } catch (e) {
      addInvLog('景品マスタ取得失敗: ' + e.message, 'error')
      setInvStatus('error'); return
    }

    if (prizes.length === 0) {
      addInvLog('景品マスタが空です。先に景品を登録してください。', 'error')
      setInvStatus('error'); return
    }

    addInvLog('テストデータを生成中...')
    const { stocks, movements } = generateInventoryTestData(prizes)
    addInvLog(`在庫データ ${stocks.length}件 / 移動履歴 ${movements.length}件 を生成`, 'success')

    // prize_stocks に投入
    addInvLog('prize_stocks に投入中...')
    try {
      for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
        const batch = stocks.slice(i, i + BATCH_SIZE)
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('prize_stocks!A:M')}:append?valueInputOption=USER_ENTERED`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: batch }) }
        )
        if (!res.ok) throw new Error('API error: ' + res.status)
        addInvLog(`prize_stocks: ${Math.min(i + BATCH_SIZE, stocks.length)}/${stocks.length}件`)
      }
      addInvLog(`prize_stocks ${stocks.length}件 投入完了 ✅`, 'success')
    } catch (e) {
      addInvLog('prize_stocks投入失敗: ' + e.message, 'error')
      setInvStatus('error'); return
    }

    // stock_movements に投入
    addInvLog('stock_movements に投入中...')
    try {
      for (let i = 0; i < movements.length; i += BATCH_SIZE) {
        const batch = movements.slice(i, i + BATCH_SIZE)
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('stock_movements!A:K')}:append?valueInputOption=USER_ENTERED`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: batch }) }
        )
        if (!res.ok) throw new Error('API error: ' + res.status)
        addInvLog(`stock_movements: ${Math.min(i + BATCH_SIZE, movements.length)}/${movements.length}件`)
      }
      addInvLog(`stock_movements ${movements.length}件 投入完了 ✅`, 'success')
    } catch (e) {
      addInvLog('stock_movements投入失敗: ' + e.message, 'error')
      setInvStatus('error'); return
    }

    clearCache()
    addInvLog('全テストデータ投入完了！', 'success')
    setInvStatus('done')
  }

  const pct = total > 0 ? Math.round(progress / total * 100) : 0

  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/menu')} className="text-muted text-2xl">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-accent">テストデータ投入</h1>
          <p className="text-xs text-muted">巡回データ＋棚卸しデータのシミュレーション</p>
        </div>
        <LogoutButton />
      </div>

      {/* ===== 棚卸しテストデータ ===== */}
      <div className="bg-surface border-2 border-accent3/50 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-bold text-accent3 mb-3">📦 棚卸しテストデータ</h2>
        <div className="text-xs text-muted space-y-1 mb-3">
          <div>👤 テストA（山田）/ テストB（田中）/ テストC（佐藤）</div>
          <div>🏢 久留米系(3拠点) / 田隈 / 飯塚 / 鹿児島</div>
          <div>📊 拠点在庫 + 車両在庫 + 3ヶ月分の移動履歴</div>
          <div className="text-accent/80">※ 景品マスタの先頭20件を使用</div>
        </div>

        <button onClick={handleInventoryTestData}
          disabled={invStatus === 'running'}
          className={`w-full font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 ${
            invStatus === 'done' ? 'bg-accent3 text-black' :
            invStatus === 'error' ? 'bg-accent2 text-white' :
            invStatus === 'running' ? 'bg-accent3/50 text-black cursor-wait' :
            'bg-accent3 text-black'
          }`}>
          {invStatus === 'idle' ? '📦 棚卸しテストデータを投入' :
           invStatus === 'running' ? '⏳ 投入中...' :
           invStatus === 'done' ? '✅ 投入完了！' :
           '❌ エラー（再試行）'}
        </button>

        {invStatus === 'done' && (
          <button onClick={() => navigate('/inventory')}
            className="w-full mt-2 bg-accent text-black font-bold rounded-xl py-2 text-sm">
            棚卸しダッシュボードへ →
          </button>
        )}

        {invLog.length > 0 && (
          <div className="mt-3 bg-surface2 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
            {invLog.map((l, i) => (
              <div key={i} className={`text-xs flex gap-2 ${
                l.type === 'error' ? 'text-accent2' : l.type === 'success' ? 'text-accent3' : 'text-muted'
              }`}>
                <span className="text-muted/50 shrink-0">{l.time}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== 巡回テストデータ (既存) ===== */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-accent mb-3">🚶 巡回テストデータ（meter_readings）</h2>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div>
            <div className="text-2xl font-bold text-accent">3,379</div>
            <div className="text-[10px] text-muted">レコード</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">55</div>
            <div className="text-[10px] text-muted">ブース</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent3">3ヶ月</div>
            <div className="text-[10px] text-muted">1月〜3月</div>
          </div>
        </div>
        <div className="text-xs text-muted space-y-1 mb-3">
          <div>👤 山田（リーダー）: 全店舗 / 月水金 / ミス率1%</div>
          <div>👤 田中（新人）: 菊陽・合志 / 火木土 / ミス率5%</div>
          <div>👤 佐藤（新人）: 下通・南熊本 / 火木土 / ミス率3%</div>
        </div>

        {/* プログレスバー */}
        {status !== 'idle' && (
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">進捗</span>
              <span className="text-accent font-bold">{progress.toLocaleString()} / {total.toLocaleString()}</span>
            </div>
            <div className="w-full bg-surface2 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: status === 'done' ? '#4ade80' : status === 'error' ? '#f87171' : '#3b82f6'
                }} />
            </div>
          </div>
        )}

        <button onClick={handleStart}
          disabled={status === 'running' || status === 'loading'}
          className={`w-full font-bold rounded-xl py-3 text-sm transition-all disabled:opacity-50 ${
            status === 'done' ? 'bg-green-600 text-white' :
            status === 'error' ? 'bg-red-600 text-white' :
            status === 'running' ? 'bg-blue-600/50 text-white cursor-wait' :
            'bg-accent text-black'
          }`}>
          {status === 'idle' ? '🚀 巡回テストデータ投入' :
           status === 'loading' ? '📥 CSV読み込み中...' :
           status === 'running' ? `⏳ 投入中... ${pct}%` :
           status === 'done' ? '✅ 投入完了！' :
           '❌ エラー（再試行）'}
        </button>

        {status === 'done' && (
          <button onClick={() => navigate('/dashboard')}
            className="w-full mt-2 bg-blue-600 text-white font-bold rounded-xl py-2 text-sm">
            ダッシュボードへ →
          </button>
        )}

        {log.length > 0 && (
          <div className="mt-3 bg-surface2 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">実行ログ</div>
            {log.map((l, i) => (
              <div key={i} className="text-xs font-mono text-muted">{l}</div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-muted/60 text-center">
        ⚠️ テストデータは既存データに追記されます。削除する場合はシートから手動で行を削除してください。
      </div>
    </div>
  )
}
