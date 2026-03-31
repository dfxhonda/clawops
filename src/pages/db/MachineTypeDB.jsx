import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function MachineTypeDB() {
  const navigate = useNavigate()
  const [types, setTypes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadTypes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('machine_types')
      .select('*')
      .order('type_id')
    if (error) { setMsg('読み込みエラー: ' + error.message); setLoading(false); return }
    setTypes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTypes(); loadCategories() }, [loadTypes])

  async function loadCategories() {
    const { data } = await supabase.from('machine_categories').select('category_id, category_name').order('sort_order')
    setCategories(data || [])
  }

  function startNew() {
    setForm({ type_id: '', type_name: '', category: 'crane', notes: '' })
    setEditing('new')
    setMsg('')
  }

  function startEdit(t) {
    setForm({ ...t })
    setEditing(t)
    setMsg('')
  }

  async function handleSave() {
    if (!form.type_id?.trim()) { setMsg('タイプIDは必須です'); return }
    if (!form.type_name?.trim()) { setMsg('タイプ名は必須です'); return }

    setSaving(true)
    try {
      if (editing === 'new') {
        const { error } = await supabase.from('machine_types').insert({
          type_id: form.type_id.trim().toUpperCase(),
          type_name: form.type_name.trim(),
          category: form.category || 'crane',
          notes: form.notes || null,
        })
        if (error) throw error
        setMsg('タイプを追加しました')
      } else {
        const { error } = await supabase.from('machine_types').update({
          type_name: form.type_name.trim(),
          category: form.category || 'crane',
          notes: form.notes || null,
        }).eq('type_id', editing.type_id)
        if (error) throw error
        setMsg('タイプを更新しました')
      }
      setEditing(null)
      await loadTypes()
    } catch (e) {
      setMsg('保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  async function handleDelete(t) {
    if (!confirm(`「${t.type_name}」を削除しますか？`)) return
    const { error } = await supabase.from('machine_types').delete().eq('type_id', t.type_id)
    if (error) { setMsg('削除エラー: ' + error.message); return }
    setMsg('削除しました')
    await loadTypes()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
    color: '#e0e0e0', fontSize: 14, padding: '10px 12px', outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>

  // 編集/新規フォーム
  if (editing !== null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0f0f0f', borderBottom: '1px solid #2a2a2a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>‹</button>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>
            {editing === 'new' ? 'タイプ追加' : 'タイプ編集'}
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
            <label style={labelStyle}>タイプID <span style={{ color: '#ff6666' }}>*</span></label>
            <input type="text" value={form.type_id || ''} disabled={editing !== 'new'}
              onChange={e => setForm(p => ({ ...p, type_id: e.target.value }))}
              placeholder="BUZZ_CRANE_4" style={{ ...inputStyle, opacity: editing !== 'new' ? 0.5 : 1 }} />
            {editing === 'new' && <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>英数字・アンダースコアで入力（自動大文字化）</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>タイプ名 <span style={{ color: '#ff6666' }}>*</span></label>
            <input type="text" value={form.type_name || ''}
              onChange={e => setForm(p => ({ ...p, type_name: e.target.value }))}
              placeholder="バズクレーン4P" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>カテゴリ</label>
            <select value={form.category || 'crane'}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={inputStyle}>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>メモ</label>
            <input type="text" value={form.notes || ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
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
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>マシンタイプ管理 <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span></div>
          <div style={{ fontSize: 11, color: '#666' }}>{types.length} 件</div>
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
        {types.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>マシンタイプが登録されていません</div>
        ) : types.map(t => (
          <div key={t.type_id} style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
            padding: '12px 14px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => startEdit(t)} role="button">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {t.type_name}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#4a9eff', fontFamily: 'monospace' }}>{t.type_id}</span>
                <span style={{ fontSize: 11, background: '#252525', padding: '1px 6px', borderRadius: 4, color: '#aaa' }}>
                  {categories.find(c => c.category_id === t.category)?.category_name || t.category}
                </span>
              </div>
            </div>
            <button onClick={() => startEdit(t)}
              style={{ background: '#252535', border: '1px solid #3a3a5a', color: '#8888ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              編集
            </button>
            <button onClick={() => handleDelete(t)}
              style={{ background: '#352525', border: '1px solid #5a3a3a', color: '#ff6666', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
