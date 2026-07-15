import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CHANGE_ORG_ID } from '../../lib/auth/orgConstants'
import { nextMachineCode, nextBoothCode, nextBoothNumber } from '../lib/machineBoothCrud'

// J-ADMIN-MACHINE-BOOTH-CRUD-01
// 店舗詳細ドロワー: 店舗 -> 機械一覧/CRUD -> 機械 -> ブース一覧/CRUD の2層ナビ。
// UIシステムB (text-base, 44pxタップ領域)。viewport 390x844 基準。

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}{hint && <span className="ml-2 text-sm text-blue-400">{hint}</span>}</span>
      {children}
    </label>
  )
}

const inputCls = 'bg-bg border border-border rounded-lg px-3 min-h-[44px] text-base text-text w-full'

function ActivePill({ active }) {
  return (
    <span className={`px-2 py-0.5 rounded text-sm font-bold ${active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
      {active ? '有効' : '無効'}
    </span>
  )
}

export default function StoreCrudDrawer({ storeCode, storeName, onClose, onEditStore }) {
  const { staffName } = useAuth()
  const [view, setView] = useState('machines') // 'machines' | 'booths'
  const [machines, setMachines] = useState([])
  const [models, setModels] = useState([])
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null) // {kind:'machine'|'booth', mode:'new'|'edit', data:{...}}
  const [saving, setSaving] = useState(false)

  const loadMachines = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('machines')
      .select('machine_code, machine_name, model_id, is_active, store_code, machine_models(model_name), booths(booth_code)')
      .eq('store_code', storeCode)
      .order('machine_code')
    if (e) { setError(`ERR-MACHINE-CRUD-001: ${e.message}`); setLoading(false); return }
    setMachines(data ?? [])
    setLoading(false)
  }, [storeCode])

  useEffect(() => { loadMachines() }, [loadMachines])

  useEffect(() => {
    supabase.from('machine_models').select('model_id, model_name, booth_count').order('model_name')
      .then(({ data }) => setModels(data ?? []))
  }, [])

  const loadBooths = useCallback(async (machineCode) => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('booths')
      .select('booth_code, booth_number, play_price, is_active, machine_code, store_code')
      .eq('machine_code', machineCode)
      .order('booth_number')
    if (e) { setError(`ERR-BOOTH-CRUD-001: ${e.message}`); setLoading(false); return }
    setBooths(data ?? [])
    setLoading(false)
  }, [])

  function openMachineDetail(machine) {
    setSelectedMachine(machine)
    setView('booths')
    loadBooths(machine.machine_code)
  }

  function backToMachines() {
    setView('machines')
    setSelectedMachine(null)
    loadMachines()
  }

  // ---- forms ----
  function openMachineNew() {
    const code = nextMachineCode(storeCode, machines.map(m => m.machine_code))
    setForm({ kind: 'machine', mode: 'new', data: { machine_code: code, machine_name: '', model_id: '', is_active: true } })
    setError(null)
  }
  function openMachineEdit(m) {
    setForm({ kind: 'machine', mode: 'edit', data: { machine_code: m.machine_code, machine_name: m.machine_name ?? '', model_id: m.model_id ?? '', is_active: m.is_active ?? true } })
    setError(null)
  }
  function openBoothNew() {
    const code = nextBoothCode(selectedMachine.machine_code, booths.map(b => b.booth_code))
    setForm({ kind: 'booth', mode: 'new', data: { booth_code: code, booth_number: nextBoothNumber(booths), play_price: 100, is_active: true } })
    setError(null)
  }
  function openBoothEdit(b) {
    setForm({ kind: 'booth', mode: 'edit', data: { booth_code: b.booth_code, booth_number: b.booth_number, play_price: b.play_price ?? 100, is_active: b.is_active ?? true } })
    setError(null)
  }

  const setF = patch => setForm(prev => ({ ...prev, data: { ...prev.data, ...patch } }))

  async function saveForm() {
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const d = form.data
    if (form.kind === 'machine') {
      if (!d.machine_code.trim()) { setError('機械コードは必須です'); setSaving(false); return }
      if (form.mode === 'new') {
        const { error: e } = await supabase.from('machines').insert({
          machine_code: d.machine_code.trim(),
          store_code: storeCode,
          // SPEC-MACHINE-REGISTER-ORG-DEFAULT-CHANGE-01 (D-064): store と org 一致のため CHANGE org (D-063 と同型)
          organization_id: CHANGE_ORG_ID,
          machine_name: d.machine_name.trim() || null,
          model_id: d.model_id || null,
          is_active: d.is_active,
          updated_by: staffName,
          updated_at: now,
        })
        if (e) { setError(`ERR-MACHINE-CRUD-002: ${e.message}`); setSaving(false); return }
      } else {
        const { error: e } = await supabase.from('machines').update({
          machine_name: d.machine_name.trim() || null,
          model_id: d.model_id || null,
          is_active: d.is_active,
          updated_by: staffName,
          updated_at: now,
        }).eq('machine_code', d.machine_code)
        if (e) { setError(`ERR-MACHINE-CRUD-003: ${e.message}`); setSaving(false); return }
      }
      setSaving(false); setForm(null); loadMachines()
    } else {
      if (!d.booth_code.trim()) { setError('ブースコードは必須です'); setSaving(false); return }
      const boothNum = Number(d.booth_number)
      if (!Number.isFinite(boothNum) || boothNum < 1) { setError('ブース番号は1以上の数値'); setSaving(false); return }
      if (form.mode === 'new') {
        const { error: e } = await supabase.from('booths').insert({
          booth_code: d.booth_code.trim(),
          machine_code: selectedMachine.machine_code,
          store_code: storeCode,
          booth_number: boothNum,
          play_price: d.play_price === '' || d.play_price == null ? 100 : Number(d.play_price),
          is_active: d.is_active,
          meter_in_shared: false, // addendum: hardcode
          out_meter_count: 1,     // addendum: hardcode
          updated_by: staffName,
          updated_at: now,
        })
        if (e) { setError(`ERR-BOOTH-CRUD-002: ${e.message}`); setSaving(false); return }
      } else {
        const { error: e } = await supabase.from('booths').update({
          booth_number: boothNum,
          play_price: d.play_price === '' || d.play_price == null ? 100 : Number(d.play_price),
          is_active: d.is_active,
          updated_by: staffName,
          updated_at: now,
        }).eq('booth_code', d.booth_code)
        if (e) { setError(`ERR-BOOTH-CRUD-003: ${e.message}`); setSaving(false); return }
      }
      setSaving(false); setForm(null); loadBooths(selectedMachine.machine_code)
    }
  }

  async function toggleMachineActive(m) {
    setError(null)
    const { error: e } = await supabase.from('machines')
      .update({ is_active: !m.is_active, updated_by: staffName, updated_at: new Date().toISOString() })
      .eq('machine_code', m.machine_code)
    if (e) { setError(`ERR-MACHINE-CRUD-003: ${e.message}`); return }
    loadMachines()
  }

  async function toggleBoothActive(b) {
    setError(null)
    const { error: e } = await supabase.from('booths')
      .update({ is_active: !b.is_active, updated_by: staffName, updated_at: new Date().toISOString() })
      .eq('booth_code', b.booth_code)
    if (e) { setError(`ERR-BOOTH-CRUD-003: ${e.message}`); return }
    loadBooths(selectedMachine.machine_code)
  }

  const modelHint = (() => {
    const m = models.find(x => x.model_id === form?.data?.model_id)
    return m && m.booth_count != null ? `推奨ブース数: ${m.booth_count}` : null
  })()

  return (
    <div
      data-testid="store-crud-drawer"
      className="fixed inset-0 z-50 bg-black/60 flex justify-end"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg border-l border-border w-full max-w-lg h-full flex flex-col">
        {/* header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 border-b border-border" style={{ minHeight: 56 }}>
          {view === 'booths' ? (
            <button data-testid="drawer-back" onClick={backToMachines} className="text-base text-blue-400 min-h-[44px] flex items-center pr-2">← 機械一覧</button>
          ) : (
            <button data-testid="drawer-close" onClick={onClose} className="text-base text-muted min-h-[44px] flex items-center pr-2">✕</button>
          )}
          <span className="text-base font-bold text-text truncate flex-1">
            {view === 'machines' ? storeName : (selectedMachine?.machine_name || selectedMachine?.machine_code)}
          </span>
          {view === 'machines' && onEditStore && (
            <button onClick={onEditStore} className="text-sm text-muted border border-border rounded-lg px-3 min-h-[44px]">店舗情報編集</button>
          )}
        </div>

        {error && <p data-testid="drawer-error" className="text-red-400 text-sm px-4 py-2 flex-shrink-0">{error}</p>}

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="text-center text-muted text-base py-8">読込中…</p>}

          {!loading && view === 'machines' && (
            <div data-testid="machine-list" className="space-y-2">
              {machines.length === 0 && <p className="text-center text-muted text-base py-8">機械なし</p>}
              {machines.map(m => (
                <div key={m.machine_code} data-testid="machine-row" className="rounded-xl bg-surface border border-border p-3">
                  <button onClick={() => openMachineDetail(m)} className="w-full text-left flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-text truncate">{m.machine_name || m.machine_code}</span>
                        <ActivePill active={m.is_active} />
                      </div>
                      <div className="text-sm text-muted font-mono mt-0.5">{m.machine_code}</div>
                      <div className="text-sm text-muted mt-0.5">
                        {m.machine_models?.model_name || '機種未設定'} ・ ブース{m.booths?.length ?? 0}
                      </div>
                    </div>
                    <span className="text-muted text-lg">›</span>
                  </button>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openMachineEdit(m)} className="text-sm text-blue-400 border border-border rounded-lg px-3 min-h-[44px] flex-1">編集</button>
                    <button data-testid="machine-active-toggle" onClick={() => toggleMachineActive(m)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px] flex-1">
                      {m.is_active ? '無効化' : '有効化'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && view === 'booths' && (
            <div data-testid="booth-list" className="space-y-2">
              {booths.length === 0 && <p className="text-center text-muted text-base py-8">ブースなし</p>}
              {booths.map(b => (
                <div key={b.booth_code} data-testid="booth-row" className="rounded-xl bg-surface border border-border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-text">ブース {b.booth_number}</span>
                        <ActivePill active={b.is_active} />
                      </div>
                      <div className="text-sm text-muted font-mono mt-0.5">{b.booth_code}</div>
                      <div className="text-sm text-muted mt-0.5">プレイ料金 {b.play_price ?? '-'}円</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openBoothEdit(b)} className="text-sm text-blue-400 border border-border rounded-lg px-3 min-h-[44px] flex-1">編集</button>
                    <button data-testid="booth-active-toggle" onClick={() => toggleBoothActive(b)} className="text-sm text-text border border-border rounded-lg px-3 min-h-[44px] flex-1">
                      {b.is_active ? '無効化' : '有効化'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* add button (fixed footer) */}
        {!loading && (
          <div className="flex-shrink-0 p-4 border-t border-border">
            {view === 'machines' ? (
              <button data-testid="machine-add-button" onClick={openMachineNew} className="w-full bg-blue-600 text-white text-base font-bold rounded-xl min-h-[48px]">+ 機械追加</button>
            ) : (
              <button data-testid="booth-add-button" onClick={openBoothNew} className="w-full bg-blue-600 text-white text-base font-bold rounded-xl min-h-[48px]">+ ブース追加</button>
            )}
          </div>
        )}
      </div>

      {/* form modal */}
      {form && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div data-testid={form.kind === 'machine' ? 'machine-form' : 'booth-form'} className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-bold text-text">
                {form.kind === 'machine'
                  ? (form.mode === 'new' ? '機械 追加' : '機械 編集')
                  : (form.mode === 'new' ? 'ブース 追加' : 'ブース 編集')}
              </span>
              <button onClick={() => setForm(null)} className="text-muted text-xl leading-none min-h-[44px] px-2">✕</button>
            </div>

            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              {form.kind === 'machine' ? (
                <>
                  <Field label="機械コード (自動採番・上書き可)">
                    <input data-testid="machine-code-input" value={form.data.machine_code} disabled={form.mode === 'edit'}
                      onChange={e => setF({ machine_code: e.target.value })} className={`${inputCls} font-mono ${form.mode === 'edit' ? 'opacity-60' : ''}`} />
                  </Field>
                  <Field label="機械名">
                    <input data-testid="machine-name-input" value={form.data.machine_name}
                      onChange={e => setF({ machine_name: e.target.value })} className={inputCls} placeholder="機械名" />
                  </Field>
                  <Field label="機種 (model)" hint={modelHint}>
                    <select data-testid="machine-model-select" value={form.data.model_id}
                      onChange={e => setF({ model_id: e.target.value })} className={inputCls}>
                      <option value="">未設定</option>
                      {models.map(m => <option key={m.model_id} value={m.model_id}>{m.model_name}</option>)}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="ブースコード (自動採番・上書き可)">
                    <input data-testid="booth-code-input" value={form.data.booth_code} disabled={form.mode === 'edit'}
                      onChange={e => setF({ booth_code: e.target.value })} className={`${inputCls} font-mono ${form.mode === 'edit' ? 'opacity-60' : ''}`} />
                  </Field>
                  <Field label="ブース番号">
                    <input data-testid="booth-number-input" type="number" inputMode="numeric" value={form.data.booth_number}
                      onChange={e => setF({ booth_number: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="プレイ料金 (円)">
                    <input data-testid="booth-play-price-input" type="number" inputMode="numeric" value={form.data.play_price}
                      onChange={e => setF({ play_price: e.target.value })} className={inputCls} />
                  </Field>
                </>
              )}
              <label className="flex items-center gap-2 text-base text-text min-h-[44px] cursor-pointer">
                <input type="checkbox" checked={form.data.is_active} onChange={e => setF({ is_active: e.target.checked })} className="accent-accent w-5 h-5" />
                有効 (is_active)
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setForm(null)} className="flex-1 min-h-[48px] rounded-xl border border-border text-base text-muted">キャンセル</button>
              <button
                data-testid={form.kind === 'machine' ? 'machine-save-button' : 'booth-save-button'}
                onClick={saveForm} disabled={saving}
                className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
