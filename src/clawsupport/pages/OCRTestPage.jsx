import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import LiveCameraView from '../components/LiveCameraView'
import CustomNumpad from '../components/CustomNumpad'
import { useOCR } from '../hooks/useOCR'

const MAX = 999999
const S = {
  page:   { minHeight: '100dvh', background: '#0a0a16', color: '#d0d0e0', fontFamily: 'sans-serif', padding: 16 },
  label:  { fontSize: 11, color: '#8888a8', marginBottom: 4 },
  select: { width: '100%', background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '8px 10px', color: '#d0d0e0', fontSize: 14, marginBottom: 12 },
  btn:    { padding: '10px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 8 },
  card:   { background: '#16162a', border: '1px solid #2a2a44', borderRadius: 8, padding: 12, marginBottom: 12 },
  mono:   { fontFamily: 'monospace', fontSize: 12, color: '#8888a8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
}

export default function OCRTestPage() {
  const navigate = useNavigate()
  const { organizationId } = useAuth()
  const [stores, setStores]         = useState([])
  const [storeCode, setStoreCode]   = useState('')
  const [booths, setBooths]         = useState([])
  const [boothCode, setBoothCode]   = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [captured, setCaptured]     = useState(null)
  const [draft, setDraft]           = useState('')
  const [logs, setLogs]             = useState([])

  const fileInputRef = useRef(null)
  const { engine, toggleEngine, loading, error, boundingBox, runOCR } = useOCR({ boothCode, orgId: organizationId })

  function addLog(entry) {
    setLogs(prev => [{ ts: new Date().toLocaleTimeString('ja-JP'), ...entry }, ...prev].slice(0, 50))
  }

  useEffect(() => {
    supabase.from('stores').select('store_code,store_name').order('store_code')
      .then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    if (!storeCode) { setBooths([]); setBoothCode(''); return }
    supabase
      .from('machines')
      .select('machine_code,booths(booth_code)')
      .eq('store_code', storeCode)
      .then(({ data }) => {
        const all = (data ?? []).flatMap(m => (m.booths ?? []).map(b => b.booth_code)).sort()
        setBooths(all)
        setBoothCode(all[0] ?? '')
      })
  }, [storeCode])

  async function handleCapture(base64, blob) {
    setShowCamera(false)
    const url = blob ? URL.createObjectURL(blob) : null
    setCaptured({ base64, url })
    setConfirming(true)
    setDraft('')
    addLog({ event: 'capture', engine, boothCode })

    const { value, photoUrl } = await runOCR(base64, blob)
    addLog({ event: 'ocr_done', engine, value, photoUrl: photoUrl ?? null, boundingBox: boundingBox ?? null })
    if (value != null) setDraft(String(value))
  }

  function handleQR(code) {
    setShowCamera(false)
    addLog({ event: 'qr_scan', code })
    if (code) setBoothCode(code)
  }

  function handleNumKey(k) {
    if (k === '⌫') setDraft(d => d.slice(0, -1))
    else setDraft(d => { const n = d + k; return parseInt(n, 10) > MAX ? d : n })
  }

  function confirmDraft() {
    addLog({ event: 'confirmed', value: draft })
    setConfirming(false)
    setCaptured(null)
  }

  function cancelConfirm() {
    addLog({ event: 'cancelled' })
    setConfirming(false)
    setCaptured(null)
  }

  if (showCamera) {
    return (
      <LiveCameraView
        engine={engine}
        onToggleEngine={toggleEngine}
        onCapture={handleCapture}
        onQR={handleQR}
        onCancel={() => setShowCamera(false)}
      />
    )
  }

  if (confirming) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#0a0a16', display: 'flex', flexDirection: 'column' }}>
        {captured?.url && (
          <div style={{ position: 'relative', maxHeight: '33dvh', overflow: 'hidden', flexShrink: 0 }}>
            <img src={captured.url} alt="captured" style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
            {error && boundingBox && (
              <div style={{
                position: 'absolute',
                left: `${boundingBox.x * 100}%`, top: `${boundingBox.y * 100}%`,
                width: `${boundingBox.w * 100}%`, height: `${boundingBox.h * 100}%`,
                border: '2px solid #facc15', boxSizing: 'border-box',
              }} />
            )}
          </div>
        )}

        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <p style={S.label}>読み取り結果 ({engine === 'C' ? 'Claude Vision' : 'Tesseract'})</p>
          {loading && <p style={{ color: '#8888a8', fontSize: 13 }}>読み取り中…</p>}
          {error && !loading && <p style={{ color: '#f87171', fontSize: 12 }}>{error} — 手動入力で補正可</p>}
          <input
            readOnly value={draft}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #5dade2', borderRadius: 0, fontSize: 28, color: '#d0d0e0', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CustomNumpad onKey={handleNumKey} />
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 32px' }}>
          <button onClick={cancelConfirm} style={{ ...S.btn, flex: 1, background: '#2a2a44', color: '#e0e0f0' }}>キャンセル</button>
          <button onClick={confirmDraft} disabled={!draft} style={{ ...S.btn, flex: 2, background: draft ? '#5dade2' : '#2a2a44', color: '#000' }}>確定</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <button onClick={() => navigate('/launcher')} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4">
        ← ホーム
      </button>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#e0e0f0' }}>OCR 精度テスト</h1>

      <div style={S.card}>
        <p style={S.label}>店舗</p>
        <select value={storeCode} onChange={e => setStoreCode(e.target.value)} style={S.select}>
          <option value="">— 選択 —</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
        <p style={S.label}>ブース</p>
        <select value={boothCode} onChange={e => setBoothCode(e.target.value)} style={S.select}>
          <option value="">— 選択 —</option>
          {booths.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={S.card}>
        <button
          onClick={toggleEngine}
          style={{ ...S.btn, background: engine === 'C' ? '#5dade2' : '#a855f7', color: '#000', fontSize: 12 }}
        >
          {engine === 'C' ? '🤖 Claude Vision' : '🔤 Tesseract'} ← タップで切替
        </button>
        <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
          <button
            onClick={() => setShowCamera(true)}
            disabled={!boothCode}
            style={{ ...S.btn, flex: 1, background: boothCode ? '#22c55e' : '#2a2a44', color: boothCode ? '#000' : '#666', marginBottom: 0 }}
          >
            📷 カメラ起動
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!boothCode}
            style={{ ...S.btn, flex: 1, background: boothCode ? '#f59e0b' : '#2a2a44', color: boothCode ? '#000' : '#666', marginBottom: 0 }}
          >
            🖼️ ギャラリーから選択
          </button>
        </div>
        {/* display:none はinput要素自身に直接指定 (iOS Safari規則) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result.split(',')[1]
              handleCapture(base64, file)
            }
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
        {!boothCode && <p style={{ ...S.label, color: '#f87171', marginTop: 4 }}>ブースを選択してください</p>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ ...S.label, marginBottom: 0 }}>ログ ({logs.length}件)</p>
          {logs.length > 0 && (
            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#8888a8', fontSize: 11, cursor: 'pointer' }}>クリア</button>
          )}
        </div>
        {logs.length === 0 && <p style={S.label}>まだログなし</p>}
        {logs.map((l, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 6 }}>
            <p style={{ fontSize: 11, color: '#5dade2', marginBottom: 2 }}>{l.ts} — {l.event}</p>
            <p style={S.mono}>{JSON.stringify(l, null, 2).replace(/^{\s*|\s*}$/g, '').trim()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
