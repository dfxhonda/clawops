import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NumpadField, { NumpadFooterPanel } from '../clawsupport/components/NumpadField'
import {
  getActiveStores, getActiveBoothsForStore, getPrevCollectionMeters,
  saveCollection, getCollectionDetail,
} from '../services/collections'
import { boothTotal } from './lib/collectionCalc'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import DenominationDrawer from './components/DenominationDrawer'

// J-COLLECTION-03: ブース行を1行テーブル(横スクロール)に全面置換
// 列: レンタルコード/機械名/ブース/前回IN/今回IN/差/集金額/立替/備考
// 集金額タップ -> DenominationDrawer(不変)、確定後ロック、担当はログインユーザー固定。

const yen = n => Number(n || 0).toLocaleString()
const todayJst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
const numOrNull = v => (v === '' || v == null ? null : Number(v))
const diff = (cur, prev) => {
  const c = numOrNull(cur), p = numOrNull(prev)
  if (c == null || p == null) return null
  return c - p
}

function emptyRow(b) {
  return {
    in_meter_prev: '',
    in_meter_current: b.in_meter_current_default != null ? String(b.in_meter_current_default) : '',
    advance_payment: '',
    notes: '',
    counts: {},
  }
}

// テーブル列幅 (spec table_layout.columns 準拠)。合計≈748px → 390px幅で横スクロール。
const COLS = [
  { key: 'rental_code',      label: 'レンタル', w: 72 },
  { key: 'machine_name',     label: '機械名',   w: 120 },
  { key: 'booth_name',       label: 'ブース',   w: 56 },
  { key: 'in_meter_prev',    label: '前回IN',   w: 90 },
  { key: 'in_meter_current', label: '今回IN',   w: 90 },
  { key: 'in_diff',          label: '差',       w: 64 },
  { key: 'collection_amount', label: '集金額',  w: 96 },
  { key: 'advance_payment',  label: '立替',     w: 72 },
  { key: 'notes',            label: '備考',     w: 120 },
]
const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.w, 0)

const cellInputStyle = { width: '100%', height: '36px', fontSize: 12, padding: '0 4px', textAlign: 'right' }
const cellTextInputCls = 'w-full bg-bg border border-border rounded px-2 text-xs text-text outline-none focus:border-blue-500'

