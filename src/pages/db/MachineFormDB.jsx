import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const OWNERSHIP_TYPES = [
  { value: 'purchased', label: '購入' },
  { value: 'leased', label: 'リース' },
  { value: 'rental', label: 'レンタル' },
]

export default function MachineFormDB() {
  const navigate = useNavigate()
  const { storeCode } = useParams()
  const [machines, setMachines] = useState([])
  const [stores, setStores] = useState([])
  const [selStore, setSelStore] = useState(storeCode || '')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | machine object
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [boothCount, setBoothCount] = useState('4')

  useEffect(() => { loadStores() }, [])

  const loadMachines = useCallback(async () => {
    if (!selStore) return
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .eq('store_code', selStore)
      .order('machine_code')
    if (error) { setMsg('機械読み込みエラー: ' + error.message); return }
    setMachines(data || [])
  }, [selStore])

  useEffect(() => { if (selStore) loadMachines() }, [selStore, loadMachines])

  async function loadStores() {
    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select('store_code, store_name')
      .eq('is_active', true)
      .order('store_code')
    if (error) { setMsg('店舗読み込みエラー: ' + error.message); setLoading(false); return }
    setStores(data || [])
    if (!selStore && data.length > 0) setSelStore(data[0].store_code)
    setLoading(false)
  }

  function generateMachineCode() {
    const prefix = 'M'
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = prefix
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  function startNew() {
    setForm({
      store_code: selStore,
      machine_name: '',
      play_price: '100',
      meter_per_play: '1',
      floor: '',
      zone: '',
      ownership_type: 'purchased',
      notes: '',
    })
    setBoothCount('4')
    setEditing('new')
    setMsg('')
  }

  function startEdit(m) {
    setForm({ ...m, play_price: String(m.play_price ?? 100), meter_per_play: String(m.meter_per_play ?? 1) })
    setEditing(m)
    setMsg('')
  }

  async function handleSave() {
    if (!form.machine_name?.trim()) { setMsg('機械名は必須です'); return }

    setSaving(true)
    try {
      if (editing === 'new') {
        const machineCode = generateMachineCode()
        const { error } = await supabase.from('machines').insert({
          machine_code: machineCode,
          store_code: selStore,
          machine_name: form.machine_name.trim(),
          play_price: Number(form.play_price) || 100,
          meter_per_play: Number(form.meter_per_play) || 1,
          floor: form.floor || null,
          zone: form.zone || null,
          ownership_type: form.ownership_type || 'purchased',
          notes: form.notes || null,
        })
        if (error) throw error

        // ブース自動生成
        const count = parseInt(boothCount) || 1
        const boothRows = []
        for (let i = 1; i <= count; i++) {
          const bChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
          let bc = 'B'
          for (let j = 0; j < 8; j++) bc += bChars[Math.floor(Math.random() * bChars.length)]
          boothRows.push({
            booth_code: bc,
            machine_code: machineCode,
            store_code: selStore,
            booth_number: i,
            play_price: Number(form.play_price) || 100,
          })
        }
        if (boothRows.length > 0) {
          const { error: bErr } = await supabase.from('booths').insert(boothRows)
          if (bErr) throw bErr
        }

        setMsg(`機械を登録しました（ブース${count}件自動生成済み）`)
      } else {
        const { error } = await supabase.from('machines').update({
          machine_name: form.machine_name.trim(),
          play_price: Number(form.play_price) || 100,
          meter_per_play: Number(form.meter_per_play) || 1,
          floor: form.floor || null,
          zone: form.zone || null,
          ownership_type: form.ownership_type || 'purchased',
          is_active: form.is_active,
          notes: form.notes || null,
        }).eq('machine_code', editing.machine_code)
        if (error) throw error
        setMsg('機械を更新しました')
      }
      setEditing(null)
      await loadMachines()
    } catch (e) {
      setMsg('保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
    color: '#e0e0e0', fontSize: 14, padding: '10px 12px', outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }

  // 編集/新規フォーム
  if (editing !== null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0f0f0f', borderBottom: '1px solid #2a2a2a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>‹</button>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>
            {editing === 'new' ? '新規機械登録' : '機械編集'}
            <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span>
          </div>
        </div>

        {msg && (
          <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
            {msg}
          </div>
        )}

        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>機械名 <span style={{ color: '#ff6666' }}>*</span></label>
            <input type="text" value={form.machine_name || ''} onChange={e => setForm(p => ({ ...p, machine_name: e.target.value }))}
              placeholder="BUZZ CRANE 4P" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>プレイ単価 (円)</label>
              <input type="number" value={form.play_price || ''} onChange={e => setForm(p => ({ ...p, play_price: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>メーター/プレイ</label>
              <input type="number" value={form.meter_per_play || ''} onChange={e => setForm(p => ({ ...p, meter_per_play: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>フロア</label>
              <input type="text" value={form.floor || ''} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                placeholder="2F" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>ゾーン</label>
              <input type="text" value={form.zone || ''} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))}
                placeholder="A" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>所有形態</label>
            <select value={form.ownership_type || 'purchased'} onChange={e => setForm(p => ({ ...p, ownership_type: e.target.value }))}
              style={inputStyle}>
              {OWNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {editing === 'new' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>ブース数</label>
              <input type="number" value={boothCount} onChange={e => setBoothCount(e.target.value)}
                min="1" max="20" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>※ ブースが自動生成されます</div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>メモ</label>
            <input type="text" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={inputStyle} />
          </div>

          {editing !== 'new' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>ステータス</label>
              <select value={form.is_active === false ? 'false' : 'true'}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}
                style={inputStyle}>
                <option value="true">有効</option>
                <option value="false">無効</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditing(null)}
              style={{ flex: 1, background: '#252525', border: '1px solid #333', color: '#aaa', borderRadius: 10, padding: '12px 0', fontSize: 14, cursor: 'pointer' }}>
              キャンセル
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, background: saving ? '#333' : '#4a9eff', border: 'none', color: '#fff', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 'bold', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 一覧
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0f0f0f', borderBottom: '1px solid #2a2a2a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>機械管理 <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span></div>
          <div style={{ fontSize: 11, color: '#666' }}>{machines.length} 台</div>
        </div>
        <button onClick={startNew}
          style={{ background: '#4a9eff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          + 新規登録
        </button>
      </div>

      {/* 店舗セレクタ */}
      <div style={{ padding: '12px 16px' }}>
        <select value={selStore} onChange={e => setSelStore(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, color: '#e0e0e0', fontSize: 14, padding: '10px 14px', outline: 'none' }}>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_code} - {s.store_name}</option>)}
        </select>
      </div>

      {msg && (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
          {msg}
        </div>
      )}

      {/* 機械リスト */}
      <div style={{ padding: '0 16px' }}>
        {machines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>この店舗に機械が登録されていません</div>
        ) : machines.map(m => (
          <div key={m.machine_code} style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
            padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
          }} onClick={() => startEdit(m)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.machine_name || '(名前なし)'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#4a9eff', fontFamily: 'monospace' }}>{m.machine_code.slice(0, 6)}…</span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>¥{Number(m.play_price || 0).toLocaleString()}</span>
                  {m.floor && <span style={{ fontSize: 11, background: '#252525', padding: '1px 6px', borderRadius: 4, color: '#aaa' }}>{m.floor}</span>}
                  {m.ownership_type && m.ownership_type !== 'purchased' && (
                    <span style={{ fontSize: 11, background: '#2a2525', padding: '1px 6px', borderRadius: 4, color: '#cc8844' }}>
                      {OWNERSHIP_TYPES.find(t => t.value === m.ownership_type)?.label || m.ownership_type}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: m.is_active ? 'rgba(68,170,68,0.15)' : 'rgba(255,68,68,0.15)',
                  color: m.is_active ? '#44aa44' : '#ff4444',
                }}>
                  {m.is_active ? '有効' : '無効'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/db/machines/${selStore}/${m.machine_code}/booths`) }}
                  style={{ background: '#252535', border: '1px solid #3a3a5a', color: '#8888ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  ブース
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
