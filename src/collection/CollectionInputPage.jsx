import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getCollectibleStores, getCollectibleBooths, saveCollection, getCollectionDetail } from '../services/collections'
import { grandTotal, boothTotal } from './lib/collectionCalc'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import DenominationDrawer from './components/DenominationDrawer'

// J-COLLECTION-01: 集金入力画面 (/collection/input)
const yen = n => Number(n || 0).toLocaleString()
const todayJst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

export default function CollectionInputPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()

  const [stores, setStores] = useState([])
  const [staffList, setStaffList] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [collectedAt, setCollectedAt] = useState(todayJst())
  const [collectedBy, setCollectedBy] = useState('')
  const [booths, setBooths] = useState([])
  const [counts, setCounts] = useState({})       // {booth_code: {bill_10000:..}}
  const [activeBooth, setActiveBooth] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmedId, setConfirmedId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCollectibleStores().then(({ data, error: e }) => {
      if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); return }
      setStores(data ?? [])
    })
    supabase.from('staff').select('staff_id, name').order('name')
      .then(({ data }) => setStaffList(data ?? []))
  }, [])

  async function load() {
    if (!storeCode) return
    setLoading(true); setError(null); setLoaded(false); setConfirmedId(null)
    const { data, error: e } = await getCollectibleBooths(storeCode)
    if (e) { setError(`ERR-COLLECTION-001: ${e.message}`); setLoading(false); return }
    setBooths(data ?? [])
    setCounts({})
    setLoaded(true); setLoading(false)
  }

  const total = useMemo(
    () => grandTotal(booths.map(b => counts[b.booth_code] || {})),
    [booths, counts]
  )

  async function confirm() {
    setSaving(true); setError(null)
    const { data, error: e } = await saveCollection({
      storeCode, collectedAt, collectedBy, booths, counts, staffName,
    })
    if (e) { setError(`ERR-COLLECTION-002: ${e.message}`); setSaving(false); return }
    setConfirmedId(data.collectionId)
    setSaving(false)
  }

  async function outputPdf() {
    setError(null)
    try {
      const { data, error: e } = await getCollectionDetail(confirmedId)
      if (e) throw e
      await ensureJpFont()
      const doc = buildCollectionSlip(data)
      doc.save(slipFileName(confirmedId))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    }
  }

  const locked = !!confirmedId

  return (
    <div data-testid="collection-input" className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 p-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/launcher')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1">← 戻る</button>
          <button onClick={() => navigate('/collection/history')} className="text-sm text-blue-400 min-h-[44px]">履歴</button>
        </div>
        <h1 className="text-base font-bold text-text mb-2">集金入力</h1>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">店舗</span>
            <select data-testid="collection-store-select" value={storeCode} disabled={locked}
              onChange={e => setStoreCode(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50">
              <option value="">店舗を選択</option>
              {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">集金日</span>
            <input data-testid="collection-date" type="date" value={collectedAt} disabled={locked}
              onChange={e => setCollectedAt(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">担当者</span>
            <select data-testid="collection-staff-select" value={collectedBy} disabled={locked}
              onChange={e => setCollectedBy(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50">
              <option value="">担当者を選択</option>
              {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
            </select>
          </label>
          <button data-testid="collection-load-button" onClick={load} disabled={!storeCode || loading || locked}
            className="px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {loading ? '読込中…' : '読み込む'}
          </button>
        </div>
      </div>

      {error && <p data-testid="collection-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {!loaded && !loading && <p className="text-center text-muted text-base py-8">店舗を選んで読み込んでください</p>}
        {loaded && booths.length === 0 && <p className="text-center text-muted text-base py-8">集金対象ブース(is_collected)がありません</p>}
        <div className="space-y-2">
          {loaded && booths.map(b => {
            const sub = boothTotal(counts[b.booth_code])
            return (
              <button
                key={b.booth_code}
                data-testid="collection-booth-row"
                onClick={() => !locked && setActiveBooth(b)}
                className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 ${sub > 0 ? 'bg-green-900/15 border-green-600/40' : 'bg-surface border-border'} ${locked ? 'opacity-70' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-text truncate">
                    {b.machine_name}{b.booth_number != null && <span className="text-muted"> / ブース {b.booth_number}</span>}
                  </div>
                  <div className="text-xs text-muted font-mono">{b.booth_code}</div>
                </div>
                <span className="text-base font-bold text-text tabular-nums">{yen(sub)}円</span>
                {!locked && <span className="text-muted">›</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* footer: total + confirm/pdf */}
      {loaded && booths.length > 0 && (
        <div className="flex-shrink-0 border-t border-border p-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-muted">合計金額</div>
            <div data-testid="collection-total" className="text-2xl font-bold text-text tabular-nums">{yen(total)} 円</div>
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

      {activeBooth && (
        <DenominationDrawer
          booth={activeBooth}
          counts={counts[activeBooth.booth_code]}
          onChange={c => setCounts(prev => ({ ...prev, [activeBooth.booth_code]: c }))}
          onClose={() => setActiveBooth(null)}
        />
      )}
    </div>
  )
}
