import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

const SHEET_MAP = {
  'gacha_readings.csv': 'gacha_readings',
  'crane_readings.csv': 'crane_readings',
  'collection_data.csv': 'collection_data',
  'prize_orders_all.csv': 'prize_orders',
  'machines_import.csv': 'machines',
  'booths_import.csv': 'booths',
  'prizes_import.csv': 'prizes',
  'orders_all.csv': 'orders_history',
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export default function ImportData() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [files, setFiles] = useState({})
  const [logs, setLogs] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('ja-JP') }])
  }

  const handleFiles = (e) => {
    const selected = e.target.files
    Array.from(selected).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result.replace(/^\uFEFF/, '')
        const lines = text.split('\n').filter(l => l.trim())
        const header = parseCSVLine(lines[0])
        const rows = lines.slice(1).map(parseCSVLine)
        const sheetName = SHEET_MAP[file.name] || file.name.replace('.csv', '')

        setFiles(prev => ({
          ...prev,
          [file.name]: { header, rows, sheetName, selected: true }
        }))
        addLog(`${file.name} 読み込み: ${rows.length}行`, 'ok')
      }
      reader.readAsText(file)
    })
  }

  const toggleFile = (name) => {
    setFiles(prev => ({
      ...prev,
      [name]: { ...prev[name], selected: !prev[name].selected }
    }))
  }

  const updateSheetName = (name, newSheet) => {
    setFiles(prev => ({
      ...prev,
      [name]: { ...prev[name], sheetName: newSheet }
    }))
  }

  const runImport = async () => {
    const token = getToken()
    if (!token) { addLog('認証トークンがありません。再ログインしてください。', 'err'); return }

    const entries = Object.entries(files).filter(([_, d]) => d.selected)
    if (!entries.length) { addLog('ファイルが選択されていません', 'err'); return }

    setImporting(true)
    setProgress(0)

    try {
      // 既存シート取得
      addLog('既存シート情報を取得中...')
      const meta = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json())

      const existingNames = (meta.sheets || []).map(s => s.properties.title)
      addLog(`既存シート: ${existingNames.join(', ')}`)

      for (let i = 0; i < entries.length; i++) {
        const [filename, data] = entries[i]
        setProgress(((i + 1) / entries.length * 100))
        addLog(`[${i + 1}/${entries.length}] ${filename} → ${data.sheetName}`)

        try {
          // シート作成 or クリア
          if (existingNames.includes(data.sheetName)) {
            addLog(`  シート "${data.sheetName}" をクリア...`)
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(data.sheetName)}:clear`,
              { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            )
          } else {
            addLog(`  シート "${data.sheetName}" を新規作成...`)
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: data.sheetName } } }] })
              }
            )
            existingNames.push(data.sheetName)
          }

          // データ書き込み（500行ずつ）
          const allValues = [data.header, ...data.rows]
          const CHUNK = 500
          let written = 0
          for (let j = 0; j < allValues.length; j += CHUNK) {
            const chunk = allValues.slice(j, j + CHUNK)
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(data.sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: chunk })
              }
            )
            written += chunk.length
          }

          addLog(`  ✓ ${written - 1}行 書き込み完了`, 'ok')

          // Rate limit
          await new Promise(r => setTimeout(r, 500))

        } catch (err) {
          addLog(`  ✗ エラー: ${err.message}`, 'err')
        }
      }

      addLog('=== 全てのインポートが完了しました ===', 'ok')

    } catch (err) {
      addLog(`致命的エラー: ${err.message}`, 'err')
    }

    setImporting(false)
  }

  const fileCount = Object.keys(files).length
  const selectedCount = Object.values(files).filter(f => f.selected).length
  const totalRows = Object.values(files).filter(f => f.selected).reduce((s, f) => s + f.rows.length, 0)

  return (
    <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate('/admin')}
          style={{ background: 'none', border: 'none', color: '#00d2ff', fontSize: 24, cursor: 'pointer' }}>←</button>
        <h1 style={{ color: '#00d2ff', fontSize: 20, margin: 0 }}>データ一括インポート</h1>
      </div>

      {/* File Selection */}
      <div style={cardStyle}>
        <h2 style={h2Style}>CSVファイル選択</h2>
        <p style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
          取込/output/ フォルダのCSVを選択（複数可）
        </p>
        <input type="file" ref={fileRef} multiple accept=".csv"
          onChange={handleFiles} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current.click()}
          style={{ ...btnStyle, background: '#16213e', border: '1px dashed #00d2ff', color: '#00d2ff' }}>
          📁 CSVファイルを選択
        </button>

        {fileCount > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#74b9ff' }}>
            {fileCount}ファイル / {selectedCount}選択 / 計 {totalRows.toLocaleString()}行
          </div>
        )}
      </div>

      {/* Import Settings */}
      {fileCount > 0 && (
        <div style={cardStyle}>
          <h2 style={h2Style}>インポート設定</h2>
          {Object.entries(files).map(([name, data]) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', borderBottom: '1px solid #222', fontSize: 13
            }}>
              <input type="checkbox" checked={data.selected}
                onChange={() => toggleFile(name)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </div>
                <div style={{ color: '#888', fontSize: 11 }}>{data.rows.length}行</div>
              </div>
              <span style={{ color: '#666', fontSize: 12 }}>→</span>
              <input value={data.sheetName}
                onChange={(e) => updateSheetName(name, e.target.value)}
                style={{
                  background: '#0a0a1a', color: '#eee', border: '1px solid #444',
                  padding: '4px 8px', borderRadius: 4, width: 130, fontSize: 12
                }} />
            </div>
          ))}
        </div>
      )}

      {/* Execute */}
      {fileCount > 0 && (
        <div style={cardStyle}>
          <button onClick={runImport} disabled={importing || selectedCount === 0}
            style={{ ...btnStyle, width: '100%', opacity: importing ? 0.6 : 1 }}>
            {importing ? '⏳ インポート中...' : `🚀 ${selectedCount}ファイルをインポート`}
          </button>

          {importing && (
            <div style={{ width: '100%', height: 6, background: '#333', borderRadius: 3, marginTop: 8 }}>
              <div style={{
                height: '100%', background: 'linear-gradient(90deg, #00d2ff, #00b894)',
                borderRadius: 3, width: `${progress}%`, transition: 'width 0.3s'
              }} />
            </div>
          )}
        </div>
      )}

      {/* Log */}
      {logs.length > 0 && (
        <div style={{
          background: '#0a0a1a', borderRadius: 8, padding: 12, marginTop: 12,
          maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6
        }}>
          {logs.map((l, i) => (
            <div key={i} style={{
              color: l.type === 'ok' ? '#55efc4' : l.type === 'err' ? '#ff7675' : '#74b9ff'
            }}>
              [{l.time}] {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const cardStyle = { background: '#1a1a2e', borderRadius: 12, padding: 16, margin: '10px 0', border: '1px solid #333' }
const h2Style = { color: '#00d2ff', fontSize: 15, margin: '0 0 8px 0' }
const btnStyle = {
  background: '#e94560', color: '#fff', border: 'none', padding: '12px 20px',
  borderRadius: 8, fontSize: 14, cursor: 'pointer'
}
