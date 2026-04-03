import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMeterReadings, getStores, parseNum, sheetsPut, sheetsBatchUpdate, clearCache } from '../services/sheets'

export default function DataSearch() {
  const navigate = useNavigate()
  const [allReadings, setAllReadings] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterBooth, setFilterBooth] = useState('')
  const [filterPrize, setFilterPrize] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [edits, setEdits] = useState({})
  const [deletes, setDeletes] = useState(new Set())
  const [editingRow, setEditingRow] = useState(null)
  const [dateSort, setDateSort] = useState('desc') // 'desc' or 'asc'

  useEffect(() => {
    Promise.all([getAllMeterReadings(true), getStores()]).then(([readings, storeList]) => {
      setAllReadings(readings); setStores(storeList); setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  const boothOptions = useMemo(() => {
    if (!filterStore) return []
    const codes = new Set(allReadings.filter(r => r.full_booth_code?.startsWith(filterStore)).map(r => r.full_booth_code))
    return [...codes].sort()
  }, [filterStore, allReadings])

  function handleStoreChange(val) { setFilterStore(val); setFilterBooth('') }

  const filtered = allReadings
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => {
      if (deletes.has(r._idx)) return false
      if (filterStore && !r.full_booth_code?.startsWith(filterStore)) return false
      if (filterBooth && r.full_booth_code !== filterBooth) return false
      if (filterPrize && !r.prize_name?.toLowerCase().includes(filterPrize.toLowerCase())) return false
      if (filterDateFrom && r.read_time?.slice(0,10) < filterDateFrom) return false
      if (filterDateTo && r.read_time?.slice(0,10) > filterDateTo) return false
      return true
    })
    .sort((a, b) => {
      const da = a.read_time || '', db = b.read_time || ''
      return dateSort === 'desc' ? db.localeCompare(da) : da.localeCompare(db)
    })
    .slice(0, 300)

  function startEdit(r) {
    setEditingRow(r._idx)
    if (!edits[r._idx]) {
      setEdits(prev => ({ ...prev, [r._idx]: {
        in_meter: r.in_meter||'', out_meter: r.out_meter||'',
        prize_restock_count: r.prize_restock_count||'', prize_stock_count: r.prize_stock_count||'',
        prize_name: r.prize_name||'', read_time: r.read_time?.slice(0,10)||'', _original: r
      }}))
    }
  }

  function updateEdit(idx, key, val) {
    setEdits(prev => ({ ...prev, [idx]: { ...prev[idx], [key]: val } }))
  }

  function cancelEdit(idx) {
    setEdits(prev => { const n={...prev}; delete n[idx]; return n })
    setEditingRow(null)
  }

  function markDelete(idx) {
    if (!window.confirm('このレコードを削除しますか？')) return
    setDeletes(prev => new Set([...prev, idx]))
    setEdits(prev => { const n={...prev}; delete n[idx]; return n })
    setEditingRow(null)
  }

  async function saveAll() {
    const editEntries = Object.entries(edits)
    const deleteEntries = [...deletes]
    if (!editEntries.length && !deleteEntries.length) return
    setSaving(true); setSaveMsg('')
    try {
      const deleteRows = deleteEntries.map(idx => idx + 2).sort((a,b) => b - a)
      for (const rowIndex of deleteRows) {
        await sheetsBatchUpdate([{ deleteDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }}}])
      }
      for (const [idxStr, edit] of editEntries) {
        const idx = Number(idxStr); const orig = edit._original; const rowIndex = idx + 2
        if (edit.read_time && edit.read_time !== orig.read_time?.slice(0,10)) {
          await sheetsPut(`meter_readings!D${rowIndex}`, [[edit.read_time]])
        }
        const range = `meter_readings!E${rowIndex}:I${rowIndex}`
        await sheetsPut(range, [[
          edit.in_meter!==''?edit.in_meter:orig.in_meter, edit.out_meter!==''?edit.out_meter:orig.out_meter,
          edit.prize_restock_count!==''?edit.prize_restock_count:orig.prize_restock_count,
          edit.prize_stock_count!==''?edit.prize_stock_count:orig.prize_stock_count,
          edit.prize_name!==''?edit.prize_name:orig.prize_name,
        ]])
      }
      clearCache()
      const fresh = await getAllMeterReadings(true)
      setAllReadings(fresh); setEdits({}); setDeletes(new Set()); setEditingRow(null)
      setSaveMsg(`✅ 編集${editEntries.length}件・削除${deleteEntries.length}件 完了`)
    } catch(e) { setSaveMsg('❌ エラー: '+e.message) }
    setSaving(false)
  }

  const editCount = Object.keys(edits).length
  const deleteCount = deletes.size
  const totalPending = editCount + deleteCount

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">全データを取得しています...</p>
      </div>
    </div>
  )

  const inputCls = "w-full bg-surface2 border border-border rounded-lg px-2.5 py-2 text-text text-sm outline-none focus:border-accent [color-scheme:dark]"
  const selectCls = "w-full bg-surface2 border border-border rounded-lg px-2.5 py-2 text-text text-sm outline-none focus:border-accent"

  return (
    <div className="h-screen max-w-lg mx-auto flex flex-col overflow-hidden">
      {/* 固定ヘッダー+検索セクション */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/')} className="bg-surface2 border border-border text-text rounded-lg px-3 py-1.5 text-base">←</button>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">データ検索・修正</div>
            <div className="text-xs text-muted mt-0.5">全{allReadings.length}件</div>
          </div>
        </div>

        {saveMsg && (
          <div className={`rounded-lg p-2.5 mb-3 text-sm border border-border ${saveMsg.startsWith('✅') ? 'bg-surface2 text-accent3' : 'bg-surface2 text-accent2'}`}>
            {saveMsg}
          </div>
        )}

        {/* フィルター */}
        <div className="bg-surface border border-border rounded-xl p-3 mb-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">店舗</div>
              <select className={selectCls} value={filterStore} onChange={e=>handleStoreChange(e.target.value)}>
                <option value="">全店舗</option>
                {stores.map(s=><option key={s.store_id} value={s.store_code}>{s.store_name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">ブース</div>
              {filterStore ? (
                <select className={selectCls} value={filterBooth} onChange={e=>setFilterBooth(e.target.value)}>
                  <option value="">全ブース</option>
                  {boothOptions.map(code=><option key={code} value={code}>{code}</option>)}
                </select>
              ) : (
                <select className={selectCls + ' opacity-40'} disabled><option>店舗を先に選択</option></select>
              )}
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">日付（から）</div>
              <input className={inputCls} type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">日付（まで）</div>
              <input className={inputCls} type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1">景品名</div>
            <input className={inputCls} type="text" placeholder="景品名で検索" value={filterPrize} onChange={e=>setFilterPrize(e.target.value)} />
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{filtered.length}件</span>
              <button className="bg-surface2 border border-border text-text text-[11px] px-2 py-0.5 rounded"
                onClick={() => setDateSort(d => d === 'desc' ? 'asc' : 'desc')}>
                日付{dateSort === 'desc' ? '↓新→古' : '↑古→新'}
              </button>
            </div>
            <button className="bg-surface2 border border-border text-text text-xs px-3 py-1 rounded-lg"
              onClick={()=>{setFilterStore('');setFilterBooth('');setFilterPrize('');setFilterDateFrom('');setFilterDateTo('')}}>
              リセット
            </button>
          </div>
        </div>
      </div>

      {/* スクロール可能なデータリスト */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
      {filtered.length===0 && (
        <div className="bg-surface border border-border rounded-xl text-center text-muted p-8">
          条件に一致するデータがありません
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(r => {
          const isEditing = editingRow===r._idx
          const edit = edits[r._idx]
          const isModified = !!edit
          return (
            <div key={r._idx} className={`bg-surface border border-border rounded-xl p-3.5 ${isModified?'border-l-4 border-l-accent4':''}`}>
              {isEditing ? (
                <div>
                  <div className="flex justify-between mb-2.5">
                    <div className="font-bold text-sm">{r.full_booth_code}</div>
                    <span className="text-[11px] text-accent bg-surface3 px-2 py-0.5 rounded-full">編集中</span>
                  </div>
                  <div className="mb-2">
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">📅 日付</div>
                    <input className={inputCls} type="date" value={edit?.read_time||r.read_time?.slice(0,10)||''}
                      onChange={e=>updateEdit(r._idx,'read_time',e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[['in_meter','INメーター'],['out_meter','OUTメーター'],['prize_restock_count','景品補充数'],['prize_stock_count','景品投入残']].map(([key,label]) => (
                      <div key={key}>
                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{label}</div>
                        <input className={inputCls} type="number" value={edit?.[key]||''} placeholder={r[key]||'0'}
                          onChange={e=>updateEdit(r._idx,key,e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div className="mb-2.5">
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">景品名</div>
                    <input className={inputCls} type="text" value={edit?.prize_name||''} placeholder={r.prize_name}
                      onChange={e=>updateEdit(r._idx,'prize_name',e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-surface2 border border-border text-text text-sm py-2 rounded-lg" onClick={()=>setEditingRow(null)}>✓ 完了</button>
                    <button className="flex-1 bg-surface2 border border-border text-accent2 text-sm py-2 rounded-lg" onClick={()=>cancelEdit(r._idx)}>取消</button>
                    <button className="flex-1 bg-surface2 border border-border text-accent2 text-sm py-2 rounded-lg" onClick={()=>markDelete(r._idx)}>🗑 削除</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center cursor-pointer" onClick={()=>startEdit(r)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="font-bold text-sm">{r.full_booth_code}</div>
                      {isModified && <span className="text-[10px] text-accent4 bg-surface3 px-1.5 py-0.5 rounded-md">変更済</span>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {r.read_time?.slice(0,10)} · IN: {parseNum(r.in_meter).toLocaleString()}
                      {r.out_meter?` · OUT: ${parseNum(r.out_meter).toLocaleString()}`:''}
                    </div>
                    <div className="text-xs text-muted mt-0.5 truncate">{r.prize_name||'景品名なし'}</div>
                  </div>
                  <div className="text-accent4 text-lg pl-2">✏️</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      </div>{/* スクロール領域終了 */}

      {/* 確定バー */}
      {totalPending>0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-surface border-t border-border z-50">
          {deleteCount>0 && (
            <div className="text-xs text-accent2 mb-1.5 text-center">🗑 {deleteCount}件削除予定</div>
          )}
          <button onClick={saveAll} disabled={saving}
            className="w-full bg-accent text-black font-bold py-2.5 rounded-xl disabled:opacity-50">
            {saving?'保存中...':`💾 ${editCount}件編集・${deleteCount}件削除 を確定`}
          </button>
        </div>
      )}
    </div>
  )
}
