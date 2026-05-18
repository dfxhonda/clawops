import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AlertSheetModal({ open, onClose, boothCode, machineCode, storeCode, readingId = null, photoUrl = null, orgId, staffId }) {
  const [types, setTypes]           = useState([])
  const [selectedCode, setSelected] = useState(null)
  const [note, setNote]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('alert_types')
      .select('type_code,label,icon_emoji,color_hex,sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setTypes(data) })
    setSelected(null)
    setNote('')
    setSaved(false)
  }, [open])

  async function handleSave() {
    if (!selectedCode || saving) return
    setSaving(true)
    try {
      const { error } = await supabase.from('booth_alerts').insert({
        booth_code:      boothCode,
        machine_code:    machineCode,
        store_code:      storeCode,
        type_code:       selectedCode,
        note:            note.trim() || null,
        reading_id:      readingId ?? null,
        photo_url:       photoUrl ?? null,
        organization_id: orgId,
        created_by:      staffId ?? null,
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 800)
    } catch (e) {
      console.error('[ERR-ALERT-001] alert save failed', e)
      alert('記録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-[#1e1e2e] rounded-t-2xl px-4 pb-10 pt-5">
        <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
        <p className="text-center text-base font-bold text-white mb-1">気づきを記録</p>
        <p className="text-center text-xs text-slate-400 mb-4">{boothCode}</p>

        {saved ? (
          <div className="text-center py-6 text-green-400 text-lg font-bold">記録しました ✓</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {types.map(t => (
                <button
                  key={t.type_code}
                  type="button"
                  onClick={() => setSelected(t.type_code)}
                  className="py-3 px-2 rounded-xl text-center transition-all"
                  style={{
                    border: `2px solid ${selectedCode === t.type_code ? t.color_hex : '#333'}`,
                    background: selectedCode === t.type_code ? `${t.color_hex}22` : '#2a2a3e',
                    color: selectedCode === t.type_code ? t.color_hex : '#aaa',
                  }}
                >
                  <span className="block text-2xl mb-1">{t.icon_emoji}</span>
                  <span className="text-sm font-bold">{t.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="詳細 (任意)"
              rows={2}
              className="w-full bg-[#2a2a3e] border border-slate-600 rounded-xl text-slate-200 text-sm px-3 py-2.5 resize-none mb-4 outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedCode || saving}
                className="flex-[2] py-3 rounded-xl text-sm font-bold transition-colors"
                style={{
                  background: selectedCode && !saving ? '#22c55e' : '#2a2a44',
                  color:      selectedCode && !saving ? '#000'    : '#555',
                  cursor:     selectedCode            ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
