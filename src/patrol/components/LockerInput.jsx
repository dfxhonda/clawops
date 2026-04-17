import { useState } from 'react'
import { saveLockerRestocks } from '../../services/patrol'

export default function LockerInput({ lockers, machineCode, storeCode, staffId, onDone }) {
  const [counts, setCounts] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const restocks = lockers
        .filter(l => counts[l.locker_id] && parseInt(counts[l.locker_id]) > 0)
        .map(l => ({
          locker_id: l.locker_id,
          machine_code: machineCode,
          store_code: storeCode,
          restocked_slots: parseInt(counts[l.locker_id]),
          read_time: new Date().toISOString(),
          recorded_by: staffId || null,
        }))
      await saveLockerRestocks(restocks)
      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mt-4">
      <div className="text-sm font-bold text-muted mb-3">🔐 ロッカー補充</div>
      {lockers.map(locker => (
        <div key={locker.locker_id} className="mb-3">
          <label className="block text-sm text-muted mb-1">
            ロッカー{locker.locker_number}
            （{locker.slot_count}スロット・{locker.lock_type === 'key' ? '鍵式' : '暗証番号'}）
          </label>
          <input
            type="number" inputMode="numeric" min="0" max={locker.slot_count}
            value={counts[locker.locker_id] || ''}
            onChange={e => setCounts(p => ({ ...p, [locker.locker_id]: e.target.value }))}
            className="w-20 bg-surface2 border border-border rounded-lg px-3 py-2 text-center text-text outline-none focus:border-accent"
            placeholder="0"
          />
        </div>
      ))}
      {error && <p className="text-accent2 text-sm mb-2">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
          {saving ? '保存中...' : 'ロッカー保存'}
        </button>
        <button
          onClick={onDone}
          className="flex-1 bg-surface2 border border-border text-muted font-medium py-3 rounded-xl">
          スキップ
        </button>
      </div>
    </div>
  )
}
