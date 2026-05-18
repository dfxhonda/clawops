import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import LiveCameraView from '../components/LiveCameraView'
import CustomNumpad from '../components/CustomNumpad'
import { useOCR } from '../hooks/useOCR'

const MAX = 999999

function jstDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function mapMetersToColumns(meters) {
  const inTypes = ['in','yen1000_in','yen500_in','yen100_in','in_a','in_b','change_in']
  const cols = { in_meter: null, out_meter: null, out_meter_2: null, out_meter_3: null }
  for (const t of inTypes) {
    const m = meters.find(x => x.type === t && x.value != null)
    if (m) { cols.in_meter = parseInt(m.value, 10); break }
  }
  const outOrder = ['out_a','out','capsule_out','prize_out','out_b','out_c','change_out']
  const outs = meters
    .filter(m => /out/i.test(m.type) && m.value != null)
    .sort((a,b) => outOrder.indexOf(a.type) - outOrder.indexOf(b.type))
  if (outs[0]) cols.out_meter   = parseInt(outs[0].value, 10)
  if (outs[1]) cols.out_meter_2 = parseInt(outs[1].value, 10)
  if (outs[2]) cols.out_meter_3 = parseInt(outs[2].value, 10)
  return cols
}

const S = {
  page:   { minHeight: '100dvh', background: '#0a0a16', color: '#d0d0e0', fontFamily: 'sans-serif', padding: 16 },
  label:  { fontSize: 11, color: '#8888a8', marginBottom: 4 },
  btn:    { padding: '10px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 8 },
  card:   { background: '#16162a', border: '1px solid #2a2a44', borderRadius: 8, padding: 12, marginBottom: 12 },
  mono:   { fontFamily: 'monospace', fontSize: 12, color: '#8888a8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
}

function meterMeta(type) {
  if (type === 'in')          return { label: 'IN',       color: '#0ea5e9', border: '#0ea5e9' }
  if (type === 'out_a')       return { label: 'A段',      color: '#22d3ee', border: '#06b6d4' }
  if (type === 'out_b')       return { label: 'B段',      color: '#a78bfa', border: '#8b5cf6' }
  if (type === 'out_c')       return { label: 'C段',      color: '#34d399', border: '#10b981' }
  if (type === 'out')         return { label: 'OUT',      color: '#f59e0b', border: '#d97706' }
  if (type === 'yen1000_in')  return { label: '¥1000 IN', color: '#fbbf24', border: '#d97706' }
  if (type === 'yen500_in')   return { label: '¥500 IN',  color: '#fb923c', border: '#ea580c' }
  if (type === 'yen100_in')   return { label: '¥100 IN',  color: '#f87171', border: '#dc2626' }
  if (type === 'change_in')   return { label: '両替IN',   color: '#60a5fa', border: '#2563eb' }
  if (type === 'change_out')  return { label: '両替OUT',  color: '#f472b6', border: '#db2777' }
  if (type === 'capsule_out') return { label: 'CAPS OUT', color: '#c084fc', border: '#9333ea' }
  if (type === 'prize_out')   return { label: 'PRIZE',    color: '#4ade80', border: '#16a34a' }
  return { label: type || '?', color: '#6b7280', border: '#4b5563' }
}

function confBadge(conf) {
  const n = typeof conf === 'number'
    ? conf
    : conf === 'high' ? 0.95 : conf === 'medium' ? 0.75 : conf === 'low' ? 0.45 : null
  if (n == null) return null
  if (n >= 0.9) return { label: '高', bg: '#064e3b', color: '#6ee7b7', border: '1px solid #059669' }
  if (n >= 0.7) return { label: '中', bg: '#1f2937', color: '#9ca3af', border: '1px solid #4b5563' }
  return { label: '低', bg: '#422006', color: '#fcd34d', border: '1px solid #d97706' }
}


export default function PatrolBoothInputPageBeta() {
  const { boothCode } = useParams()
  const storeCode   = boothCode.split('-')[0]
  const machineCode = boothCode.split('-').slice(0, 2).join('-')

  const navigate = useNavigate()
  const [showCamera, setShowCamera] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [captured, setCaptured]     = useState(null)
  const [draft, setDraft]           = useState('')
  const [ocrDetail, setOcrDetail]   = useState(null)
  const [meters, setMeters]         = useState([])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [timedOut, setTimedOut]     = useState(false)
  const [logs, setLogs]             = useState([])
  const [rawText, setRawText]       = useState(null)
  const [storagePath, setStoragePath] = useState(null)

  const fileInputRef = useRef(null)
  const { engine, toggleEngine, loading, error, boundingBox, elapsedMs, showHalfwayBadge, runOCR } =
    useOCR({ boothCode, orgId: DFX_ORG_ID })

  function addLog(entry) {
    setLogs(prev => [{ ts: new Date().toLocaleTimeString('ja-JP'), ...entry }, ...prev].slice(0, 50))
  }

  async function handleCapture(base64, blob) {
    setShowCamera(false)
    const url = blob ? URL.createObjectURL(blob) : null
    setCaptured({ base64, url })
    setConfirming(true)
    setDraft('')
    setOcrDetail(null)
    setMeters([])
    setFocusedIdx(0)
    setTimedOut(false)
    addLog({ event: 'capture', engine, boothCode })

    const result = await runOCR(base64, blob)
    const { value, photoUrl, detail, meters: ocrMeters, timeout, raw_text, anthropic_status, image_size_bytes, uploadError, storagePath: sp } = result
    setRawText(raw_text ?? null)
    setStoragePath(sp ?? null)
    if (detail) setOcrDetail(detail)
    if (timeout) {
      setTimedOut(true)
      addLog({ event: 'ocr_timeout', elapsed_ms: elapsedMs })
      return
    }
    const meterList = ocrMeters || []
    setMeters(meterList)
    if (meterList.length >= 2) {
      const inIdx = meterList.findIndex(m => m.type === 'in')
      setFocusedIdx(inIdx >= 0 ? inIdx : 0)
    }
    addLog({
      event: 'ocr_done',
      engine,
      value,
      photoUrl: photoUrl ?? null,
      meters_count: meterList.length,
      anthropic_status: anthropic_status ?? undefined,
      image_size_bytes: image_size_bytes ?? undefined,
      upload_error: uploadError ?? undefined,
      raw_text: raw_text ? raw_text.slice(0, 200) : undefined,
      raw_text_full: raw_text || undefined,
    })
    if (value != null) setDraft(String(value))
  }

  function handleNumKey(k) {
    if (meters.length >= 2) {
      setMeters(prev => prev.map((m, i) => {
        if (i !== focusedIdx) return m
        const cur = String(m.value ?? '')
        if (k === '⌫') return { ...m, value: cur.slice(0, -1) }
        const n = cur + k
        return parseInt(n, 10) > MAX ? m : { ...m, value: n }
      }))
    } else {
      if (k === '⌫') setDraft(d => d.slice(0, -1))
      else setDraft(d => { const n = d + k; return parseInt(n, 10) > MAX ? d : n })
    }
  }

  async function handleFinalize() {
    const cols = mapMetersToColumns(meters)
    const confList = meters.filter(m => m.confidence != null)
    const avgConf = confList.length
      ? confList.reduce((s, m) => s + m.confidence, 0) / confList.length
      : null
    const payload = {
      booth_id: boothCode,
      booth_code: boothCode,
      store_code: storeCode,
      machine_code: machineCode,
      organization_id: DFX_ORG_ID,
      patrol_date: jstDate(),
      ...cols,
      entry_type: 'patrol',
      source: 'patrol',
      input_method: 'ocr',
      ocr_confidence: avgConf,
      ocr_raw_text: rawText,
      ocr_attempted_at: new Date().toISOString(),
      photo_url: storagePath,
      note: JSON.stringify({ ocr_meters_raw: meters }),
    }
    const { data, error } = await supabase.from('meter_readings').insert(payload).select('reading_id').single()
    if (error) {
      localStorage.setItem('patrol_ocr_queue_' + Date.now(), JSON.stringify(payload))
      addLog({ event: 'finalized_queued', error: error.message })
      alert('DB保存失敗 (ローカルキュー保存): ' + error.message)
      resetConfirm()
    } else {
      addLog({ event: 'finalized_saved', reading_id: data.reading_id })
      alert('保存完了: ' + data.reading_id)
      resetConfirm()
      navigate('/clawsupport/beta/store/' + storeCode)
    }
  }

  function confirmDraft() {
    let confirmedValue
    if (meters.length >= 2) {
      const outA = meters.find(m => m.type === 'out_a')
      const inM  = meters.find(m => m.type === 'in')
      const outB = meters.find(m => m.type === 'out_b')
      const outM = meters.find(m => m.type === 'out')
      const parts = []
      if (outA?.value != null) parts.push(`A段:${outA.value}`)
      if (inM?.value != null)  parts.push(`IN:${inM.value}`)
      if (outB?.value != null) parts.push(`B段:${outB.value}`)
      if (!outA && outM?.value != null) parts.push(`OUT:${outM.value}`)
      confirmedValue = parts.join('/')
    } else {
      confirmedValue = draft
    }
    addLog({ event: 'confirmed', value: confirmedValue })
    resetConfirm()
  }

  function resetConfirm() {
    setConfirming(false)
    setCaptured(null)
    setMeters([])
    setTimedOut(false)
    setDraft('')
    setRawText(null)
    setStoragePath(null)
  }

  function cancelConfirm() {
    addLog({ event: 'cancelled' })
    resetConfirm()
  }

  // ─── カメラ画面 ────────────────────────────────────────────────────
  if (showCamera) {
    return (
      <LiveCameraView
        engine={engine}
        onToggleEngine={toggleEngine}
        onCapture={handleCapture}
        onQR={() => {}}
        onCancel={() => setShowCamera(false)}
      />
    )
  }

  // ─── 確認画面 ─────────────────────────────────────────────────────
  if (confirming) {
    const isMulti    = meters.length >= 2
    const elapsedSec = (elapsedMs / 1000).toFixed(1)
    const confirmDisabled = isMulti ? meters.every(m => !m.value) : !draft

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#0a0a16', display: 'flex', flexDirection: 'column' }}>

        {/* 撮影画像プレビュー - 上2/3 */}
        {captured?.url && (
          <img
            src={captured.url}
            alt="captured"
            style={{ height: '60vh', maxHeight: '60vh', width: '100%', objectFit: 'contain', background: '#000', display: 'block', flexShrink: 0 }}
          />
        )}

        {/* 下1/3: スクロール可能コンテンツ (OCR状態 + メーター + テンキー) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 100px' }}>
          {/* OCR状態 */}
          <div style={{ marginBottom: 6 }}>
            <p style={S.label}>読み取り結果 ({engine === 'C' ? 'Claude Vision' : 'Tesseract'})</p>
            {loading && (
              <div style={{ marginBottom: 6 }}>
                <p style={{ color: '#8888a8', fontSize: 13, marginBottom: 4 }}>読み取り中 {elapsedSec}秒</p>
                {showHalfwayBadge && (
                  <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', border: '1px solid #d97706', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                    あと3秒で手入力モード
                  </div>
                )}
              </div>
            )}
            {timedOut && !loading && (
              <p style={{ color: '#f87171', fontSize: 13, marginBottom: 6 }}>OCR失敗、手入力してください</p>
            )}
            {error && error !== 'OCR_TIMEOUT_8S' && !loading && (
              <>
                <p style={{ color: '#f87171', fontSize: 12, marginBottom: 4 }}>{error} — 手動入力で補正可</p>
                {ocrDetail && (
                  <pre style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, overflow: 'auto', maxHeight: 60, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {ocrDetail}
                  </pre>
                )}
              </>
            )}
          </div>

          {/* メーター値カード */}
          {isMulti ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${meters.length}, 1fr)`, gap: 6, marginBottom: 6 }}>
                {meters.map((m, i) => {
                  const isFocused = i === focusedIdx
                  const meta = meterMeta(m.type)
                  const badge = confBadge(m.confidence)
                  return (
                    <div
                      key={i}
                      data-testid={`meter-card-${i}`}
                      onClick={() => setFocusedIdx(i)}
                      style={{ ...S.card, marginBottom: 0, border: `2px solid ${isFocused ? meta.border : '#2a2a44'}`, cursor: 'pointer', padding: 8 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                        {badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: badge.bg, color: badge.color, border: badge.border, padding: '1px 4px', borderRadius: 3 }}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <input
                        readOnly
                        value={String(m.value ?? '')}
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `2px solid ${isFocused ? meta.border : '#333'}`, borderRadius: 0, fontSize: 20, color: '#d0d0e0', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  )
                })}
              </div>
              {!loading && (
                <div
                  data-testid="reconciliation-deferred"
                  style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textAlign: 'center' }}
                >
                  整合チェックは本番統合 (J-PATROL-OCR-fix-04) で動作
                </div>
              )}
            </>
          ) : (
            <input
              readOnly value={draft}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #5dade2', borderRadius: 0, fontSize: 28, color: '#d0d0e0', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
            />
          )}

          {/* テンキー */}
          <div style={{ marginBottom: 8 }}>
            <CustomNumpad onKey={handleNumKey} />
          </div>
        </div>

        {/* アクションボタン - 最下部固定 */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', gap: 8, padding: '8px 16px 32px', background: '#0a0a16', zIndex: 9999 }}>
          <button onClick={cancelConfirm} style={{ ...S.btn, flex: 1, background: '#2a2a44', color: '#e0e0f0', marginBottom: 0 }}>キャンセル</button>
          {isMulti ? (
            <button
              onClick={handleFinalize}
              disabled={confirmDisabled || loading}
              style={{ ...S.btn, flex: 2, background: (confirmDisabled || loading) ? '#2a2a44' : '#0891b2', color: (confirmDisabled || loading) ? '#666' : '#fff', marginBottom: 0 }}
            >
              この値で全て確定
            </button>
          ) : (
            <button
              onClick={confirmDraft}
              disabled={confirmDisabled || loading}
              style={{ ...S.btn, flex: 2, background: (confirmDisabled || loading) ? '#2a2a44' : '#5dade2', color: '#000', marginBottom: 0 }}
            >
              確定
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── メイン画面 ──────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <button onClick={() => navigate('/clawsupport/beta/store/' + storeCode)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-4">
        ← 戻る
      </button>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#e0e0f0' }}>巡回ベータ (OCR)</h1>
      <p style={{ ...S.label, marginBottom: 16 }}>{boothCode}</p>

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
            style={{ ...S.btn, flex: 1, background: '#22c55e', color: '#000', marginBottom: 0 }}
          >
            📷 カメラ起動
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ ...S.btn, flex: 1, background: '#f59e0b', color: '#000', marginBottom: 0 }}
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
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ ...S.label, marginBottom: 0 }}>ログ ({logs.length}件)</p>
          {logs.length > 0 && (
            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#8888a8', fontSize: 11, cursor: 'pointer' }}>クリア</button>
          )}
        </div>
        {logs.length === 0 && <p style={S.label}>まだログなし</p>}
        {logs.map((l, i) => {
          const { raw_text_full, ...logDisplay } = l
          return (
            <div key={i} style={{ ...S.card, marginBottom: 6 }}>
              <p style={{ fontSize: 11, color: '#5dade2', marginBottom: 2 }}>{l.ts} — {l.event}</p>
              <p style={S.mono}>{JSON.stringify(logDisplay, null, 2).replace(/^{\s*|\s*}$/g, '').trim()}</p>
              {raw_text_full && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: 11, color: '#8888a8', cursor: 'pointer' }}>raw_text 全文 ({raw_text_full.length}字)</summary>
                  <pre style={{ ...S.mono, marginTop: 4, maxHeight: 200, overflow: 'auto', background: '#0d0d1a', padding: 8, borderRadius: 4 }}>{raw_text_full}</pre>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
