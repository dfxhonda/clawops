import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getLastReading, saveBoothReading } from '../../services/patrol'
import { parseNum } from '../../services/utils'
import PrizeSearchModal from '../components/PrizeSearchModal'
import LockerInput from '../components/LockerInput'

export default function BoothInput() {
  const navigate = useNavigate()
  const location = useLocation()
  const { staffId } = useAuth()

  const { booth, machine, storeCode, storeName, lockers = [], isGacha = false } = location.state || {}

  // Guard: no state → back to overview
  useEffect(() => {
    if (!location.state) {
      navigate('/patrol/overview', { replace: true })
    }
  }, [location.state, navigate])

  // ── State ──────────────────────────────────────────────
  const [lastReading, setLastReading] = useState(null)
  const [inMeter, setInMeter] = useState('')
  const [outMeter, setOutMeter] = useState('')
  const [multiOut, setMultiOut] = useState([])
  const [prizeName, setPrizeName] = useState('')
  const [prizeStock, setPrizeStock] = useState('')
  const [prizeRestock, setPrizeRestock] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showLocker, setShowLocker] = useState(false)
  const [showPrizeSearch, setShowPrizeSearch] = useState(false)

  // ── Load last reading ───────────────────────────────────
  useEffect(() => {
    if (!booth?.booth_code) return
    getLastReading(booth.booth_code).then(r => {
      setLastReading(r)
      if (r?.prize_name) setPrizeName(r.prize_name)
    })
  }, [booth?.booth_code])

  // ── Initialize multiOut array ───────────────────────────
  useEffect(() => {
    if (booth?.meter_out_number > 1) {
      setMultiOut(Array(booth.meter_out_number - 1).fill(''))
    }
  }, [booth?.meter_out_number])

  // ── Diff calculation ────────────────────────────────────
  const lastIn = lastReading ? parseNum(String(lastReading.in_meter)) : null
  const lastOut = lastReading ? parseNum(String(lastReading.out_meter)) : null
  const inVal = inMeter ? parseNum(inMeter) : null
  const outVal = outMeter ? parseNum(outMeter) : null
  const inDiff = inVal !== null && lastIn !== null ? inVal - lastIn : null
  const outDiff = outVal !== null && lastOut !== null ? outVal - lastOut : null

  // ── Multi-OUT sum ────────────────────────────────────────
  const multiOutSum = booth?.meter_out_number > 1
    ? multiOut.reduce((s, v) => s + (parseNum(v) || 0), 0) + (parseNum(outMeter) || 0)
    : null

  // ── Save handler ────────────────────────────────────────
  async function handleSave() {
    if (!inMeter) {
      setSaveError('INメーターを入力してください')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      let effectiveOut = outMeter
      if (booth?.meter_out_number > 1) {
        effectiveOut = String(multiOutSum)
      }
      await saveBoothReading({
        boothCode: booth.booth_code,
        inMeter,
        outMeter: effectiveOut,
        prizeName: isGacha ? '' : prizeName,
        prizeRestock: prizeRestock || '0',
        prizeStock: isGacha ? '0' : prizeStock,
        note,
        createdBy: staffId || null,
        source: 'manual',
      })
      setSaved(true)
      if (isGacha && lockers.length > 0) {
        setShowLocker(true)
      } else {
        setTimeout(() => navigate(-1), 500)
      }
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Early return if no state ─────────────────────────────
  if (!location.state) return null

  // ── Input base styles ────────────────────────────────────
  const inputCls = 'w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent transition-colors'

  return (
    <div className="h-dvh flex flex-col max-w-lg mx-auto">
      {/* ── Header ── */}
      <div className="shrink-0 bg-bg border-b border-border px-4 py-3 flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#ec4899' }}>
        <button
          onClick={() => navigate('/patrol/overview')}
          className="text-xl text-muted hover:text-accent transition-colors"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text truncate">
            {machine?.machine_name || '機械'}
          </h1>
          <p className="text-[11px] text-muted font-mono truncate">{booth?.booth_code}</p>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full
          ${isGacha
            ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
            : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'}`}>
          {isGacha ? 'ガチャ' : 'クレーン'}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Previous reading card */}
        {lastReading && (
          <div className="bg-surface border border-border rounded-xl px-3 py-2 flex items-center gap-3 text-sm">
            <span className="text-muted text-xs shrink-0">前回</span>
            <span className="text-text font-mono">
              IN <span className="text-accent font-bold">{parseNum(String(lastReading.in_meter)).toLocaleString()}</span>
              {' '}OUT <span className="text-accent font-bold">{parseNum(String(lastReading.out_meter)).toLocaleString()}</span>
            </span>
            <span className="text-muted text-xs ml-auto shrink-0">
              {lastReading.read_date || lastReading.created_at?.slice(0, 10) || ''}
            </span>
          </div>
        )}

        {/* ── Meter input ── */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-muted mb-1">メーター入力</div>

          {/* IN meter */}
          <div>
            <label className="block text-sm text-muted mb-1">INメーター</label>
            <input
              type="number" inputMode="numeric"
              value={inMeter}
              onChange={e => setInMeter(e.target.value)}
              className={inputCls}
              placeholder={lastIn !== null ? String(lastIn) : '売上メーター値'}
            />
            {inDiff !== null && (
              <p className={`text-xs font-bold mt-1 text-right
                ${inDiff < 0 ? 'text-accent2' : 'text-accent'}`}>
                {inDiff >= 0 ? '+' : ''}{inDiff.toLocaleString()}
              </p>
            )}
          </div>

          {/* OUT meter — single */}
          {(!booth?.meter_out_number || booth.meter_out_number <= 1) && (
            <div>
              <label className="block text-sm text-muted mb-1">OUTメーター</label>
              <input
                type="number" inputMode="numeric"
                value={outMeter}
                onChange={e => setOutMeter(e.target.value)}
                className={inputCls}
                placeholder={lastOut !== null ? String(lastOut) : '払出メーター値'}
              />
              {outDiff !== null && (
                <p className={`text-xs font-bold mt-1 text-right
                  ${outDiff < 0 ? 'text-accent2' : 'text-accent'}`}>
                  {outDiff >= 0 ? '+' : ''}{outDiff.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* OUT meters — multiple */}
          {booth?.meter_out_number > 1 && (
            <>
              <div>
                <label className="block text-sm text-muted mb-1">OUTメーター①</label>
                <input
                  type="number" inputMode="numeric"
                  value={outMeter}
                  onChange={e => setOutMeter(e.target.value)}
                  className={inputCls}
                  placeholder="払出メーター①"
                />
              </div>
              {multiOut.map((val, i) => (
                <div key={i}>
                  <label className="block text-sm text-muted mb-1">
                    OUTメーター{['②', '③', '④', '⑤'][i] || `(${i + 2})`}
                  </label>
                  <input
                    type="number" inputMode="numeric"
                    value={val}
                    onChange={e => setMultiOut(prev => {
                      const next = [...prev]
                      next[i] = e.target.value
                      return next
                    })}
                    className={inputCls}
                    placeholder={`払出メーター${i + 2}`}
                  />
                </div>
              ))}
              <div className="flex justify-end text-sm text-muted">
                合計: <span className="font-bold text-text ml-1">{multiOutSum.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* ── Crane-only fields ── */}
        {!isGacha && (
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-muted mb-1">景品情報</div>

            {/* 景品名 */}
            <div>
              <label className="block text-sm text-muted mb-1">景品名</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prizeName}
                  onChange={e => setPrizeName(e.target.value)}
                  className={`${inputCls} flex-1`}
                  placeholder="景品名を入力"
                />
                <button
                  onClick={() => setShowPrizeSearch(true)}
                  className="shrink-0 text-lg text-muted hover:text-accent active:scale-90 transition-all px-1"
                >
                  🔍
                </button>
              </div>
            </div>

            {/* 残数・補充数 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm text-muted mb-1">景品残数</label>
                <input
                  type="number" inputMode="numeric"
                  value={prizeStock}
                  onChange={e => setPrizeStock(e.target.value)}
                  className={`${inputCls} text-center`}
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-muted mb-1">補充数</label>
                <input
                  type="number" inputMode="numeric"
                  value={prizeRestock}
                  onChange={e => setPrizeRestock(e.target.value)}
                  className={`${inputCls} text-center`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Gacha-only fields ── */}
        {isGacha && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted mb-3">カプセル補充</div>
            <div>
              <label className="block text-sm text-muted mb-1">カプセル補充数</label>
              <input
                type="number" inputMode="numeric"
                value={prizeRestock}
                onChange={e => setPrizeRestock(e.target.value)}
                className={`${inputCls} text-center`}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {/* ── Common: memo ── */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <label className="block text-sm text-muted mb-1">メモ</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={inputCls}
            placeholder="メモ（任意）"
          />
        </div>

        {/* ── Error message ── */}
        {saveError && (
          <p className="text-accent2 text-sm text-center px-2">{saveError}</p>
        )}

        {/* ── Save confirmation banner ── */}
        {saved && (
          <div className="bg-green-600/20 border border-green-600/40 rounded-xl px-4 py-3 text-center text-green-400 font-semibold text-sm">
            保存しました
          </div>
        )}

        {/* ── Save button ── */}
        {!saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        )}

        {/* ── LockerInput (shown after gacha save) ── */}
        {showLocker && (
          <LockerInput
            lockers={lockers}
            machineCode={machine?.machine_code}
            storeCode={storeCode}
            staffId={staffId}
            onDone={() => navigate(-1)}
          />
        )}
      </div>

      {/* ── PrizeSearchModal ── */}
      {showPrizeSearch && (
        <PrizeSearchModal
          onSelect={p => {
            setPrizeName(p.name || p.prize_name || '')
            setShowPrizeSearch(false)
          }}
          onClose={() => setShowPrizeSearch(false)}
        />
      )}
    </div>
  )
}
