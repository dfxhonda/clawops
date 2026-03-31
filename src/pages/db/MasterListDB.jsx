import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import DBHeader from '../../components/DBHeader'

/**
 * 汎用マスタ管理コンポーネント
 * props:
 *   table       - Supabaseテーブル名
 *   title       - ページタイトル
 *   pkField     - 主キーフィールド名 (default: 'type_id')
 *   fields      - フィールド定義配列 [{ key, label, type, required, placeholder, options }]
 *   orderField  - ソートフィールド (default: 'sort_order')
 *   canDelete   - 削除可能か (default: true)
 */
export default function MasterListDB({ table, title, pkField = 'type_id', fields, orderField = 'sort_order', canDelete = true }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(table).select('*').order(orderField)
    if (error) { setMsg('読み込みエラー: ' + error.message); setLoading(false); return }
    setRows(data || [])
    setLoading(false)
  }, [table, orderField])

  useEffect(() => { load() }, [load])

  function startNew() {
    const init = {}
    fields.forEach(f => { init[f.key] = f.default ?? '' })
    setForm(init)
    setEditing('new')
    setMsg('')
  }

  function startEdit(row) {
    const init = {}
    fields.forEach(f => { init[f.key] = row[f.key] ?? '' })
    init[pkField] = row[pkField]
    setForm(init)
    setEditing(row)
    setMsg('')
  }

  async function handleSave() {
    const pk = form[pkField]?.toString().trim()
    if (!pk) { setMsg(`${fields.find(f => f.key === pkField)?.label || 'ID'}は必須です`); return }
    for (const f of fields) {
      if (f.required && !form[f.key]?.toString().trim()) { setMsg(`${f.label}は必須です`); return }
    }

    setSaving(true)
    try {
      const row = {}
      fields.forEach(f => {
        const v = form[f.key]
        if (f.type === 'number') row[f.key] = v !== '' ? Number(v) : null
        else if (f.type === 'boolean') row[f.key] = v === true || v === 'true'
        else row[f.key] = v?.toString().trim() || null
      })

      if (editing === 'new') {
        row[pkField] = pk.toUpperCase()
        const { error } = await supabase.from(table).insert(row)
        if (error) throw error
        setMsg('追加しました')
      } else {
        const { error } = await supabase.from(table).update(row).eq(pkField, editing[pkField])
        if (error) throw error
        setMsg('更新しました')
      }
      setEditing(null)
      await load()
    } catch (e) {
      setMsg('保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  async function handleDelete(row) {
    if (!confirm(`「${row[fields[0]?.key] || row[pkField]}」を削除しますか？`)) return
    const { error } = await supabase.from(table).delete().eq(pkField, row[pkField])
    if (error) { setMsg('削除エラー: ' + error.message); return }
    setMsg('削除しました')
    await load()
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
            {editing === 'new' ? `${title} 追加` : `${title} 編集`}
            <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal', marginLeft: 6 }}>Supabase</span>
          </div>
        </div>

        {msg && (
          <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
            {msg}
          </div>
        )}

        <div style={{ padding: '16px' }}>
          {/* PK field */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{fields.find(f => f.key === pkField)?.label || 'ID'} <span style={{ color: '#ff6666' }}>*</span></label>
            <input type="text" value={form[pkField] || ''} disabled={editing !== 'new'}
              onChange={e => setForm(p => ({ ...p, [pkField]: e.target.value }))}
              style={{ ...inputStyle, opacity: editing !== 'new' ? 0.5 : 1 }} />
            {editing === 'new' && <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>英数字・アンダースコア（自動大文字化）</div>}
          </div>

          {fields.filter(f => f.key !== pkField).map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{f.label} {f.required && <span style={{ color: '#ff6666' }}>*</span>}</label>
              {f.options ? (
                <select value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'boolean' ? (
                <select value={form[f.key] === true || form[f.key] === 'true' ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value === 'true' }))} style={inputStyle}>
                  <option value="true">はい</option>
                  <option value="false">いいえ</option>
                </select>
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'} value={form[f.key] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || ''} style={inputStyle} />
              )}
            </div>
          ))}

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
  const nameField = fields.find(f => f.key !== pkField && f.type !== 'number' && f.type !== 'boolean')
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      <DBHeader title={`${title}管理`} subtitle={`${rows.length} 件`}>
        <button onClick={startNew}
          style={{ background: '#4a9eff', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          + 追加
        </button>
      </DBHeader>

      {msg && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: msg.includes('エラー') ? '#3a1a1a' : '#1a2a1a', border: `1px solid ${msg.includes('エラー') ? '#ff4444' : '#44aa44'}`, borderRadius: 10, fontSize: 13, color: msg.includes('エラー') ? '#ff8888' : '#88cc88' }}>
          {msg}
        </div>
      )}

      <div style={{ padding: '12px 16px' }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>データがありません</div>
        ) : rows.map(row => (
          <div key={row[pkField]} style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
            padding: '12px 14px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => startEdit(row)}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {nameField ? row[nameField.key] : row[pkField]}
              </div>
              <span style={{ fontSize: 11, color: '#4a9eff', fontFamily: 'monospace' }}>{row[pkField]}</span>
            </div>
            <button onClick={() => startEdit(row)}
              style={{ background: '#252535', border: '1px solid #3a3a5a', color: '#8888ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              編集
            </button>
            {canDelete && (
              <button onClick={() => handleDelete(row)}
                style={{ background: '#352525', border: '1px solid #5a3a3a', color: '#ff6666', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                削除
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
