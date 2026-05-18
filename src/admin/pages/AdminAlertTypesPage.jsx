import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'

const EMPTY_FORM = {
  type_code: '', label: '', icon_emoji: '', color_hex: '#888888', sort_order: 0, is_active: true,
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[10px] text-muted">{label}</span>}
      {children}
    </div>
  )
}

function TInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text w-full"
    />
  )
}

export default function AdminAlertTypesPage() {
  const navigate = useNavigate()
  const { staffName } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('alert_types')
      .select('*')
      .order('sort_order')
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) { setError(e.message); setLoading(false); return }
        setRows(data ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [loadKey])

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  function openEdit(row) {
    setForm({ ...row })
    setModal('edit')
    setError(null)
  }

  async function handleSave() {
    if (!form.type_code.trim() || !form.label.trim()) {
      setError('種別コードとラベルは必須です')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (modal === 'new') {
        const { error: e } = await supabase.from('alert_types').insert({
          ...form,
          type_code:  form.type_code.trim(),
          label:      form.label.trim(),
          sort_order: Number(form.sort_order) || 0,
          organization_id: DFX_ORG_ID,
        })
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('alert_types')
          .update({
            label:      form.label.trim(),
            icon_emoji: form.icon_emoji,
            color_hex:  form.color_hex,
            sort_order: Number(form.sort_order) || 0,
            is_active:  form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('type_id', form.type_id)
        if (e) throw e
      }
      setModal(null)
      setLoadKey(k => k + 1)
    } catch (e) {
      console.error('[ERR-ALERT-004] save failed', e)
      setError(e.message ?? '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(row) {
    const { error: e } = await supabase.from('alert_types')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('type_id', row.type_id)
    if (e) { console.error('[ERR-ALERT-004] toggle failed', e); return }
    setLoadKey(k => k + 1)
  }

  async function handleMove(row, dir) {
    const idx = rows.findIndex(r => r.type_id === row.type_id)
    const target = rows[idx + dir]
    if (!target) return
    const updates = [
      supabase.from('alert_types').update({ sort_order: target.sort_order, updated_at: new Date().toISOString() }).eq('type_id', row.type_id),
      supabase.from('alert_types').update({ sort_order: row.sort_order, updated_at: new Date().toISOString() }).eq('type_id', target.type_id),
    ]
    await Promise.all(updates)
    setLoadKey(k => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-muted text-sm">← 戻る</button>
        <h1 className="text-base font-bold flex-1">アラート種別マスタ</h1>
        <button type="button" onClick={openNew} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">＋ 新規</button>
      </div>

      <div className="px-4 py-4">
        {loading && <p className="text-center text-muted py-8">読み込み中…</p>}
        {!loading && error && <p className="text-red-400 text-xs mb-4">{error}</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted py-8">種別がありません</p>}

        {!loading && rows.map((row, idx) => (
          <div key={row.type_id} className={`border border-border rounded-xl px-3 py-3 mb-2 bg-surface flex items-center gap-3 ${!row.is_active ? 'opacity-50' : ''}`}>
            <span className="text-xl shrink-0">{row.icon_emoji || '•'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: row.color_hex }}>{row.label}</span>
                {!row.is_active && <span className="text-[10px] text-muted border border-border rounded px-1">無効</span>}
              </div>
              <p className="text-[10px] text-muted">{row.type_code} · order {row.sort_order}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => handleMove(row, -1)} disabled={idx === 0} className="px-2 py-1 text-xs text-muted border border-border rounded disabled:opacity-30">▲</button>
              <button type="button" onClick={() => handleMove(row, 1)} disabled={idx === rows.length - 1} className="px-2 py-1 text-xs text-muted border border-border rounded disabled:opacity-30">▼</button>
              <button type="button" onClick={() => openEdit(row)} className="px-2 py-1 text-xs text-muted border border-border rounded">編集</button>
              <button type="button" onClick={() => handleToggleActive(row)} className={`px-2 py-1 text-xs border rounded ${row.is_active ? 'text-red-400 border-red-400/40' : 'text-emerald-400 border-emerald-400/40'}`}>
                {row.is_active ? '無効化' : '有効化'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 新規/編集モーダル */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(null)} />
          <div className="relative w-full bg-surface rounded-t-2xl px-4 pb-10 pt-5 space-y-3">
            <p className="font-bold text-base mb-2">{modal === 'new' ? '新規アラート種別' : '編集'}</p>

            <Field label="種別コード (英数字・アンダースコア)">
              <TInput
                value={form.type_code}
                onChange={v => setForm(f => ({ ...f, type_code: v }))}
                placeholder="例: prize_shortage"
                readOnly={modal === 'edit'}
              />
            </Field>

            <Field label="ラベル (表示名)">
              <TInput value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="例: 景品不足" />
            </Field>

            <Field label="アイコン絵文字">
              <TInput value={form.icon_emoji} onChange={v => setForm(f => ({ ...f, icon_emoji: v }))} placeholder="例: 🎁" />
            </Field>

            <Field label="カラー (hex)">
              <div className="flex gap-2 items-center">
                <TInput value={form.color_hex} onChange={v => setForm(f => ({ ...f, color_hex: v }))} placeholder="#fbbf24" />
                <input type="color" value={form.color_hex} onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))} className="w-8 h-8 rounded border-0 cursor-pointer" />
              </div>
            </Field>

            <Field label="並び順 (数値小さいほど上)">
              <TInput type="number" value={String(form.sort_order)} onChange={v => setForm(f => ({ ...f, sort_order: Number(v) || 0 }))} />
            </Field>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl bg-bg border border-border text-muted text-sm font-bold">キャンセル</button>
              <button type="button" onClick={handleSave} disabled={saving} className="flex-[2] py-3 rounded-xl bg-blue-600 text-white text-sm font-bold">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
