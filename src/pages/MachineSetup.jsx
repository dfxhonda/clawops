import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { getStores, getMachines, getBooths, getMachineTypes, updateMachine, deleteMachine } from '../services/masters'

const CATEGORY_COLOR = {
  crane:  'bg-blue-900/30 text-blue-400 border-blue-700',
  gacha:  'bg-purple-900/30 text-purple-400 border-purple-700',
  locker: 'bg-green-900/30 text-green-400 border-green-700',
  other:  'bg-amber-900/30 text-amber-400 border-amber-700',
}

const inputCls = "w-full p-2 text-sm rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"

function MachineRow({ machine, machineTypes, onSaved, onDeleted }) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState('')
  const [type, setType]         = useState('')
  const [rental, setRental]     = useState('')
  const [modelId, setModelId]   = useState('')
  const [price, setPrice]       = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  function startEdit() {
    setName(machine.machine_name || '')
    setType(machine.machine_type || '')
    setRental(machine.rental_code || '')
    setModelId(machine.model_id || '')
    setPrice(String(machine.default_price || 100))
    setNotes(machine.location_note || '')
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    if (!name.trim()) { setError('機械名を入力してください'); return }
    const p = parseInt(price, 10)
    if (isNaN(p) || p < 1) { setError('料金を確認してください'); return }
    setError(null)
    setSaving(true)
    try {
      await updateMachine(machine.machine_code, {
        machine_name: name.trim(),
        type_id: type || null,
        machine_number: rental.trim() || null,
        model_id: modelId.trim() || null,
        play_price: p,
        notes: notes.trim() || null,
      })
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`「${machine.machine_name}」を無効化しますか？\nブースデータは残りますが、一覧から非表示になります。`)) return
    setSaving(true)
    try {
      await deleteMachine(machine.machine_code)
      onDeleted()
    } catch (e) {
      setError(e.message || '削除に失敗しました')
      setSaving(false)
    }
  }

  const typeInfo = machineTypes.find(t => t.type_id === machine.machine_type)

  if (!editing) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-mono text-[11px] text-muted">{machine.machine_code}</span>
            {typeInfo && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[typeInfo.category] || 'bg-surface2 text-muted border-border'}`}>
                {typeInfo.type_name}
              </span>
            )}
            <span className="text-[10px] text-muted">{machine.boothCount}ブース</span>
          </div>
          <div className="text-sm font-medium truncate">{machine.machine_name || <span className="text-muted italic">名称未設定</span>}</div>
          <div className="text-[11px] text-muted mt-0.5 flex gap-2">
            {machine.rental_code && <span>{machine.rental_code}</span>}
            <span>¥{machine.default_price}</span>
            {machine.model_id && <span className="text-muted/60">{machine.model_id}</span>}
          </div>
        </div>
        <button
          onClick={startEdit}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold bg-surface2 border border-border text-muted hover:text-text hover:border-accent/40 transition-colors"
        >
          編集
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface border-2 border-accent/40 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{machine.machine_code}</span>
        <span className="text-[10px] text-accent font-bold ml-auto">編集中</span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <div className="text-[11px] text-muted mb-1">機械名 *</div>
          <input className={inputCls} type="text" placeholder="例: BUZZ4 1号機" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="w-24">
          <div className="text-[11px] text-muted mb-1">レンタルコード</div>
          <input className={inputCls} type="text" placeholder="R2001" value={rental} onChange={e => setRental(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="text-[11px] text-muted mb-1">型番</div>
        <input className={inputCls} type="text" placeholder="例: ABC-123" value={modelId} onChange={e => setModelId(e.target.value)} />
      </div>

      {machineTypes.length > 0 && (
        <div>
          <div className="text-[11px] text-muted mb-1.5">種類</div>
          <div className="flex flex-wrap gap-1.5">
            {machineTypes.map(t => (
              <button
                key={t.type_id}
                onClick={() => setType(type === t.type_id ? '' : t.type_id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all
                  ${type === t.type_id
                    ? (CATEGORY_COLOR[t.category] || 'border-accent text-accent bg-accent/10')
                    : 'border-border text-muted'}`}
              >
                {t.type_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="w-24">
          <div className="text-[11px] text-muted mb-1">料金(円)</div>
          <input className={inputCls} type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-muted mb-1">メモ</div>
          <input className={inputCls} type="text" placeholder="フロア・ゾーン等" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-xs text-accent2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-surface2 border border-border text-muted disabled:opacity-40"
        >
          キャンセル
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="px-3 py-2.5 rounded-xl text-sm border border-red-800 text-red-400 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
          title="無効化"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export default function MachineSetup() {
  const navigate = useNavigate()
  const [groups, setGroups]         = useState([])
  const [machineTypes, setMachineTypes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const [filterText, setFilterText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStore, setFilterStore] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [stores, types] = await Promise.all([getStores(), getMachineTypes()])
      setMachineTypes(types)
      const result = await Promise.all(
        stores.map(async store => {
          const machines = await getMachines(store.store_code)
          const withBooths = await Promise.all(
            machines.map(async m => {
              const booths = await getBooths(m.machine_code)
              return { ...m, boothCount: booths.length }
            })
          )
          return { store, machines: withBooths }
        })
      )
      setGroups(result.filter(g => g.machines.length > 0))
    } catch {
      setLoadError('読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stores = useMemo(() => groups.map(g => g.store), [groups])

  const allMachines = useMemo(() =>
    groups.flatMap(g => g.machines.map(m => ({ ...m, store_name: g.store.store_name }))),
    [groups]
  )

  const filtered = useMemo(() => {
    const text = filterText.toLowerCase()
    return allMachines.filter(m => {
      if (filterStore && m.store_code !== filterStore) return false
      if (filterType && m.machine_type !== filterType) return false
      if (text && !m.machine_name.toLowerCase().includes(text) && !m.machine_code.toLowerCase().includes(text)) return false
      return true
    })
  }, [allMachines, filterText, filterType, filterStore])

  const hasFilter = filterText || filterType || filterStore

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">機械一覧を読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-4 pb-16">

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted hover:text-accent">←</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">機械設定</h2>
          <p className="text-xs text-muted">{allMachines.length}台登録済み</p>
        </div>
        <LogoutButton />
      </div>

      {/* フィルター */}
      <div className="bg-surface border border-border rounded-xl p-3 mb-3 space-y-2">
        <input
          type="text"
          placeholder="機械名・コードで絞り込み"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <select
            value={filterStore}
            onChange={e => setFilterStore(e.target.value)}
            className="flex-1 bg-surface2 border border-border rounded-lg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">全店舗</option>
            {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="flex-1 bg-surface2 border border-border rounded-lg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">全種類</option>
            {machineTypes.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{filtered.length}件</span>
          {hasFilter && (
            <button
              onClick={() => { setFilterText(''); setFilterType(''); setFilterStore('') }}
              className="text-xs text-accent"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="bg-accent2/15 border border-accent2 rounded-xl p-3 mb-3">
          <p className="text-accent2 text-sm">{loadError}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(m => (
          <MachineRow
            key={m.machine_code}
            machine={m}
            machineTypes={machineTypes}
            onSaved={load}
            onDeleted={load}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted text-sm">
            {hasFilter ? '該当する機械がありません' : '機械が登録されていません'}
          </div>
        )}
      </div>

    </div>
  )
}
