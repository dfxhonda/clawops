import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import StorePickerSheet from '../../components/StorePickerSheet'

// J-COLLECTION-FLAG-REDESIGN-01 (司令塔Opus spec):
// - 店舗 + 日付 (default 今日 JST) を選んだ時点で その店舗の 巡回 meter_readings (patrol_date <= 日付) を一括取得
// - 機械ごとにグルーピング、ブース単位チェック / 機械単位 select-all / 店舗単位 select-all
// - 一括フラグ: is_collected=true (= spec の collection_flagged) + flagged_at=選択日付 (ISO)
// - 個別 booth toggle も従来通り保持
// 注: meter_readings に collection_flagged 列は無く、既存 is_collected を spec の意味で再利用 (implementation_notes)。

function todayJst() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function diffText(v) {
  if (v == null) return '-'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString() : '-'
}

function flaggedAtIsoFromDate(dateStr) {
  // JST 00:00 をその日の flagged_at とする (toISOString 直接禁止のため UTC オフセット計算)
  // 例: 2026-05-31 (JST) → 2026-05-30T15:00:00.000Z
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString()
}

export default function AdminCollectionFlagPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()

  const [storeCode, setStoreCode] = useState('')
  const [asOfDate, setAsOfDate] = useState(todayJst())
  const [rows, setRows] = useState([])
  const [flags, setFlags] = useState({})
  const [original, setOriginal] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadReadings = useCallback(async () => {
    if (!storeCode || !asOfDate) return
    setLoading(true); setError(null); setLoaded(false)
    const { data, error: e } = await supabase.from('meter_readings')
      .select('reading_id, machine_code, booth_code, in_diff, out_diff, revenue, is_collected, patrol_date')
      .eq('store_code', storeCode)
      .eq('entry_type', 'patrol')
      .lte('patrol_date', asOfDate)
      .order('patrol_date', { ascending: false })
    if (e) { setError(`ERR-COLFLAG-001: ${e.message}`); setLoading(false); return }

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
    }))

    const flagMap = Object.fromEntries(enriched.map(r => [r.reading_id, !!r.is_collected]))
    setRows(enriched)
    setFlags(flagMap)
    setOriginal(flagMap)
    setLoaded(true)
    setLoading(false)
  }, [storeCode, asOfDate])

  useEffect(() => {
    if (storeCode && asOfDate) loadReadings()
    else { setRows([]); setFlags({}); setOriginal({}); setLoaded(false) }
  }, [storeCode, asOfDate, loadReadings])

  const groups = useMemo(() => {
    const byMachine = new Map()
    for (const r of rows) {
      if (!byMachine.has(r.machine_code)) byMachine.set(r.machine_code, { machine_code: r.machine_code, machine_name: r.machine_name, rows: [] })
      byMachine.get(r.machine_code).rows.push(r)
    }
    const arr = Array.from(byMachine.values())
    arr.sort((a, b) => (a.machine_name || '').localeCompare(b.machine_name || '', 'ja'))
    for (const g of arr) {
      g.rows.sort((a, b) =>
        String(b.patrol_date).localeCompare(String(a.patrol_date)) ||
        (a.booth_number ?? 0) - (b.booth_number ?? 0)
      )
    }
    return arr
  }, [rows])

  function toggleOne(id) {
    setFlags(prev => ({ ...prev, [id]: !prev[id] }))
  }
  function setMachineAll(machineCode, value) {
    setFlags(prev => {
      const next = { ...prev }
      for (const r of rows) {
        if (r.machine_code === machineCode) next[r.reading_id] = value
      }
      return next
    })
  }
  function setAllStore(value) {
    setFlags(Object.fromEntries(rows.map(r => [r.reading_id, value])))
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
    const flaggedAtIso = flaggedAtIsoFromDate(asOfDate)
    const changedTrue = rows.filter(r => flags[r.reading_id] && !original[r.reading_id]).map(r => r.reading_id)
    const changedFalse = rows.filter(r => !flags[r.reading_id] && original[r.reading_id]).map(r => r.reading_id)
    try {
      if (changedTrue.length) {
        const { error: e } = await supabase.from('meter_readings')
          .update({ is_collected: true, flagged_at: flaggedAtIso, updated_by: staffName, updated_at: now })
          .in('reading_id', changedTrue)
        if (e) throw e
      }
      if (changedFalse.length) {
        const { error: e } = await supabase.from('meter_readings')
          .update({ is_collected: false, flagged_at: null, updated_by: staffName, updated_at: now })
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
        <button onClick={() => navigate('/admin/collection')} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mb-3 min-h-[44px]">← 戻る</button>
        <h1 className="text-base font-bold text-text mb-3">集金フラグ編集</h1>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">店舗</span>
            {/* J-UI-STORE-PICKER-SHEET-01: dropdown → StorePickerSheet 統一 */}
            <StorePickerSheet
              value={storeCode || null}
              onChange={v => setStoreCode(v ?? '')}
              showAllOption={false}
              placeholder="店舗を選択"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">基準日 (この日まで)</span>
            <input type="date" data-testid="colflag-asof-date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text" />
          </label>
        </div>
      </div>

      {error && <p data-testid="colflag-error" className="text-red-400 text-sm px-3 py-1 flex-shrink-0">{error}</p>}

      {loaded && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-y border-border">
          <span className="text-sm text-muted">{collectedCount}/{rows.length} 集金済</span>
          <button data-testid="colflag-bulk-on" onClick={() => setAllStore(true)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px]">全店集金済</button>
          <button data-testid="colflag-bulk-off" onClick={() => setAllStore(false)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px]">全店リセット</button>
          <button data-testid="colflag-save-button" onClick={save} disabled={saving || !dirty}
            className="ml-auto px-4 min-h-[44px] rounded-lg bg-blue-600 text-white text-base font-bold disabled:opacity-50">
            {saving ? '保存中…' : (dirty ? '保存' : '保存済')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading && <p className="text-center text-muted text-base py-8">読み込み中…</p>}
        {loaded && rows.length === 0 && <p className="text-center text-muted text-base py-8">該当する巡回データがありません</p>}
        {!storeCode && <p className="text-center text-muted text-base py-8">店舗を選択してください</p>}

        <div className="space-y-3">
          {loaded && groups.map(g => {
            const total = g.rows.length
            const on = g.rows.filter(r => flags[r.reading_id]).length
            const allOn = on === total && total > 0
            return (
              <div key={g.machine_code} data-testid={`colflag-machine-group-${g.machine_code}`} className="border border-border rounded-xl bg-surface/40 p-2">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <h3 className="flex-1 text-sm font-bold text-text truncate">{g.machine_name}</h3>
                  <span className="text-xs text-muted shrink-0">{on}/{total}</span>
                  <button
                    data-testid={`colflag-machine-bulk-${g.machine_code}`}
                    onClick={() => setMachineAll(g.machine_code, !allOn)}
                    className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${allOn ? 'bg-green-700 border-green-600 text-white' : 'bg-surface border-border text-text'}`}
                  >
                    {allOn ? '全解除' : 'この機械全部'}
                  </button>
                </div>
                <div className="space-y-1">
                  {g.rows.map(r => {
                    const on = !!flags[r.reading_id]
                    return (
                      <button
                        key={r.reading_id}
                        data-testid="colflag-booth-row"
                        onClick={() => toggleOne(r.reading_id)}
                        className={`w-full text-left flex items-center gap-2 rounded-lg border p-2 ${on ? 'bg-green-900/20 border-green-600/50' : 'bg-surface border-border'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-mono text-muted">
                            {r.patrol_date}
                            {r.booth_number != null && <span className="ml-2 text-text font-bold">B{String(r.booth_number).padStart(2,'0')}</span>}
                          </div>
                          <div className="text-xs text-muted mt-0.5 flex gap-2">
                            <span>IN差 {diffText(r.in_diff)}</span>
                            <span>OUT差 {diffText(r.out_diff)}</span>
                            <span>売上 {diffText(r.revenue)}円</span>
                          </div>
                        </div>
                        <span
                          data-testid="colflag-booth-toggle"
                          aria-checked={on}
                          className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${on ? 'bg-green-600 border-green-500 text-white' : 'bg-surface border-border'}`}
                        >
                          {on ? '✓' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
