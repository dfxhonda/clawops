// PatrolPage v3 — D1/D2 ガチャ 3メーター入力
// インライン numpad・据え置き(carry_forward)対応・景品変更・ロッカー個別編集
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getPrizeMasters } from '../../services/prizes'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import GachaCheckBar from './GachaCheckBar'

// ── カラー定数 ───────────────────────────────────────
const COL = {
  A: {
    label: 'A段 OUT',
    color: '#67e8f9',
    border: 'rgba(8,145,178,.45)',
    bg: 'rgba(8,47,73,.25)',
    bgActive: 'rgba(8,47,73,.55)',
  },
  IN: {
    label: '◆ IN',
    color: '#cbd5e1',
    border: 'rgba(71,85,105,.6)',
    bg: 'rgba(15,23,42,.7)',
    bgActive: 'rgba(15,23,42,.95)',
  },
  B: {
    label: 'B段 OUT',
    color: '#c4b5fd',
    border: 'rgba(124,58,237,.45)',
    bg: 'rgba(46,16,101,.25)',
    bgActive: 'rgba(46,16,101,.55)',
  },
}

const fmtN = n => (n == null ? '—' : Math.round(n).toLocaleString('ja-JP'))
const fmtD = d => {
  if (d == null || d === 0) return '±0'
  return d > 0 ? `+${d.toLocaleString('ja-JP')}` : d.toLocaleString('ja-JP')
}
const diffColor = d => d == null ? '#475569' : d > 0 ? '#34d399' : d < 0 ? '#f87171' : '#475569'

