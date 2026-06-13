// SPEC-LOCKER-HIGHVALUE-PHASE1-01: 投入ダイアログ
// 空スロット -> 景品名検索 -> ヒット紐付 or 手入力+画像でその場マスタ作成
import { useEffect, useRef, useState } from 'react'
import { searchPrizeMasters } from '../../../services/prizeMasterSearch'
import { createLockerPrizeMaster } from '../../../services/lockerPrizeMaster'
import { fmtYen } from '../../../utils/format'

const S = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  box: { background: '#12121e', borderRadius: '14px 14px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 500, boxShadow: '0 -4px 30px rgba(0,0,0,.5)', maxHeight: '82dvh', overflowY: 'auto' },
  title: { fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#e8e8f0' },
  close: { background: 'none', border: 'none', color: '#8888a8', fontSize: 22, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, flexShrink: 0 },
  btn: { display: 'block', width: '100%', padding: 14, borderRadius: 8, border: '1px solid #2a2a44', background: '#1a1a2e', color: '#e8e8f0', fontSize: 14, marginBottom: 8, textAlign: 'left', cursor: 'pointer' },
  inp: { width: '100%', fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 6, padding: '0.5em 0.7em', color: '#d0d0e0', marginBottom: 10, boxSizing: 'border-box' },
  label: { fontSize: 11, color: '#8888a8', display: 'block', marginBottom: 4 },
  resultItem: { display: 'block', width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #2a2a44', background: '#1a1a2e', color: '#e8e8f0', fontSize: 13, marginBottom: 6, textAlign: 'left', cursor: 'pointer' },
}

// ───────────────────────────────────────────────
// 投入/入替フロー (空スロット or swap)
// ───────────────────────────────────────────────
function FillFlow({ slot, isSwap, onDone, onClose }) {
  // view: 'search' | 'confirm' | 'manual'
  const [view, setView] = useState('search')
  const [kw, setKw] = useState('')
  const [results, setResults] = useState([])
  const [selectedPrize, setSelectedPrize] = useState(null)
  const [confirmVal, setConfirmVal] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualVal, setManualVal] = useState('')
  const [manualImg, setManualImg] = useState(null)
  const [manualPreview, setManualPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const imgRef = useRef(null)

  useEffect(() => {
    if (kw.trim().length < 2) { setResults([]); return }
    let alive = true
    searchPrizeMasters(kw).then(r => { if (alive) setResults(r || []) })
    return () => { alive = false }
  }, [kw])

  function pickPrize(p) {
    setSelectedPrize(p)
    setConfirmVal(p.original_cost ? String(p.original_cost) : '')
    setView('confirm')
  }

  async function submit() {
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      if (view === 'confirm' && selectedPrize) {
        onDone({ name: selectedPrize.prize_name, value: parseInt(confirmVal) || 0, prizeId: selectedPrize.prize_id })
      } else if (view === 'manual') {
        if (!manualName.trim()) { setErr('景品名を入力してください'); return }
        const master = await createLockerPrizeMaster({ name: manualName, value: parseInt(manualVal) || 0, imageFile: manualImg })
        onDone({ name: master.prize_name, value: master.original_cost, prizeId: master.prize_id })
      }
    } catch (e) {
      setErr(e.message || 'エラーが発生しました')
    } finally {
      setBusy(false)
    }
  }

  function handleImgChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setManualImg(file)
    setManualPreview(URL.createObjectURL(file))
  }

  const actionLabel = isSwap ? '変更する' : '投入する'
  const headerLabel = isSwap ? `#${slot.slot_number} 景品変更` : `#${slot.slot_number} に投入`

  // ── 確認 (検索ヒット選択後) ──
  if (view === 'confirm' && selectedPrize) {
    return (
      <>
        <div style={S.title}>
          {headerLabel}
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ background: '#1a1a2e', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#e8e8f0', fontWeight: 700, marginBottom: 4 }}>{selectedPrize.prize_name}</div>
          {selectedPrize.short_name && <div style={{ fontSize: 11, color: '#8888a8' }}>{selectedPrize.short_name}</div>}
        </div>
        <label style={S.label}>金額</label>
        <input style={S.inp} type="text" inputMode="numeric" placeholder="¥ 参考価格"
          value={confirmVal} onChange={e => setConfirmVal(e.target.value)} onFocus={e => e.target.select()} />
        {err && <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button disabled={busy}
          style={{ ...S.btn, background: 'rgba(46,204,113,.12)', color: busy ? '#666' : '#2ecc71', borderColor: '#2ecc71' }}
          onClick={submit}>
          {busy ? '保存中...' : `✅ ${actionLabel}`}
        </button>
        <button style={{ ...S.btn, color: '#8888a8' }} onClick={() => setView('search')}>← 検索に戻る</button>
      </>
    )
  }

  // ── 手入力 ──
  if (view === 'manual') {
    return (
      <>
        <div style={S.title}>
          {headerLabel} — 手入力
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <label style={S.label}>景品名 *</label>
        <input style={S.inp} type="text" placeholder="例: Nike Air Force 1 27cm"
          value={manualName} onChange={e => setManualName(e.target.value)} onFocus={e => e.target.select()} />
        <label style={S.label}>金額</label>
        <input style={S.inp} type="text" inputMode="numeric" placeholder="¥"
          value={manualVal} onChange={e => setManualVal(e.target.value)} onFocus={e => e.target.select()} />
        {/* iOS Safari: display:none must be on the input itself */}
        <input ref={imgRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handleImgChange} />
        <button style={{ ...S.btn, color: '#8888a8', marginBottom: 12 }}
          onClick={() => imgRef.current?.click()}>
          📷 {manualImg ? '写真を撮り直す' : '商品画像を撮る (任意)'}
        </button>
        {manualPreview && (
          <img src={manualPreview} alt="preview"
            style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 6, marginBottom: 12, background: '#111' }} />
        )}
        {err && <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button disabled={busy}
          style={{ ...S.btn, background: 'rgba(46,204,113,.12)', color: busy ? '#666' : '#2ecc71', borderColor: '#2ecc71' }}
          onClick={submit}>
          {busy ? '登録中...' : `✅ ${actionLabel}`}
        </button>
        <button style={{ ...S.btn, color: '#8888a8' }} onClick={() => setView('search')}>← 検索に戻る</button>
      </>
    )
  }

  // ── 検索 (default) ──
  return (
    <>
      <div style={S.title}>
        {headerLabel}
        <button style={S.close} onClick={onClose}>✕</button>
      </div>
      <input style={{ ...S.inp, marginBottom: 8 }} type="text" placeholder="景品名を検索 (2文字以上)"
        value={kw} onChange={e => setKw(e.target.value)} onFocus={e => e.target.select()} autoFocus />
      {results.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {results.map(p => (
            <button key={p.prize_id} style={S.resultItem} onClick={() => pickPrize(p)}>
              <span style={{ fontWeight: 700 }}>{p.prize_name}</span>
              {p.short_name && <span style={{ color: '#8888a8', marginLeft: 6, fontSize: 11 }}>{p.short_name}</span>}
              {p.original_cost ? <span style={{ float: 'right', color: '#f0c040', fontFamily: "'Courier New',monospace", fontSize: 12 }}>{fmtYen(p.original_cost)}</span> : null}
            </button>
          ))}
        </div>
      )}
      {kw.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: 12, color: '#8888a8', marginBottom: 8 }}>「{kw}」は見つかりませんでした</div>
      )}
      <button style={{ ...S.btn, color: '#5dade2', borderColor: '#5dade2' }}
        onClick={() => setView('manual')}>
        ✏️ 手入力で登録する (JAN後差し可)
      </button>
    </>
  )
}

