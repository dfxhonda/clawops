import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// J-COLLECTION-FLAG-01: 巡回データの集金フラグ管理 (マネサポ)
// 店舗+巡回日を選んでブース一覧を表示、is_collected をブース単位/一括で編集し明示保存。

function diffText(v) {
  if (v == null) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString() : '-'
}

export default function AdminCollectionFlagPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [dates, setDates] = useState([])
  const [patrolDate, setPatrolDate] = useState('')
  const [rows, setRows] = useState([])
  const [flags, setFlags] = useState({})      // working copy {reading_id: bool}
  const [original, setOriginal] = useState({}) // baseline for diff
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // アクティブ店舗
  useEffect(() => {
    supabase.from('stores').select('store_code, store_name').eq('is_active', true).order('store_name')
      .then(({ data }) => setStores(data ?? []))
  }, [])

  // 店舗の巡回日一覧 (entry_type=patrol)
  useEffect(() => {
    setDates([]); setPatrolDate(''); setLoaded(false); setRows([])
    if (!storeCode) return
    supabase.from('meter_readings').select('patrol_date')
      .eq('store_code', storeCode).eq('entry_type', 'patrol')
      .then(({ data }) => {
        const uniq = [...new Set((data ?? []).map(r => r.patrol_date).filter(Boolean))].sort().reverse()
        setDates(uniq)
        setPatrolDate(uniq[0] ?? '')
      })
  }, [storeCode])

  async function loadReadings() {
    if (!storeCode || !patrolDate) return
    setLoading(true); setError(null); setLoaded(false)
    const { data, error: e } = await supabase.from('meter_readings')
      .select('reading_id, machine_code, booth_code, in_diff, out_diff, revenue, is_collected')
      .eq('store_code', storeCode).eq('patrol_date', patrolDate).eq('entry_type', 'patrol')
    if (e) { setError(`ERR-COLFLAG-001: ${e.message}`); setLoading(false); return }

    // 機械名/ブース番号マップ
    const [{ data: machineData }, { data: boothData }] = await Promise.all([
      supabase.from('machines').select('machine_code, machine_name').eq('store_code', storeCode),
      supabase.from('booths').select('booth_code, booth_number').eq('store_code', storeCode),
    ])
    const mName = Object.fromEntries((machineData ?? []).map(m => [m.machine_code, m.machine_name]))
    const bNum = Object.fromEntries((boothData ?? []).map(b => [b.booth_code, b.booth_number]))

    const enriched = (data ?? []).map(r => ({
      ...r,
      machine_name: mName[r.machine_code] || r.machine_code || '機械不明',
      booth_number: bNum[r.booth_code] ?? null,
    })).sort((a, b) =>
      (a.machine_name || '').localeCompare(b.machine_name || '', 'ja') ||
      (a.booth_number ?? 0) - (b.booth_number ?? 0)
    )

    const flagMap = Object.fromEntries(enriched.map(r => [r.reading_id, !!r.is_collected]))
    setRows(enriched)
    setFlags(flagMap)
    setOriginal(flagMap)
    setLoaded(true)
    setLoading(false)
  }

  function setAll(value) {
    setFlags(Object.fromEntries(rows.map(r => [r.reading_id, value])))
  }
  function toggleOne(id) {
    setFlags(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const dirty = useMemo(
    () => rows.some(r => flags[r.reading_id] !== original[r.reading_id]),
    [rows, flags, original]
  )
  const collectedCount = useMemo(
    () => rows.filter(r => flags[r.reading_id]).length,
    [rows, flags]
  )

  async function save() {
    setSaving(true); setError(null)
    const now = new Date().toISOString()
    const changedTrue = rows.filter(r => flags[r.reading_id] && !original[r.reading_id]).map(r => r.reading_id)
    const changedFalse = rows.filter(r => !flags[r.reading_id] && original[r.reading_id]).map(r => r.reading_id)
    try {
      if (changedTrue.length) {
        const { error: e } = await supabase.from('meter_readings')
          .update({ is_collected: true, updated_by: staffName, updated_at: now })
          .in('reading_id', changedTrue)
        if (e) throw e
      }
      if (changedFalse.length) {
        const { error: e } = await supabase.from('meter_readings')
          .update({ is_collected: false, updated_by: staffName, updated_at: now })
          .in('reading_id', changedFalse)
        if (e) throw e
      }
      setOriginal({ ...flags })
    } catch (e) {
      setError(`ERR-COLFLAG-002: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="admin-collection-flag" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      <div className="flex-shrink-0 p-3 pb-2">
        <button onClick={() => navigate('/admin')} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-3 min-h-[44px]">← 戻る</button>
        <h1 className="text-base font-bold text-text mb-3">集金フラグ管理</h1>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">店舗</span>
            <select data-testid="colflag-store-select" value={storeCode} onChange={e => setStoreCode(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text">
              <option value="">店舗を選択</option>
              {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">巡回日</span>
            <select data-testid="colflag-date-select" value={patrolDate} onChange={e => setPatrolDate(e.target.value)}
              disabled={!storeCode || dates.length === 0}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text disabled:opacity-50">
              {dates.length === 0 && <option value="">巡回日なし</option>}
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <button data-testid="colflag-load-button" onClick={loadReadings} disabled={!storeCode || !patrolDate || loading}
            className="px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {loading ? '読込中…' : '読み込む'}
          </button>
        </div>
      </div>

      {error && <p data-testid="colflag-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      {loaded && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-y border-border">
          <span className="text-sm text-muted">{collectedCount}/{rows.length} 集金済</span>
          <button data-testid="colflag-bulk-on" onClick={() => setAll(true)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px]">全ブース集金済</button>
          <button data-testid="colflag-bulk-off" onClick={() => setAll(false)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px]">全ブースリセット</button>
          <button data-testid="colflag-save-button" onClick={save} disabled={saving || !dirty}
            className="ml-auto px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {saving ? '保存中…' : (dirty ? '保存' : '保存済')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {!loaded && !loading && <p className="text-center text-muted text-base py-8">店舗と巡回日を選んで読み込んでください</p>}
        {loaded && rows.length === 0 && <p className="text-center text-muted text-base py-8">該当する巡回データがありません</p>}

        <div className="space-y-2">
          {loaded && rows.map(r => {
            const on = !!flags[r.reading_id]
            return (
              <button
                key={r.reading_id}
                data-testid="colflag-booth-row"
                onClick={() => toggleOne(r.reading_id)}
                className={`w-full text-left flex items-center gap-3 rounded-xl border p-3 ${on ? 'bg-green-900/20 border-green-600/50' : 'bg-surface border-border'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-text truncate">
                    {r.machine_name}{r.booth_number != null && <span className="text-muted"> / ブース {r.booth_number}</span>}
                  </div>
                  <div className="text-sm text-muted mt-0.5 flex gap-3">
                    <span>IN差 {diffText(r.in_diff)}</span>
                    <span>OUT差 {diffText(r.out_diff)}</span>
                    <span>売上 {diffText(r.revenue)}円</span>
                  </div>
                </div>
                <span
                  data-testid="colflag-booth-toggle"
                  aria-checked={on}
                  className={`px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ${on ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}
                >
                  {on ? '集金済' : '未集金'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