// ── Main Component ──────────────────────────────────
export default function GachaInputV3({
  pattern,             // 'D1' | 'D2'
  boothCode,           // booths.booth_code (A段景品永続化用)
  p,                   // patrol state from usePatrolForm
  prev,                // 前回読み値
  calc,                // 計算差分
  lockers = [],        // ロッカー一覧
  lockerState,         // useLockerState の返り値
  staffId,
  setPatrolIn,
  setPatrolOut,
  setPatrolZan,
  onCamera,            // OCRオーバーレイ起動
  resetPatrolInMeter,  // IN を前回値+未タッチにリセット
  resetPatrolOutMeter, // out[i] を前回値+未タッチにリセット
}) {
  // ── Local state ──────────────────────────────────
  const [numpadField, setNumpadField] = useState(null)  // null | 'A' | 'IN' | 'B'
  const [numpadInput, setNumpadInput] = useState('')
  const [prizeModal, setPrizeModal] = useState(null)    // null | 0 | 1 (outs index)
  const [prizeSearch, setPrizeSearch] = useState('')
  const [prizeList, setPrizeList] = useState([])
  const [prizeWorking, setPrizeWorking] = useState(false)
  const [prizeError, setPrizeError] = useState('')
  const [newPrizeMode, setNewPrizeMode] = useState(false)
  const [newPrizeName, setNewPrizeName] = useState('')
  const [newPrizeCost, setNewPrizeCost] = useState('')
  const [newPrizeAdding, setNewPrizeAdding] = useState(false)
  const [prizeModalBottom, setPrizeModalBottom] = useState(0)
  const [prizeModalMaxH, setPrizeModalMaxH] = useState(window.visualViewport?.height ?? window.innerHeight)
  const [lockerModal, setLockerModal] = useState(null)  // null | { locker, slot, lockerIdx }
  const [lockerSub, setLockerSub] = useState(null)      // null | 'restock' | 'replace'
  const [lkPrizeName, setLkPrizeName] = useState('')
  const [lkPrizeSearch, setLkPrizeSearch] = useState('')
  const [lkPriceVal, setLkPriceVal] = useState('')
  const [lkWorking, setLkWorking] = useState(false)

  useEffect(() => {
    getPrizeMasters().then(setPrizeList).catch(() => {})
  }, [])

  // iOS Safari キーボード対応: visualViewport でモーダルの bottom と maxHeight をピクセル制御
  useEffect(() => {
    if (prizeModal == null || !window.visualViewport) return
    function update() {
      const vv = window.visualViewport
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setPrizeModalBottom(keyboardH)
      setPrizeModalMaxH(Math.floor(vv.height * 0.85))
    }
    update()
    window.visualViewport.addEventListener('resize', update)
    window.visualViewport.addEventListener('scroll', update)
    return () => {
      window.visualViewport.removeEventListener('resize', update)
      window.visualViewport.removeEventListener('scroll', update)
      setPrizeModalBottom(0)
      setPrizeModalMaxH(window.visualViewport?.height ?? window.innerHeight)
    }
  }, [prizeModal])

  // ── 表示値・touched ──────────────────────────────
  const touched = {
    A: !!p?.touchedOuts?.[0]?.meter,
    IN: !!p?.inTouched,
    B: pattern === 'D2' && !!p?.touchedOuts?.[1]?.meter,
  }
  const displayVal = {
    A: touched.A && p?.outs?.[0]?.meter ? Number(p.outs[0].meter) : (prev?.outMeter ?? null),
    IN: touched.IN && p?.inMeter ? Number(p.inMeter) : (prev?.inMeter ?? null),
    B: touched.B && p?.outs?.[1]?.meter ? Number(p.outs[1].meter) : (prev?.outMeter2 ?? null),
  }
  const prevVal = { A: prev?.outMeter ?? null, IN: prev?.inMeter ?? null, B: prev?.outMeter2 ?? null }
  const diff = { A: calc?.outs?.[0]?.diff ?? null, IN: calc?.inDiff ?? null, B: calc?.outs?.[1]?.diff ?? null }

  // numpad 入力中のプレビュー
  const npNum = numpadInput ? parseInt(numpadInput) : null
  const npDiff = npNum != null && prevVal[numpadField] != null
    ? npNum - Number(prevVal[numpadField]) : null
  const npRevenue = (() => {
    if (!npDiff || npDiff <= 0) return 0
    const cost = numpadField === 'A' ? parseInt(p?.outs?.[0]?.cost) || 0
      : numpadField === 'B' ? parseInt(p?.outs?.[1]?.cost) || 0 : 0
    return npDiff * cost
  })()

  // ── Numpad handlers ──────────────────────────────
  function openNumpad(field) { setNumpadField(field); setNumpadInput('') }
  function closeNumpad() { setNumpadField(null); setNumpadInput('') }

  function numpadKey(key) {
    if (key === 'back') {
      setNumpadInput(s => s.slice(0, -1))
    } else if (key === 'carry') {
      if (numpadField === 'A') resetPatrolOutMeter?.(0)
      else if (numpadField === 'IN') resetPatrolInMeter?.()
      else if (numpadField === 'B') resetPatrolOutMeter?.(1)
      closeNumpad()
    } else {
      if (numpadInput.length >= 7) return
      setNumpadInput(s => s + key)
    }
  }

  function confirmNumpad() {
    if (numpadInput !== '') {
      if (numpadField === 'A') setPatrolOut(0, 'meter', numpadInput)
      else if (numpadField === 'IN') setPatrolIn(numpadInput)
      else if (numpadField === 'B') setPatrolOut(1, 'meter', numpadInput)
    }
    closeNumpad()
  }

  // ── 景品変更 ──────────────────────────────────────
  const filteredPrizes = prizeList.filter(pr =>
    !prizeSearch || pr.prize_name.toLowerCase().includes(prizeSearch.toLowerCase())
  )
  async function selectPrize(prizeId, prizeName, cost, slotIdx) {
    setPrizeError('')
    // ローカル state を先に更新（RPC 失敗でも入力は確定させる）
    setPatrolOut(slotIdx, 'prize', prizeName)
    setPatrolOut(slotIdx, 'prize_id', prizeId || '')
    if (cost != null && cost !== '') setPatrolOut(slotIdx, 'cost', String(cost))
    console.log('[selectPrize]', { slotIdx, prizeId, prizeName, cost, boothCode })
    // A段のみ booths.current_prize_id を即時永続化（SECURITY DEFINER RPC で RLS を回避）
    if (slotIdx === 0 && boothCode && prizeId) {
      setPrizeWorking(true)
      const { error: boothErr } = await supabase
        .rpc('update_booth_current_prize', { p_booth_code: boothCode, p_prize_id: prizeId, p_updated_by: staffId || null })
      setPrizeWorking(false)
      if (boothErr) {
        console.error('[selectPrize] booths RPC error:', boothErr)
        setPrizeError('景品DB更新失敗(保存には影響なし): ' + boothErr.message)
      } else {
        console.log('[selectPrize] booths.current_prize_id updated OK')
      }
    }
    setPrizeModal(null); setPrizeSearch('')
  }

  // ── ロッカーアクション ────────────────────────────
  function openLockerModal(locker, slot, lockerIdx) {
    setLockerModal({ locker, slot, lockerIdx })
    setLockerSub(null); setLkPrizeName(''); setLkPriceVal(''); setLkPrizeSearch('')
  }
  function closeLockerModal() { setLockerModal(null); setLockerSub(null) }

  const filteredLkPrizes = prizeList.filter(pr =>
    !lkPrizeSearch || pr.prize_name.toLowerCase().includes(lkPrizeSearch.toLowerCase())
  )

  async function handleLockerAction(action) {
    const { slot } = lockerModal
    setLkWorking(true)
    try {
      if (action === 'sell') {
        await lockerState.wonSlot(slot.slot_id, staffId); closeLockerModal()
      } else if (action === 'empty') {
        await lockerState.removeSlot(slot.slot_id, staffId); closeLockerModal()
      } else {
        setLockerSub(action)
      }
    } catch (e) { console.error(e) }
    finally { setLkWorking(false) }
  }

  async function confirmLockerPrize() {
    const { slot } = lockerModal
    setLkWorking(true)
    try {
      const data = { name: lkPrizeName.trim(), value: parseInt(lkPriceVal) || 0 }
      if (lockerSub === 'restock') await lockerState.fillSlot(slot.slot_id, data, staffId)
      else await lockerState.swapSlot(slot.slot_id, data, staffId)
      closeLockerModal()
    } catch (e) { console.error(e) }
    finally { setLkWorking(false) }
  }

  const hasLocker = lockers.length > 0
  const fields = pattern === 'D2' ? ['A', 'IN', 'B'] : ['A', 'IN']

  // ── Meter column card ────────────────────────────
  function MeterCol({ field }) {
    const c = COL[field]
    const isActive = numpadField === field
    const isTouched = touched[field]
    const curVal = displayVal[field]
    const d = diff[field]
    const cost = field === 'A' ? parseInt(p?.outs?.[0]?.cost) || 0
      : field === 'B' ? parseInt(p?.outs?.[1]?.cost) || 0 : 0
    return (
      <div
        onClick={() => openNumpad(field)}
        style={{
          flex: 1, minWidth: 0,
          border: `1px solid ${isActive ? c.color + '90' : c.border}`,
          borderRadius: 12, padding: '10px 8px 8px',
          background: isActive ? c.bgActive : c.bg,
          cursor: 'pointer',
          boxShadow: isActive ? `0 0 0 1.5px ${c.color}40 inset` : 'none',
          transition: 'background .15s, border-color .15s',
        }}
      >
        {/* ラベル */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: c.color }}>{c.label}</span>
          {field !== 'IN' && cost > 0 && (
            <span style={{ fontSize: 9, color: '#475569' }}>@¥{cost}</span>
          )}
          {field === 'IN' && (
            <span style={{ fontSize: 9, color: '#475569' }}>投入合計</span>
          )}
        </div>

        {/* 値ボックス */}
        <div style={{
          background: 'rgba(2,6,23,.8)', border: `1px solid ${isActive ? c.color + '60' : '#1e293b'}`,
          borderRadius: 10, padding: '10px 6px',
          textAlign: 'center', minHeight: 52,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 22, fontWeight: 700, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
            color: isTouched ? '#f1f5f9' : '#475569',
          }}>
            {curVal != null ? fmtN(curVal) : '—'}
          </span>
        </div>

        {/* 差分行 */}
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: diffColor(d), fontVariantNumeric: 'tabular-nums' }}>
            {isTouched ? fmtD(d) : '±0'}
          </span>
          {field === 'IN' ? (
            <span style={{ fontSize: 9, color: '#475569' }}>
              {isTouched && d != null ? '入力済' : '—'}
            </span>
          ) : (
            <span style={{ fontSize: 9, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
              {d != null && d > 0 && cost > 0 ? `¥${(d * cost).toLocaleString()}` : ''}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── OCRボタン (INの真上中央) ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <button
          onClick={onCamera}
          style={{
            padding: '6px 18px', borderRadius: 20,
            background: 'rgba(217,119,6,.9)', border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>📷</span>
          <span>{pattern === 'D2' ? '3メーター 同時OCR' : '2メーター OCR'}</span>
        </button>
      </div>

      {/* ── 3メーター横並びグリッド ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {fields.map(f => <MeterCol key={f} field={f} />)}
      </div>

      {/* 据え置きヒント */}
      <p style={{ textAlign: 'center', fontSize: 10, color: '#334155', marginBottom: 8 }}>
        グレー数字は前回値。そのまま保存=据え置き
      </p>

      {/* ── 整合チェックバー ── */}
      <div style={{ marginBottom: 8 }}>
        <GachaCheckBar
          inDiff={calc?.inDiff ?? null}
          outs={p.outs.map((o, i) => ({ diff: calc?.outs?.[i]?.diff, cost: o.cost }))}
        />
      </div>

      {/* ── 景品カード ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: pattern === 'D2' ? '1fr 1fr' : '1fr',
        gap: 8, marginBottom: 8,
      }}>
        {/* A段 */}
        <PrizeCard
          label="A段景品"
          labelColor="#67e8f9"
          borderColor="rgba(8,145,178,.35)"
          prizeName={p?.outs?.[0]?.prize || ''}
          cost={p?.outs?.[0]?.cost || ''}
          zan={p?.outs?.[0]?.zan || ''}
          ho={p?.outs?.[0]?.ho === 'ー' ? '' : (p?.outs?.[0]?.ho || '')}
          onTapCard={() => { setPrizeModal(0); setPrizeSearch(''); setPrizeError(''); setNewPrizeMode(false); setNewPrizeName(''); setNewPrizeCost('') }}
          onCostChange={v => setPatrolOut(0, 'cost', v)}
          onZanChange={v => setPatrolZan(0, v)}
          onHoChange={v => setPatrolOut(0, 'ho', v)}
        />
        {/* B段 (D2のみ) */}
        {pattern === 'D2' && (
          <PrizeCard
            label="B段景品"
            labelColor="#c4b5fd"
            borderColor="rgba(124,58,237,.35)"
            prizeName={p?.outs?.[1]?.prize || ''}
            cost={p?.outs?.[1]?.cost || ''}
            zan={p?.outs?.[1]?.zan || ''}
            ho={p?.outs?.[1]?.ho === 'ー' ? '' : (p?.outs?.[1]?.ho || '')}
            onTapCard={() => { setPrizeModal(1); setPrizeSearch(''); setPrizeError(''); setNewPrizeMode(false); setNewPrizeName(''); setNewPrizeCost('') }}
            onCostChange={v => setPatrolOut(1, 'cost', v)}
            onZanChange={v => setPatrolZan(1, v)}
            onHoChange={v => setPatrolOut(1, 'ho', v)}
          />
        )}
      </div>

      {/* ── ロッカーセクション (デフォルト閉) ── */}
      {hasLocker && (
        <details style={{ marginBottom: 8, background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 8 }}>
          <summary style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', listStyle: 'none' }}>
            <span style={{ fontSize: 14 }}>🔐</span>
            <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>ロッカー</span>
            <span style={{ fontSize: 10, color: '#475569' }}>
              {lockers.map(l => `${l.posLabel || ''}:${l.slot_count || 5}段`).join(' / ')}
            </span>
            {lockerState.summary.empty > 0 && (
              <span style={{ fontSize: 10, color: '#f87171', marginLeft: 'auto' }}>空{lockerState.summary.empty}件</span>
            )}
            <span style={{ fontSize: 12, color: '#475569', marginLeft: lockerState.summary.empty > 0 ? 4 : 'auto' }}>▾</span>
          </summary>

          <div style={{ padding: '0 12px 12px' }}>
            {lockers.map((locker, li) => {
              const slots = lockerState.slotsByLocker?.[locker.locker_id] || []
              const sideLabel = lockers.length >= 2 ? (li === 0 ? 'A段' : 'B段') : ''
              const labelColor = li === 0 ? '#67e8f9' : '#c4b5fd'
              const gridCols = Math.min(Math.max(slots.length, 1), 5)
              return (
                <div key={locker.locker_id} style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: labelColor }}>
                      {sideLabel}ロッカー ({slots.length})
                    </span>
                    <span style={{ fontSize: 9, color: '#475569' }}>タップで個別編集</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 4 }}>
                    {slots.map(slot => {
                      const isFilled = slot.status === 'filled'
                      return (
                        <div
                          key={slot.slot_id}
                          onClick={() => openLockerModal(locker, slot, li)}
                          style={{
                            aspectRatio: '1', borderRadius: 8,
                            border: `1px solid ${isFilled ? 'rgba(16,185,129,.6)' : 'rgba(51,65,85,.5)'}`,
                            background: isFilled ? 'rgba(6,78,59,.25)' : 'rgba(15,23,42,.5)',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', padding: 2,
                            opacity: isFilled ? 1 : 0.6,
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{slot.slot_number}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.1, overflow: 'hidden', maxHeight: 18 }}>
                            {isFilled ? (slot.prize_name ? slot.prize_name.slice(0, 5) : '有') : '空'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 6, borderTop: '1px solid #1e293b', flexWrap: 'wrap' }}>
              {[['rgba(16,185,129,.6)', 'rgba(6,78,59,.25)', '在庫'], ['rgba(51,65,85,.5)', 'rgba(15,23,42,.5)', '空']].map(([bc, bg, lbl]) => (
                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#475569' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, border: `1px solid ${bc}`, background: bg, display: 'inline-block' }} />
                  {lbl}
                </span>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* ════ Numpad Bottom Sheet ════════════════════════ */}
      {numpadField && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)' }} onClick={closeNumpad} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#0f172a', borderTop: '1px solid #1e293b',
            borderRadius: '16px 16px 0 0',
            animation: 'giv3SlideUp .22s cubic-bezier(.16,1,.3,1)',
          }}>
            {/* ヘッダー: 入力中のメーター情報 */}
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COL[numpadField].color }}>
                    {COL[numpadField].label}
                  </span>
                  <span style={{ fontSize: 10, color: '#475569' }}>
                    前回 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(prevVal[numpadField])}</span>
                  </span>
                </div>
                <button onClick={closeNumpad} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer' }}>閉じる</button>
              </div>
              {/* 現在の入力値プレビュー */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: numpadInput ? '#e2e8f0' : '#475569',
                }}>
                  {numpadInput ? parseInt(numpadInput).toLocaleString('ja-JP') : fmtN(prevVal[numpadField])}
                </span>
                <span style={{ fontSize: 11, color: '#475569' }}>
                  差 <span style={{ color: diffColor(npDiff), fontVariantNumeric: 'tabular-nums' }}>{fmtD(npDiff)}</span>
                </span>
                {npRevenue > 0 && (
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
                    売上 <span style={{ color: '#34d399' }}>¥{npRevenue.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 他メーター状況サマリー */}
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid #1e293b',
              display: 'grid', gridTemplateColumns: fields.map(() => '1fr').join(' '), gap: 6,
            }}>
              {fields.map(f => (
                <div key={f} style={{
                  background: 'rgba(2,6,23,.7)',
                  border: `1px solid ${numpadField === f ? COL[f].color + '50' : '#1e293b'}`,
                  borderRadius: 6, padding: '4px 6px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: COL[f].color }}>
                    {f === 'A' ? 'A' : f === 'IN' ? 'IN' : 'B'}
                  </div>
                  <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: touched[f] ? '#f1f5f9' : '#475569' }}>
                    {fmtN(displayVal[f])}
                  </div>
                </div>
              ))}
            </div>

            {/* キーグリッド */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 12px 0' }}>
              {['1','2','3','4','5','6','7','8','9','carry','0','back'].map(key => (
                <button
                  key={key}
                  onPointerDown={() => numpadKey(key)}
                  style={{
                    height: 52, borderRadius: 10,
                    background: (key === 'carry' || key === 'back') ? '#0f172a' : '#1e293b',
                    border: `1px solid ${(key === 'carry' || key === 'back') ? '#2d3748' : '#334155'}`,
                    color: (key === 'carry' || key === 'back') ? '#94a3b8' : '#f1f5f9',
                    fontSize: key === 'carry' ? 11 : 22,
                    fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {key === 'back' ? '⌫' : key === 'carry' ? '据え置き' : key}
                </button>
              ))}
            </div>

            {/* 確定ボタン */}
            <div style={{ padding: '8px 12px 16px' }}>
              <button
                onPointerDown={confirmNumpad}
                style={{
                  width: '100%', height: 50, borderRadius: 10,
                  background: '#0891b2', border: '1px solid #0e7490',
                  color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                }}
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ 景品変更モーダル ════════════════════════════ */}
      {prizeModal != null && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.65)' }} onClick={() => { setPrizeModal(null); setPrizeSearch(''); setPrizeError(''); setNewPrizeMode(false) }} />
          <div
            style={{
              position: 'fixed', bottom: prizeModalBottom, left: 0, right: 0, zIndex: 50,
              maxHeight: prizeModalMaxH,
              background: '#0f172a', borderTop: '1px solid #1e293b',
              borderRadius: '16px 16px 0 0',
              display: 'flex', flexDirection: 'column',
              animation: 'giv3SlideUp .22s cubic-bezier(.16,1,.3,1)',
              transition: 'bottom .15s ease-out',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                {prizeModal === 0 ? 'A段' : 'B段'} 景品変更
              </span>
              <button onClick={() => { setPrizeModal(null); setPrizeSearch(''); setPrizeError(''); setNewPrizeMode(false) }} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer' }}>閉じる</button>
            </div>
            {prizeError && (
              <div style={{ padding: '6px 12px', background: 'rgba(127,29,29,.4)', borderBottom: '1px solid rgba(190,18,60,.5)', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#fca5a5' }}>{prizeError}</span>
              </div>
            )}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              <input
                autoFocus
                type="text"
                placeholder="景品名・カナで検索"
                value={prizeSearch}
                onChange={e => setPrizeSearch(e.target.value)}
                style={{ width: '100%', background: '#020617', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 12px' }}>
              {prizeWorking ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#67e8f9', fontSize: 13 }}>更新中...</div>
              ) : filteredPrizes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>該当なし</div>
              ) : (
                filteredPrizes.map((pr, i) => (
                  <button
                    key={i}
                    disabled={prizeWorking}
                    onClick={() => selectPrize(pr.prize_id, pr.prize_name, pr.original_cost, prizeModal)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'rgba(2,6,23,.6)', border: '1px solid #1e293b',
                      borderRadius: 6, padding: '8px 10px', marginBottom: 4,
                      cursor: 'pointer', color: '#f1f5f9', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{pr.prize_name}</span>
                    {pr.original_cost && <span style={{ fontSize: 11, color: '#475569' }}>@¥{pr.original_cost}</span>}
                  </button>
                ))
              )}
            </div>

            {/* フッター: 新規追加 */}
            <div style={{ flexShrink: 0, borderTop: '1px solid #1e293b', padding: '8px 12px' }}>
              {!newPrizeMode ? (
                <button
                  onClick={() => { setNewPrizeMode(true); setNewPrizeName(prizeSearch); setNewPrizeCost('') }}
                  style={{ width: '100%', padding: '9px', borderRadius: 8, background: 'rgba(2,6,23,.6)', border: '1px dashed #334155', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
                >
                  + マスタに新規追加
                </button>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      autoFocus
                      type="text" placeholder="景品名(必須)" value={newPrizeName}
                      onChange={e => setNewPrizeName(e.target.value)}
                      style={{ flex: 1, background: '#020617', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#f1f5f9', outline: 'none' }}
                    />
                    <input
                      type="number" placeholder="原価" value={newPrizeCost}
                      onChange={e => setNewPrizeCost(e.target.value)}
                      style={{ width: 70, background: '#020617', border: '1px solid #334155', borderRadius: 6, padding: '7px 8px', fontSize: 13, color: '#f1f5f9', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setNewPrizeMode(false)} style={{ flex: 1, padding: '8px', borderRadius: 7, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>キャンセル</button>
                    <button
                      disabled={!newPrizeName.trim() || newPrizeAdding}
                      onClick={async () => {
                        if (!newPrizeName.trim()) return
                        setNewPrizeAdding(true)
                        const id = crypto.randomUUID()
                        const { error } = await supabase.from('prize_masters').insert({
                          prize_id: id,
                          prize_name: newPrizeName.trim(),
                          original_cost: parseInt(newPrizeCost) || 0,
                          status: 'provisional',
                          organization_id: DFX_ORG_ID,
                        })
                        setNewPrizeAdding(false)
                        if (error) { setPrizeError('追加失敗: ' + error.message); setNewPrizeMode(false); return }
                        setPrizeList(list => [...list, { prize_id: id, prize_name: newPrizeName.trim(), original_cost: parseInt(newPrizeCost) || 0 }])
                        await selectPrize(id, newPrizeName.trim(), parseInt(newPrizeCost) || 0, prizeModal)
                        setNewPrizeMode(false)
                      }}
                      style={{ flex: 2, padding: '8px', borderRadius: 7, background: '#0891b2', border: '1px solid #0e7490', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newPrizeName.trim() || newPrizeAdding ? 0.5 : 1 }}
                    >
                      {newPrizeAdding ? '追加中...' : '追加して選択'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════ ロッカー個別編集モーダル ════════════════════ */}
      {lockerModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.65)' }} onClick={closeLockerModal} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#0f172a', borderTop: '1px solid #1e293b',
            borderRadius: '16px 16px 0 0',
            animation: 'giv3SlideUp .22s cubic-bezier(.16,1,.3,1)',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                ロッカー {lockers.length >= 2 ? (lockerModal.lockerIdx === 0 ? 'A' : 'B') : ''}-{lockerModal.slot.slot_number}
              </span>
              <button onClick={closeLockerModal} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer' }}>閉じる</button>
            </div>

            {!lockerSub ? (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button disabled={lkWorking} onClick={() => handleLockerAction('sell')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(159,18,57,.4)', border: '1px solid rgba(190,24,93,.6)', color: '#fda4af', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  完売にする
                </button>
                <button disabled={lkWorking} onClick={() => handleLockerAction('empty')} style={{ padding: '12px 16px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                  空にする
                </button>
                <button disabled={lkWorking} onClick={() => handleLockerAction('restock')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(120,53,15,.4)', border: '1px solid rgba(180,83,9,.6)', color: '#fdba74', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                  補充する
                </button>
                <button disabled={lkWorking} onClick={() => handleLockerAction('replace')} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(8,47,73,.4)', border: '1px solid rgba(14,116,144,.6)', color: '#67e8f9', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                  景品を入替える
                </button>
              </div>
            ) : (
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                  {lockerSub === 'restock' ? '補充する景品' : '入替後の景品'}
                </div>
                {/* 景品名検索 */}
                <input
                  autoFocus
                  type="text"
                  placeholder="景品名で検索..."
                  value={lkPrizeSearch}
                  onChange={e => setLkPrizeSearch(e.target.value)}
                  style={{ width: '100%', background: '#020617', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f1f5f9', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
                />
                {lkPrizeSearch && filteredLkPrizes.length > 0 && (
                  <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 8, border: '1px solid #1e293b', borderRadius: 6 }}>
                    {filteredLkPrizes.slice(0, 8).map((pr, i) => (
                      <button key={i} onClick={() => { setLkPrizeName(pr.prize_name); setLkPriceVal(String(pr.original_cost || '')); setLkPrizeSearch('') }}
                        style={{ width: '100%', textAlign: 'left', background: 'rgba(2,6,23,.6)', border: 'none', borderBottom: '1px solid #1e293b', padding: '6px 10px', cursor: 'pointer', color: '#f1f5f9', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{pr.prize_name}</span>
                        {pr.original_cost ? <span style={{ color: '#475569' }}>¥{pr.original_cost}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                {/* 確定入力フォーム */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input type="text" placeholder="景品名" value={lkPrizeName} onChange={e => setLkPrizeName(e.target.value)}
                    style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#f1f5f9', outline: 'none' }} />
                  <input type="number" placeholder="価値(円)" value={lkPriceVal} onChange={e => setLkPriceVal(e.target.value)}
                    style={{ width: 80, background: '#020617', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 8px', fontSize: 13, color: '#f1f5f9', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setLockerSub(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                    戻る
                  </button>
                  <button
                    disabled={!lkPrizeName.trim() || lkWorking}
                    onClick={confirmLockerPrize}
                    style={{ flex: 2, padding: '10px', borderRadius: 8, background: '#0891b2', border: '1px solid #0e7490', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: !lkPrizeName.trim() || lkWorking ? 0.5 : 1 }}
                  >
                    {lkWorking ? '処理中...' : '確定'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes giv3SlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </>
  )
}

// ── 景品カード (分離して再レンダリングを抑制) ─────────────
function PrizeCard({ label, labelColor, borderColor, prizeName, cost, zan, ho, onTapCard, onCostChange, onZanChange, onHoChange }) {
  return (
    <div
      onClick={onTapCard}
      style={{ background: 'rgba(15,23,42,.6)', border: `1px solid ${borderColor}`, borderRadius: 10, padding: 10, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: labelColor }}>{label}</span>
        <span style={{ fontSize: 9, color: '#475569' }}>変更 ›</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 8, minHeight: 20 }}>
        {prizeName || '（未設定）'}
      </div>
      {/* 単価・残・補 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#475569' }}>@¥</span>
        <input
          type="number" value={cost} placeholder="単価"
          onChange={e => onCostChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          style={{ width: 52, background: '#020617', border: '1px solid #1e293b', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#f1f5f9', textAlign: 'right', outline: 'none' }}
        />
        <span style={{ fontSize: 10, color: '#475569' }}>残</span>
        <input
          type="number" value={zan} placeholder="0"
          onChange={e => onZanChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          style={{ width: 36, background: '#020617', border: '1px solid #1e293b', borderRadius: 4, padding: '2px 4px', fontSize: 11, color: '#f1f5f9', textAlign: 'center', outline: 'none' }}
        />
        <span style={{ fontSize: 10, color: '#475569' }}>補</span>
        <input
          type="number" value={ho} placeholder="0"
          onChange={e => onHoChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          style={{ width: 36, background: '#020617', border: '1px solid #1e293b', borderRadius: 4, padding: '2px 4px', fontSize: 11, color: '#f1f5f9', textAlign: 'center', outline: 'none' }}
        />
      </div>
    </div>
  )
}