// ───────────────────────────────────────────────
// メインモーダル
// ───────────────────────────────────────────────
export default function LockerModal({ slot, onClose, onWon, onFill, onRemove, onSwap }) {
  const [editing, setEditing] = useState(false)

  if (!slot) return null

  const filled = slot.status === 'filled' && slot.prize_name
  const isSwap = filled && editing

  function handleOverlay(e) { if (e.target === e.currentTarget) onClose() }

  // 空きスロット or 入替編集 → 投入フロー
  if (!filled || isSwap) {
    return (
      <div style={S.overlay} onClick={handleOverlay}>
        <div style={S.box}>
          <FillFlow
            slot={slot}
            isSwap={isSwap}
            onClose={onClose}
            onDone={(payload) => {
              isSwap ? onSwap?.(slot.slot_id, payload) : onFill?.(slot.slot_id, payload)
              onClose()
            }}
          />
        </div>
      </div>
    )
  }

  // 景品入りスロット → アクション選択
  return (
    <div style={S.overlay} onClick={handleOverlay}>
      <div style={S.box}>
        <div style={S.title}>
          #{slot.slot_number}　{slot.prize_name}
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#8888a8', marginBottom: 14 }}>
          {fmtYen(slot.prize_value || 0)}
        </div>
        <button style={{ ...S.btn, background: 'rgba(255,107,107,.12)', color: '#ff6b6b', borderColor: '#ff6b6b' }}
          onClick={() => { onWon?.(slot.slot_id); onClose() }}>
          🎯 当たり — 空にする
        </button>
        {onSwap && (
          <button style={{ ...S.btn, background: 'rgba(93,173,226,.1)', color: '#5dade2', borderColor: '#5dade2' }}
            onClick={() => setEditing(true)}>
            🔄 景品を変更
          </button>
        )}
        <button style={S.btn} onClick={onClose}>↩ キャンセル</button>
        {onRemove && (
          <button style={{ ...S.btn, color: '#ff6b6b', marginBottom: 0 }}
            onClick={() => { onRemove?.(slot.slot_id); onClose() }}>
            🗑 撤去する
          </button>
        )}
      </div>
    </div>
  )
}
