import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMeterReadings, getStores, parseNum, getToken, clearCache } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

const S = {
  backBtn: { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'6px 12px', fontSize:16, cursor:'pointer' },
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, marginBottom:8, minWidth:0, overflow:'hidden' },
  label: { fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  input: { width:'100%', maxWidth:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  select: { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  selectOff: { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', color:'var(--muted)', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box', opacity:0.4 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  btnPrimary: { background:'var(--accent)', color:'#000', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:'bold', fontSize:14, cursor:'pointer', width:'100%' },
  btnSec: { background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:13, cursor:'pointer', flex:1 },
  btnDanger: { background:'var(--surface2)', color:'var(--accent2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:13, cursor:'pointer', flex:1 },
  badgeModified: { fontSize:10, color:'var(--accent4)', background:'var(--surface3)', padding:'1px 6px', borderRadius:8 },
  badgeEdit: { fontSize:11, color:'var(--accent)', background:'var(--surface3)', padding:'2px 8px', borderRadius:10, height:'fit-content' },
  fixedBottom: { position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', zIndex:100 },
  msgOk:  { background:'var(--surface2)', borderRadius:8, padding:10, marginBottom:12, color:'var(--accent3)', fontSize:13, border:'1px solid var(--border)' },
  msgErr: { background:'var(--surface2)', borderRadius:8, padding:10, marginBottom:12, color:'var(--accent2)', fontSize:13, border:'1px solid var(--border)' },
}

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

  useEffect(() => {
    Promise.all([getAllMeterReadings(true), getStores()]).then(([readings, storeList]) => {
      setAllReadings(readings)
      setStores(storeList)
      setLoading(false)
    }).catch(e => { console.error(e); setLoading(false) })
  }, [])

  const boothOptions = useMemo(() => {
    if (!filterStore) return []
    const codes = new Set(
      allReadings
        .filter(r => r.full_booth_code?.startsWith(filterStore))
        .map(r => r.full_booth_code)
    )
    return [...codes].sort()
  }, [filterStore, allReadings])

  function handleStoreChange(val) {
    setFilterStore(val)
    setFilterBooth('')
  }

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
    .slice(-300)

  function startEdit(r) {
    setEditingRow(r._idx)
    if (!edits[r._idx]) {
      setEdits(prev => ({ ...prev, [r._idx]: {
        in_meter: r.in_meter||'',
        out_meter: r.out_meter||'',
        prize_restock_count: r.prize_restock_count||'',
        prize_stock_count: r.prize_stock_count||'',
        prize_name: r.prize_name||'',
        read_time: r.read_time?.slice(0,10)||'',
        _original: r
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
      // 削除（行番号の大きい順に処理してズレを防ぐ）
      const deleteRows = deleteEntries
        .map(idx => idx + 2) // ヘッダー行 +1 で2から
        .sort((a,b) => b - a) // 大きい順

      for (const rowIndex of deleteRows) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
          { method:'POST',
            headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
            body: JSON.stringify({ requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0, // meter_readingsのsheetId（要確認）
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-indexed
                  endIndex: rowIndex
                }
              }
            }]})
          }
        )
      }

      // 編集保存
      for (const [idxStr, edit] of editEntries) {
        const idx = Number(idxStr)
        const orig = edit._original
        const rowIndex = idx + 2
        // 日付変更
        if (edit.read_time && edit.read_time !== orig.read_time?.slice(0,10)) {
          const dRange = `meter_readings!D${rowIndex}`
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(dRange)}?valueInputOption=USER_ENTERED`,
            { method:'PUT', headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
              body: JSON.stringify({ values: [[edit.read_time]] })
            }
          )
        }
        // メーター・景品
        const range = `meter_readings!E${rowIndex}:I${rowIndex}`
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          { method:'PUT', headers:{ Authorization:`Bearer ${getToken()}`, 'Content-Type':'application/json' },
            body: JSON.stringify({ values: [[
              edit.in_meter!==''?edit.in_meter:orig.in_meter,
              edit.out_meter!==''?edit.out_meter:orig.out_meter,
              edit.prize_restock_count!==''?edit.prize_restock_count:orig.prize_restock_count,
              edit.prize_stock_count!==''?edit.prize_stock_count:orig.prize_stock_count,
              edit.prize_name!==''?edit.prize_name:orig.prize_name,
            ]]})
          }
        )
      }

      clearCache()
      const fresh = await getAllMeterReadings(true)
      setAllReadings(fresh)
      setEdits({}); setDeletes(new Set()); setEditingRow(null)
      setSaveMsg(`✅ 編集${editEntries.length}件・削除${deleteEntries.length}件 完了`)
    } catch(e) { setSaveMsg('❌ エラー: '+e.message) }
    setSaving(false)
  }

  const editCount = Object.keys(edits).length
  const deleteCount = deletes.size
  const totalPending = editCount + deleteCount

  if (loading) return (
    <div style={{paddingTop:80, textAlign:'center', color:'var(--text)'}}>
      <p>読み込み中...</p>
      <p style={{fontSize:12, color:'var(--muted)', marginTop:8}}>全データを取得しています</p>
    </div>
  )

  return (
    <div style={{padding:'16px 14px 100px', maxWidth:'100vw', overflowX:'hidden'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
        <button style={S.backBtn} onClick={() => navigate('/')}>←</button>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:18, fontWeight:'bold', color:'var(--text)'}}>データ検索・修正</div>
          <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>全{allReadings.length}件</div>
        </div>
      </div>

      {saveMsg && <div style={saveMsg.startsWith('✅')?S.msgOk:S.msgErr}>{saveMsg}</div>}

      {/* フィルター */}
      <div style={{...S.card, marginBottom:12}}>
        <div style={S.grid2}>
          <div>
            <div style={S.label}>店舗</div>
            <select style={S.select} value={filterStore} onChange={e=>handleStoreChange(e.target.value)}>
              <option value="">全店舗</option>
              {stores.map(s=><option key={s.store_id} value={s.store_code}>{s.store_name}</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>ブース</div>
            {filterStore ? (
              <select style={S.select} value={filterBooth} onChange={e=>setFilterBooth(e.target.value)}>
                <option value="">全ブース</option>
                {boothOptions.map(code=><option key={code} value={code}>{code}</option>)}
              </select>
            ) : (
              <select style={S.selectOff} disabled><option>店舗を先に選択</option></select>
            )}
          </div>
          <div>
            <div style={S.label}>日付（から）</div>
            <input style={S.input} type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} />
          </div>
          <div>
            <div style={S.label}>日付（まで）</div>
            <input style={S.input} type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} />
          </div>
        </div>
        <div style={{marginTop:8}}>
          <div style={S.label}>景品名</div>
          <input style={S.input} type="text" placeholder="景品名で検索"
            value={filterPrize} onChange={e=>setFilterPrize(e.target.value)} />
        </div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}>
          <span style={{fontSize:12, color:'var(--muted)'}}>{filtered.length}件表示</span>
          <button style={{...S.btnSec, flex:'none', padding:'4px 12px', fontSize:12}}
            onClick={()=>{setFilterStore('');setFilterBooth('');setFilterPrize('');setFilterDateFrom('');setFilterDateTo('')}}>
            リセット
          </button>
        </div>
      </div>

      {filtered.length===0 && (
        <div style={{...S.card, textAlign:'center', color:'var(--muted)', padding:32}}>
          条件に一致するデータがありません
        </div>
      )}

      {filtered.map(r => {
        const isEditing = editingRow===r._idx
        const edit = edits[r._idx]
        const isModified = !!edit
        return (
          <div key={r._idx} style={{...S.card,
            borderLeft:`4px solid ${isModified?'var(--accent4)':'transparent'}`}}>
            {isEditing ? (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:'bold', fontSize:14, color:'var(--text)'}}>{r.full_booth_code}</div>
                  </div>
                  <span style={S.badgeEdit}>編集中</span>
                </div>

                {/* 日付修正 */}
                <div style={{marginBottom:8}}>
                  <div style={S.label}>📅 日付</div>
                  <input style={S.input} type="date"
                    value={edit?.read_time||r.read_time?.slice(0,10)||''}
                    onChange={e=>updateEdit(r._idx,'read_time',e.target.value)} />
                </div>

                <div style={{...S.grid2, marginBottom:8}}>
                  <div>
                    <div style={S.label}>INメーター</div>
                    <input style={S.input} type="number" value={edit?.in_meter||''} placeholder={r.in_meter}
                      onChange={e=>updateEdit(r._idx,'in_meter',e.target.value)} />
                  </div>
                  <div>
                    <div style={S.label}>OUTメーター</div>
                    <input style={S.input} type="number" value={edit?.out_meter||''} placeholder={r.out_meter}
                      onChange={e=>updateEdit(r._idx,'out_meter',e.target.value)} />
                  </div>
                  <div>
                    <div style={S.label}>景品補充数</div>
                    <input style={S.input} type="number" value={edit?.prize_restock_count||''} placeholder={r.prize_restock_count||'0'}
                      onChange={e=>updateEdit(r._idx,'prize_restock_count',e.target.value)} />
                  </div>
                  <div>
                    <div style={S.label}>景品投入残</div>
                    <input style={S.input} type="number" value={edit?.prize_stock_count||''} placeholder={r.prize_stock_count||'0'}
                      onChange={e=>updateEdit(r._idx,'prize_stock_count',e.target.value)} />
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={S.label}>景品名</div>
                  <input style={S.input} type="text" value={edit?.prize_name||''} placeholder={r.prize_name}
                    onChange={e=>updateEdit(r._idx,'prize_name',e.target.value)} />
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button style={S.btnSec} onClick={()=>setEditingRow(null)}>✓ 完了</button>
                  <button style={S.btnDanger} onClick={()=>cancelEdit(r._idx)}>取消</button>
                  <button style={{...S.btnDanger, color:'var(--accent2)'}}
                    onClick={()=>markDelete(r._idx)}>🗑 削除</button>
                </div>
              </div>
            ) : (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}
                onClick={()=>startEdit(r)}>
                <div style={{minWidth:0, flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                    <div style={{fontWeight:'bold', fontSize:14, color:'var(--text)'}}>{r.full_booth_code}</div>
                    {isModified && <span style={S.badgeModified}>変更済</span>}
                  </div>
                  <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>
                    {r.read_time?.slice(0,10)} · IN: {parseNum(r.in_meter).toLocaleString()}
                    {r.out_meter?` · OUT: ${parseNum(r.out_meter).toLocaleString()}`:''}
                  </div>
                  <div style={{fontSize:12, color:'var(--muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {r.prize_name||'景品名なし'}
                  </div>
                </div>
                <div style={{color:'var(--accent4)', fontSize:18, paddingLeft:8}}>✏️</div>
              </div>
            )}
          </div>
        )
      })}

      {totalPending>0 && (
        <div style={S.fixedBottom}>
          {deleteCount>0 && (
            <div style={{fontSize:12, color:'var(--accent2)', marginBottom:6, textAlign:'center'}}>
              🗑 {deleteCount}件削除予定
            </div>
          )}
          <button style={S.btnPrimary} onClick={saveAll} disabled={saving}>
            {saving?'保存中...':`💾 ${editCount}件編集・${deleteCount}件削除 を確定`}
          </button>
        </div>
      )}
    </div>
  )
}
