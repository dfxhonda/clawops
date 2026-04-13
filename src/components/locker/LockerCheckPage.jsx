import { useState } from 'react'
import SlotCard from './SlotCard'
import LockerModal from './LockerModal'
import { fmtYen } from '../../utils/format'

// lockers: [{ locker_id, locker_number, slot_count, lock_type, label? }]
// slotsByLocker: { locker_id: Slot[] }
export default function LockerCheckPage({ machineName, lockers, slotsByLocker, onBack, onWon }) {
  const [modalSlot, setModalSlot] = useState(null)

  const allSlots = Object.values(slotsByLocker).flat()
  const total = allSlots.reduce((s, sl) => s + (sl.status === 'filled' ? (sl.prize_value || 0) : 0), 0)
  const empty = allSlots.filter(sl => sl.status !== 'filled').length

  return (
    <div style={{ background: '#0a0a12', height: '100dvh', overflowY: 'auto', padding: 10, color: '#e8e8f0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif" }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 6px', fontSize: 14, color: '#5dade2', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}>
        ← 巡回画面に戻る
      </button>
      <div style={{ fontSize: 12, color: '#8888a8', marginBottom: 4 }}>{machineName}</div>

      {lockers.map(locker => {
        const slots = slotsByLocker[locker.locker_id] || []
        const lockerTotal = slots.reduce((s, sl) => s + (sl.status === 'filled' ? (sl.prize_value || 0) : 0), 0)
        return (
          <div key={locker.locker_id} style={{ background: '#12121e', border: '1px solid #2a2a44', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#5dade2', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔐 ロッカー{locker.locker_number}（{locker.slot_count}スロット・{locker.lock_type === 'key' ? '鍵式' : '暗証番号'}）{locker.posLabel} — 当たりチェック</span>
              <span style={{ fontSize: 10, color: '#f0c040' }}>{fmtYen(lockerTotal)}</span>
            </div>
            <div style={{ fontSize: 9, color: '#8888a8', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #2a2a44' }}>
              ← スワイプで空にする ｜ タップで詳細
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {slots.map(sl => (
                <SlotCard key={sl.slot_id} slot={sl} mode="check"
                  onWon={() => setModalSlot(sl)} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8888a8', padding: '5px 8px' }}>
              <span>小計</span>
              <span style={{ color: '#f0c040', fontWeight: 700, fontFamily: "'Courier New', monospace", fontSize: 13 }}>{fmtYen(lockerTotal)}</span>
            </div>
          </div>
        )
      })}

      {lockers.length > 1 && (
        <div style={{ border: '1px solid rgba(240,192,64,.3)', borderRadius: 6, padding: '8px 10px', background: 'rgba(240,192,64,.04)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8888a8' }}>
          <span style={{ color: '#f0c040' }}>合計 (空き{empty})</span>
          <span style={{ color: '#f0c040', fontWeight: 700, fontFamily: "'Courier New', monospace", fontSize: 13 }}>{fmtYen(total)}</span>
        </div>
      )}

      {modalSlot && (
        <LockerModal slot={modalSlot} onClose={() => setModalSlot(null)}
          onWon={(id) => { onWon?.(id); setModalSlot(null) }} />
      )}
    </div>
  )
}
