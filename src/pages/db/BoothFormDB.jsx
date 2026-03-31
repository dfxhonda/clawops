import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function BoothFormDB() {
  const navigate = useNavigate()
  const { storeCode, machineCode } = useParams()
  const [booths, setBooths] = useState([])
  const [machine, setMachine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | booth object
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, bRes] = await Promise.all([
        supabase.from('machines').select('*').eq('machine_code', machineCode).single(),
        supabase.from('booths').select('*').eq('machine_code', machineCode).order('booth_number'),
      ])
      if (mRes.error) throw mRes.error
      setMachine(mRes.data)
      setBooths(bRes.data || [])
    } catch (e) {
      setMsg('読み込みエラー: ' + e.message)
    }
    setLoading(false)
  }, [machineCode])

  useEffect(() => { loadData() }, [loadData])

  function generateBoothCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'B'
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  function getNextBoothNumber() {
    if (booths.length === 0) return 1
    return Math.max(...booths.map(b => b.booth_number || 0)) + 1
  }

  function startNew() {
    setForm({
      booth_number: getNextBoothNumber(),
      play_price: String(machine?.play_price ?? 100),
      out_meter_count: '1',
      meter_in_shared: false,
      notes: '',
    })
    setEditing('new')
    setMsg('')
  }

  function startEdit(b) {
    setForm({
      ...b,
      play_price: String(b.play_price ?? ''),
      out_meter_count: String(b.out_meter_count ?? 1),
      payout_setting: String(b.payout_setting ?? ''),
      setting_c: String(b.setting_c ?? ''),
      setting_l: String(b.setting_l ?? ''),
      setting_r: String(b.setting_r ?? ''),
    })
    setEditing(b)
    setMsg('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing === 'new') {
        const boothCode = generateBoothCode()
        const { error } = await supabase.from('booths').insert({
          booth_code: boothCode,
          machine_code: machineCode,
          store_code: storeCode,
          booth_number: Number(form.booth_number) || getNextBoothNumber(),
          play_price: form.play_price ? Number(form.play_price) : null,
          out_meter_count: Number(form.out_meter_count) || 1,
          meter_in_shared: form.meter_in_shared || false,
          notes: form.notes || null,
        })
        if (error) throw error
        setMsg('ブースを追加しました')
      } else {
        const { error } = await supabase.from('booths').update({
          booth_number: Number(form.booth_number) || editing.booth_number,
          play_price: form.play_price ? Number(form.play_price) : null,
          out_meter_count: Number(form.out_meter_count) || 1,
          meter_in_shared: form.meter_in_shared || false,
          payout_setting: form.payout_setting ? Number(form.payout_setting) : null,
          setting_c: form.setting_c ? Number(form.setting_c) : null,
          setting_l: form.setting_l ? Number(form.setting_l) : null,
          setting_r: form.setting_r ? Number(form.setting_r) : null,
          setting_other: form.setting_other || null,
          is_active: form.is_active,
          notes: form.notes || null,
          current_prize_id: form.current_prize_id || null,
          current_phase: form.current_phase || null,
        }).eq('booth_code', editing.booth_code)
        if (error) throw error
        setMsg('ブースを更新しました')
      }
      setEditing(null)
      await loadData()
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
            {editing === 'new' ? 'ブース追加' : 'ブース編集'}
            <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span>
          </div>
        </div>

        {msg && (
          <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
            {msg}
          </div>
        )}

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>ブース番号</label>
              <input type="number" value={form.booth_number || ''} onChange={e => setForm(p => ({ ...p, booth_number: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>プレイ単価 (円)</label>
              <input type="number" value={form.play_price || ''} onChange={e => setForm(p => ({ ...p, play_price: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>OUTメーター数</label>
              <input type="number" value={form.out_meter_count || ''} onChange={e => setForm(p => ({ ...p, out_meter_count: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>INメーター共有</label>
              <select value={form.meter_in_shared ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, meter_in_shared: e.target.value === 'true' }))}
                style={inputStyle}>
                <option value="false">個別</option>
                <option value="true">共有</option>
              </select>
            </div>
          </div>

          {editing !== 'new' && (
            <>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 'bold', marginBottom: 8, marginTop: 8 }}>設定値</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>払出設定</label>
                  <input type="number" value={form.payout_setting || ''} onChange={e => setForm(p => ({ ...p, payout_setting: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>設定C</label>
                  <input type="number" value={form.setting_c || ''} onChange={e => setForm(p => ({ ...p, setting_c: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>設定L</label>
                  <input type="number" value={form.setting_l || ''} onChange={e => setForm(p => ({ ...p, setting_l: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>設定R</label>
                  <input type="number" value={form.setting_r || ''} onChange={e => setForm(p => ({ ...p, setting_r: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>設定その他</label>
                  <input type="text" value={form.setting_other || ''} onChange={e => setForm(p => ({ ...p, setting_other: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#888', fontWeight: 'bold', marginBottom: 8, marginTop: 8 }}>景品情報</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>景品ID</label>
                  <input type="text" value={form.current_prize_id || ''} onChange={e => setForm(p => ({ ...p, current_prize_id: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>フェーズ</label>
                  <input type="text" value={form.current_phase || ''} onChange={e => setForm(p => ({ ...p, current_phase: e.target.value }))}
                    placeholder="稼働中" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>ステータス</label>
                <select value={form.is_active === false ? 'false' : 'true'}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}
                  style={inputStyle}>
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>メモ</label>
            <input type="text" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={inputStyle} />
          </div>

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
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>ブース管理 <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span></div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {machine?.machine_name || machineCode} — {booths.length} ブース
          </div>
        </div>
        <button onClick={startNew}
          style={{ background: '#4a9eff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          + 追加
        </button>
      </div>

      {msg && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
          {msg}
        </div>
      )}

      <div style={{ padding: '12px 16px' }}>
        {booths.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>ブースが登録されていません</div>
        ) : booths.map(b => (
          <div key={b.booth_code} onClick={() => startEdit(b)} style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
            padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: 16, color: '#4a9eff', marginRight: 10 }}>
                  B{String(b.booth_number).padStart(2, '0')}
                </span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: b.is_active ? 'rgba(68,170,68,0.15)' : 'rgba(255,68,68,0.15)',
                  color: b.is_active ? '#44aa44' : '#ff4444',
                }}>
                  {b.is_active ? '有効' : '無効'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{b.booth_code.slice(0, 6)}…</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {b.play_price != null && <span style={{ fontSize: 11, color: '#aaa' }}>¥{Number(b.play_price).toLocaleString()}</span>}
              {b.current_prize_id && <span style={{ fontSize: 11, background: '#252525', padding: '1px 6px', borderRadius: 4, color: '#cc88ff' }}>景品: {b.current_prize_id}</span>}
              {b.current_phase && <span style={{ fontSize: 11, background: '#252525', padding: '1px 6px', borderRadius: 4, color: '#88ccaa' }}>{b.current_phase}</span>}
              {b.meter_in_shared && <span style={{ fontSize: 11, background: '#2a2525', padding: '1px 6px', borderRadius: 4, color: '#cc8844' }}>IN共有</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
