import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { getStores, getMachines, getBooths, getMachineTypes, updateMachine, deleteMachine } from '../services/masters'

const CATEGORY_COLOR = {
  crane:  'border-blue-500 text-blue-400 bg-blue-900/20',
  gacha:  'border-purple-500 text-purple-400 bg-purple-900/20',
  other:  'border-amber-500 text-amber-400 bg-amber-900/20',
}

function MachineCard({ machine, boothCount, machineTypes }) {
  const [name, setName]       = useState(machine.machine_name || '')
  const [type, setType]       = useState(machine.machine_type || '')
  const [price, setPrice]     = useState(String(machine.default_price || 100))
  const [notes, setNotes]     = useState(machine.location_note || '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState(null)

  const dirty = name !== (machine.machine_name || '') ||
    type !== (machine.machine_type || '') ||
    price !== String(machine.default_price || 100) ||
    notes !== (machine.location_note || '')

  async function handleDelete() {
    if (!window.confirm(`「${name}」を無効化しますか？\nブースデータは残りますが、一覧から非表示になります。`)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMachine(machine.machine_code)
      window.location.reload()
    } catch (e) {
      setError(e.message || '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
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
        play_price: p,
        notes: notes.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full p-2.5 text-sm rounded-lg border border-border bg-surface2 text-text outline-none focus:border-accent"

  return (
    <div className={`bg-surface border rounded-xl p-3.5 space-y-3 ${dirty ? 'border-accent/50' : 'border-border'}`}>
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs bg-surface2 px-2 py-0.5 rounded text-muted">
          {machine.machine_code}
        </span>
        <span className="text-xs text-muted">{boothCount}ブース</span>
        {dirty && <span className="text-[10px] text-accent ml-auto">未保存</span>}
      </div>

      {/* 機械名 */}
      <div>
        <div className="text-[11px] text-muted mb-1">機械名 *</div>
        <input
          className={inputCls}
          type="text"
          placeholder="例: BUZZ4 1号機、ガチャコロ #1"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* 種類 */}
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

      {/* 料金 + メモ */}
      <div className="flex gap-2">
        <div className="w-24">
          <div className="text-[11px] text-muted mb-1">料金(円)</div>
          <input
            className={inputCls}
            type="number"
            inputMode="numeric"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-muted mb-1">メモ</div>
          <input
            className={inputCls}
            type="text"
            placeholder="フロア・ゾーン等"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-accent2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors
            ${saved ? 'bg-green-700 text-white' :
              dirty ? 'bg-blue-600 hover:bg-blue-700 text-white' :
              'bg-surface2 text-muted cursor-not-allowed'}`}
        >
          {saving ? '保存中...' : saved ? '✅ 保存済み' : dirty ? '保存' : '変更なし'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || saving}
          className="px-3 py-2.5 rounded-xl text-sm font-bold border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
          title="この機械を無効化"
        >
          {deleting ? '…' : '🗑'}
        </button>
      </div>
    </div>
  )
}

export default function MachineSetup() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [machineTypes, setMachineTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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
      setLoading(false)
    }
    load()
  }, [])

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
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted hover:text-accent">←</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">機械設定</h2>
          <p className="text-xs text-muted">各機械の名前・種類・料金を設定してください</p>
        </div>
        <LogoutButton />
      </div>

      <div className="space-y-6">
        {groups.map(({ store, machines }) => (
          <div key={store.store_code}>
            <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2 px-1">
              {store.store_name}
            </div>
            <div className="space-y-3">
              {machines.map(m => (
                <MachineCard key={m.machine_code} machine={m} boothCount={m.boothCount} machineTypes={machineTypes} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