export default function CollectionInputPage() {
  const navigate = useNavigate()
  const { staffId, staffName } = useAuth()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [collectedAt, setCollectedAt] = useState(todayJst())
  const [prevDate, setPrevDate] = useState('')
  const [booths, setBooths] = useState([])
  const [rowData, setRowData] = useState({})
  const [activeBooth, setActiveBooth] = useState(null)
  const [currentField, setCurrentField] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmedId, setConfirmedId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getActiveStores().then(({ data, error: e }) => {
      if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); return }
      setStores(data ?? [])
    })
  }, [])

  async function handleLoad() {
    if (!storeCode) return
    setLoading(true); setError(null); setLoaded(false); setConfirmedId(null)
    const { data, error: e } = await getActiveBoothsForStore(storeCode)
    if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); setLoading(false); return }
    let rd = Object.fromEntries((data ?? []).map(b => [b.booth_code, emptyRow(b)]))
    if (prevDate) {
      const { data: prevMap, error: e2 } = await getPrevCollectionMeters(storeCode, prevDate)
      if (e2) { setError(`ERR-COLLECTION-004: ${e2.message}`); setLoading(false); return }
      for (const b of data ?? []) {
        const p = prevMap?.[b.booth_code]
        if (p && p.in_meter_prev != null) rd[b.booth_code].in_meter_prev = String(p.in_meter_prev)
      }
    }
    setBooths(data ?? [])
    setRowData(rd)
    setLoaded(true); setLoading(false)
  }

  const setRow = (boothCode, patch) =>
    setRowData(prev => ({ ...prev, [boothCode]: { ...prev[boothCode], ...patch } }))

  const collectionTotal = useMemo(
    () => booths.reduce((s, b) => s + boothTotal(rowData[b.booth_code]?.counts), 0),
    [booths, rowData]
  )
  const advanceTotal = useMemo(
    () => booths.reduce((s, b) => s + (Number(rowData[b.booth_code]?.advance_payment) || 0), 0),
    [booths, rowData]
  )

  async function confirm() {
    setSaving(true); setError(null)
    // saveCollection の rowData は in_meter_prev / in_meter_current / advance / notes / counts
    // (out_meter_* は J-COLLECTION-03 ではUI非対象、null保存)
    const payload = Object.fromEntries(booths.map(b => {
      const r = rowData[b.booth_code] || {}
      return [b.booth_code, {
        in_meter_prev: numOrNull(r.in_meter_prev),
        in_meter_current: r.in_meter_current,
        out_meter_prev: null,
        out_meter_current: null,
        advance_payment: r.advance_payment,
        notes: r.notes,
        counts: r.counts || {},
      }]
    }))
    const { data, error: e } = await saveCollection({
      storeCode, collectedAt, prevCollectionDate: prevDate || null,
      collectedBy: staffId || null, collectedByName: staffName || null,
      booths, rowData: payload,
    })
    if (e) { setError(`ERR-COLLECTION-002: ${e.message}`); setSaving(false); return }
    setConfirmedId(data.collectionId); setSaving(false)
  }

  async function outputPdf() {
    setError(null)
    try {
      const { data, error: e } = await getCollectionDetail(confirmedId)
      if (e) throw e
      await ensureJpFont()
      const doc = buildCollectionSlip({ ...data, collectedByName: staffName })
      doc.save(slipFileName(confirmedId))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    }
  }

  const locked = !!confirmedId

  return (
    <div data-testid="collection-input" className="flex flex-col" style={{ height: '100dvh' }}>
      {/* header */}
      <div className="flex-shrink-0 p-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/launcher')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1">← 戻る</button>
          <button onClick={() => navigate('/collection/history')} className="text-sm text-blue-400 min-h-[44px]">履歴</button>
        </div>
        <h1 className="text-base font-bold text-text mb-1">集金入力</h1>
        <div className="text-xs text-muted mb-2">担当: {staffName || '(未ログイン)'}</div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">集金日</span>
            <input data-testid="collection-date" type="date" value={collectedAt} disabled={locked}
              onChange={e => setCollectedAt(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">前回集金日 (任意)</span>
            <input data-testid="collection-prev-date" type="date" value={prevDate} disabled={locked}
              onChange={e => setPrevDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">店舗</span>
            <select data-testid="collection-store-select" value={storeCode} disabled={locked}
              onChange={e => setStoreCode(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50">
              <option value="">店舗を選択</option>
              {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
            </select>
          </label>
          <button data-testid="collection-load-button" onClick={handleLoad} disabled={!storeCode || loading || locked}
            className="px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {loading ? '読込中…' : '読み込む'}
          </button>
        </div>
      </div>

      {error && <p data-testid="collection-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      {/* booth table (横スクロール) */}
      <div className="flex-1 overflow-auto min-h-0">
        {!loaded && !loading && <p className="text-center text-muted text-base py-8">店舗を選んで読み込んでください</p>}
        {loaded && booths.length === 0 && <p className="text-center text-muted text-base py-8">アクティブブースがありません</p>}
        {loaded && booths.length > 0 && (
          <table data-testid="collection-table" className="text-xs" style={{ minWidth: TABLE_MIN_WIDTH, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border text-muted">
                {COLS.map(c => (
                  <th key={c.key} className="px-1 py-1 text-left font-normal" style={{ width: c.w, minWidth: c.w }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {booths.map((b, idx) => {
                const r = rowData[b.booth_code] || emptyRow(b)
                const inD = diff(r.in_meter_current, r.in_meter_prev)
                const sub = boothTotal(r.counts)
                const tabBase = idx * 4 + 1
                return (
                  <tr key={b.booth_code} data-testid="collection-booth-row" className="border-b border-border/40" style={{ height: 44 }}>
                    <td className="px-1 py-1 font-mono text-text">{b.rental_code}</td>
                    <td className="px-1 py-1 text-text truncate" style={{ maxWidth: 120 }} title={b.machine_name}>{b.machine_name}</td>
                    <td className="px-1 py-1 text-text">{b.booth_name}</td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.in_meter_prev} onChange={v => setRow(b.booth_code, { in_meter_prev: v })}
                        label={`前回IN ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase} testId={`booth-in-prev-${b.booth_code}`}
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.in_meter_current} onChange={v => setRow(b.booth_code, { in_meter_current: v })}
                        label={`今回IN ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase + 1} testId={`booth-in-cur-${b.booth_code}`}
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td data-testid={`booth-in-diff-${b.booth_code}`}
                      className={`px-1 py-1 text-right tabular-nums ${inD == null ? 'text-muted' : inD < 0 ? 'text-red-600' : 'text-text'}`}>
                      {inD == null ? '—' : (inD >= 0 ? '+' : '') + inD}
                    </td>
                    <td className="px-1 py-1">
                      <button data-testid={`booth-amount-${b.booth_code}`} onClick={() => !locked && setActiveBooth(b)} disabled={locked}
                        className="w-full text-right tabular-nums bg-bg border border-border rounded px-2 h-9 text-xs text-text disabled:opacity-60">
                        {yen(sub)}円
                      </button>
                    </td>
                    <td className="px-1 py-1">
                      <NumpadField value={r.advance_payment} onChange={v => setRow(b.booth_code, { advance_payment: v })}
                        label={`立替 ${b.booth_name}`} max={9999999}
                        dataTabindex={tabBase + 2} testId={`booth-advance-${b.booth_code}`}
                        onRegister={setCurrentField} style={cellInputStyle} />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        data-testid={`booth-notes-${b.booth_code}`} type="text" value={r.notes || ''}
                        onChange={e => setRow(b.booth_code, { notes: e.target.value })}
                        disabled={locked}
                        className={cellTextInputCls + ' h-9 disabled:opacity-60'}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* footer */}
      {loaded && booths.length > 0 && (
        <div className="flex-shrink-0 border-t border-border p-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-muted">合計金額 <span className="ml-2">立替(参考) {yen(advanceTotal)} 円</span></div>
            <div data-testid="collection-total" className="text-2xl font-bold text-text tabular-nums">{yen(collectionTotal)} 円</div>
          </div>
          {!locked ? (
            <button data-testid="collection-confirm-button" onClick={confirm} disabled={saving}
              className="px-5 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50">
              {saving ? '保存中…' : '確定'}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span data-testid="collection-confirmed-badge" className="text-xs text-green-400 font-bold">確定済 {confirmedId}</span>
              <button data-testid="collection-pdf-button" onClick={outputPdf}
                className="px-5 min-h-[48px] rounded-xl bg-emerald-600 text-white text-base font-bold">PDF出力</button>
            </div>
          )}
        </div>
      )}

      {/* iPhone 用 カスタムテンキー footer (iPhone以外では null 自動) */}
      <div className="flex-shrink-0">
        <NumpadFooterPanel currentField={currentField} />
      </div>

      {activeBooth && (
        <DenominationDrawer
          booth={activeBooth}
          counts={rowData[activeBooth.booth_code]?.counts}
          onChange={c => setRow(activeBooth.booth_code, { counts: c })}
          onClose={() => setActiveBooth(null)}
        />
      )}
    </div>
  )
}
