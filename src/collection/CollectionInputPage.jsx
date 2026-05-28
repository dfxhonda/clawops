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

// J-COLLECTION-02: 集金入力画面 (J-COLLECTION-01全面置換)
// 集金日 / 前回集金日 / 店舗 を選んで読込 → ブース行で
//   IN(前→今→差) / OUT(前→今→差) / 集金額(金種ドロワー) / 立替額(直入力)
// を編集 → 確定(status=confirmed, ロック) → PDF出力。
// 担当者はログインユーザー固定。collected_by=staffId / 表示=staffName。

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
    in_meter_prev: null,
    out_meter_prev: null,
    in_meter_current: b.in_meter_current_default != null ? String(b.in_meter_current_default) : '',
    out_meter_current: b.out_meter_current_default != null ? String(b.out_meter_current_default) : '',
    advance_payment: '',
    counts: {},
  }
}

export default function CollectionInputPage() {
  const navigate = useNavigate()
  const { staffId, staffName } = useAuth()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [collectedAt, setCollectedAt] = useState(todayJst())
  const [prevDate, setPrevDate] = useState('') // 任意
  const [booths, setBooths] = useState([])
  const [rowData, setRowData] = useState({}) // {booth_code: {...}}
  const [activeBooth, setActiveBooth] = useState(null) // 金種ドロワー対象
  const [currentField, setCurrentField] = useState(null) // iPhoneカスタムテンキー
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

    // 前回集金日が指定されていれば prev_meter を適用
    if (prevDate) {
      const { data: prevMap, error: e2 } = await getPrevCollectionMeters(storeCode, prevDate)
      if (e2) { setError(`ERR-COLLECTION-004: ${e2.message}`); setLoading(false); return }
      for (const b of data ?? []) {
        const p = prevMap?.[b.booth_code]
        if (p) {
          rd[b.booth_code] = {
            ...rd[b.booth_code],
            in_meter_prev: p.in_meter_prev,
            out_meter_prev: p.out_meter_prev,
          }
        }
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
    const { data, error: e } = await saveCollection({
      storeCode, collectedAt, prevCollectionDate: prevDate || null,
      collectedBy: staffId || null, collectedByName: staffName || null,
      booths, rowData,
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
      {/* header: 戻る + ステップ1〜3 */}
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

      {/* ブース一覧 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {!loaded && !loading && <p className="text-center text-muted text-base py-8">店舗を選んで読み込んでください</p>}
        {loaded && booths.length === 0 && <p className="text-center text-muted text-base py-8">アクティブブースがありません</p>}
        <div className="space-y-2">
          {loaded && booths.map((b, idx) => {
            const r = rowData[b.booth_code] || emptyRow(b)
            const inD = diff(r.in_meter_current, r.in_meter_prev)
            const outD = diff(r.out_meter_current, r.out_meter_prev)
            const sub = boothTotal(r.counts)
            const tabBase = idx * 3 + 1
            return (
              <div key={b.booth_code} data-testid="collection-booth-row" className="rounded-xl border border-border bg-surface p-3 space-y-2">
                {/* 1行: レンタル + 機械名 + ブース */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs font-mono text-muted px-1.5 py-0.5 rounded bg-bg border border-border">{b.rental_code}</span>
                  <span className="text-base font-bold text-text flex-1 truncate">{b.machine_name}</span>
                  <span className="text-base text-muted">{b.booth_name}</span>
                </div>

                {/* 2行: メーター IN/OUT (prev → current → diff) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted w-6">IN</span>
                    <span className="text-xs text-muted tabular-nums w-16 text-right" title="前回">{r.in_meter_prev != null ? yen(r.in_meter_prev) : '—'}</span>
                    <span className="text-xs text-muted">→</span>
                    <NumpadField
                      value={r.in_meter_current}
                      onChange={v => setRow(b.booth_code, { in_meter_current: v })}
                      label={`IN ${b.booth_name}`}
                      max={9999999}
                      dataTabindex={tabBase}
                      testId={`booth-in-${b.booth_code}`}
                      onRegister={setCurrentField}
                      style={{ flex: 1, minWidth: 0, fontSize: 14 }}
                    />
                    <span className={`text-xs tabular-nums w-12 text-right ${inD == null ? 'text-muted' : inD < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {inD == null ? '—' : (inD >= 0 ? '+' : '') + inD}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted w-6">OUT</span>
                    <span className="text-xs text-muted tabular-nums w-16 text-right" title="前回">{r.out_meter_prev != null ? yen(r.out_meter_prev) : '—'}</span>
                    <span className="text-xs text-muted">→</span>
                    <NumpadField
                      value={r.out_meter_current}
                      onChange={v => setRow(b.booth_code, { out_meter_current: v })}
                      label={`OUT ${b.booth_name}`}
                      max={9999999}
                      dataTabindex={tabBase + 1}
                      testId={`booth-out-${b.booth_code}`}
                      onRegister={setCurrentField}
                      style={{ flex: 1, minWidth: 0, fontSize: 14 }}
                    />
                    <span className={`text-xs tabular-nums w-12 text-right ${outD == null ? 'text-muted' : outD < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {outD == null ? '—' : (outD >= 0 ? '+' : '') + outD}
                    </span>
                  </div>
                </div>

                {/* 3行: 集金額 (タップ→金種ドロワー) + 立替額 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid={`booth-amount-${b.booth_code}`}
                    onClick={() => !locked && setActiveBooth(b)}
                    disabled={locked}
                    className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 min-h-[44px] text-left disabled:opacity-60"
                  >
                    <span className="text-xs text-muted">集金額</span>
                    <span className="flex-1 text-right text-base font-bold tabular-nums text-text">{yen(sub)} 円</span>
                    {!locked && <span className="text-muted">›</span>}
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted">立替</span>
                    <NumpadField
                      value={r.advance_payment}
                      onChange={v => setRow(b.booth_code, { advance_payment: v })}
                      label={`立替 ${b.booth_name}`}
                      max={9999999}
                      dataTabindex={tabBase + 2}
                      testId={`booth-advance-${b.booth_code}`}
                      onRegister={setCurrentField}
                      style={{ flex: 1, minWidth: 0, fontSize: 14 }}
                    />
                    <span className="text-xs text-muted">円</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* footer: 合計 + 確定 + PDF */}
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
