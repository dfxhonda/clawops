import { useRef, useState } from 'react'

const S = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  box: { background: '#12121e', borderRadius: '14px 14px 0 0', padding: '20px 16px', width: '100%', maxWidth: 500, boxShadow: '0 -4px 30px rgba(0,0,0,.5)' },
  title: { fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#e8e8f0' },
  close: { background: 'none', border: 'none', color: '#8888a8', fontSize: 22, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 },
  btn: { display: 'block', width: '100%', padding: 14, borderRadius: 8, border: '1px solid #2a2a44', background: '#1a1a2e', color: '#e8e8f0', fontSize: 14, marginBottom: 8, textAlign: 'left', cursor: 'pointer' },
  inp: { width: '100%', fontSize: 16, background: '#222238', border: '1px solid #2a2a44', borderRadius: 4, padding: '0.4em', color: '#d0d0e0', marginBottom: 10, fontFamily: "'Courier New', monospace" },
  label: { fontSize: 11, color: '#8888a8', display: 'block', marginBottom: 4 },
}

// mode: 'won' | 'fill' | 'action'
export default function LockerModal({ slot, onClose, onWon, onFill, onRemove }) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const filled = slot?.status === 'filled' && slot?.prize_name

  if (!slot) return null

  function handleOverlay(e) { if (e.target === e.currentTarget) onClose() }

  // 空きスロット → 補充フォーム
  if (!filled) {
    return (
      <div style={S.overlay} onClick={handleOverlay}>
        <div style={S.box}>
          <div style={S.title}>
            #{slot.slot_number} に補充
            <button style={S.close} onClick={onClose}>✕</button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>景品名</label>
            <input style={S.inp} type="text" placeholder="景品マスタから検索..." value={name} onChange={e => setName(e.target.value)} onFocus={e => e.target.select()} />
            <label style={S.label}>金額</label>
            <input style={S.inp} type="text" inputMode="numeric" placeholder="¥" value={value} onChange={e => setValue(e.target.value)} onFocus={e => e.target.select()} />
          </div>
          <button style={{ ...S.btn, background: 'rgba(46,204,113,.1)', color: '#2ecc71', borderColor: '#2ecc71' }}
            onClick={() => { onFill?.(slot.slot_id, { name, value: parseInt(value) || 0 }); onClose() }}>
            ➕ 補充する
          </button>
        </div>
      </div>
    )
  }

  // 景品入りスロット → アクション選択
  return (
    <div style={S.overlay} onClick={handleOverlay}>
      <div style={S.box}>
        <div style={S.title}>
          #{slot.slot_number} {slot.prize_name}
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#8888a8', marginBottom: 14 }}>¥{String(slot.prize_value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</div>
        <button style={{ ...S.btn, background: 'rgba(255,107,107,.12)', color: '#ff6b6b', borderColor: '#ff6b6b' }}
          onClick={() => { onWon?.(slot.slot_id); onClose() }}>
          🎯 当たり — 空にする
        </button>
        <button style={S.btn} onClick={onClose}>↩ キャンセル</button>
        <button style={{ ...S.btn, color: '#ff6b6b', marginBottom: 0 }}
          onClick={() => { onRemove?.(slot.slot_id); onClose() }}>
          🗑 撤去する
        </button>
      </div>
    </div>
  )
}
