import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllStores, getMachines } from '../../services/masters'
import { getAllMachineLockers, addLocker, deleteLocker, activateLocker, updateLocker } from '../../services/patrol'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../../components/AdminNav'

export default function LockerList() {
  const navigate = useNavigate()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState(() => sessionStorage.getItem('admin_locker_store') || '')
  const [machines, setMachines] = useState([])
  const [machineCode, setMachineCode] = useState(() => sessionStorage.getItem('admin_locker_machine') || '')
  const [lockers, setLockers] = useState([])
  const [loading, setLoading] = useState(false)
  const [slotCount, setSlotCount] = useState('5')
  const [lockType, setLockType] = useState('key')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editSlot, setEditSlot] = useState('5')
  const [editLockType, setEditLockType] = useState('key')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    getAllStores().then(setStores)
  }, [])

  useEffect(() => {
    if (!storeCode) {
      setMachines([])
      setMachineCode('')
      return
    }
    sessionStorage.setItem('admin_locker_store', storeCode)
    getMachines(storeCode).then(list => {
      setMachines(list)
      const codes = list.map(m => m.machine_code)
      if (machineCode && !codes.includes(machineCode)) {
        setMachineCode('')
        sessionStorage.removeItem('admin_locker_machine')
      }
    })
  }, [storeCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!machineCode) {
      setLockers([])
      return
    }
    sessionStorage.setItem('admin_locker_machine', machineCode)
    setLoading(true)
    getAllMachineLockers(machineCode).then(data => {
      setLockers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [machineCode])

  const reloadLockers = () => {
    setLoading(true)
    getAllMachineLockers(machineCode).then(data => {
      setLockers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const handleActivate = async (lockerId) => {
    try {
      await activateLocker(lockerId)
      reloadLockers()
    } catch (err) {
      alert(err.message || '有効化に失敗しました')
    }
  }

  const handleDelete = async (lockerId) => {
    if (!window.confirm('このロッカーを削除しますか？')) return
    try {
      await deleteLocker(lockerId)
      reloadLockers()
    } catch (err) {
      alert(err.message || '削除に失敗しました')
    }
  }

  const nextLockerNumber = lockers.length > 0
    ? Math.max(...lockers.map(l => l.locker_number)) + 1
    : 1

  const handleAdd = async () => {
    setSaving(true)
    setFormError('')
    try {
      const lockerNumber = nextLockerNumber
      await addLocker({
        machineCode,
        storeCode,
        lockerNumber,
        slotCount: Number(slotCount),
        lockType,
      })
      reloadLockers()
    } catch (err) {
      setFormError(err.message || '追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleEditStart = (locker) => {
    setEditingId(locker.locker_id)
    setEditSlot(String(locker.slot_count))
    setEditLockType(locker.lock_type)
  }

  const handleEditCancel = () => setEditingId(null)

  const handleEditSave = async (lockerId) => {
    setEditSaving(true)
    try {
      await updateLocker(lockerId, { slotCount: Number(editSlot), lockType: editLockType })
      setEditingId(null)
      reloadLockers()
    } catch (err) {
      alert(err.message || '更新に失敗しました')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">

      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">ロッカー登録</h2>
          <p className="text-[11px] text-muted">ガチャ機のロッカー設定</p>
        </div>
        <LogoutButton />
      </div>
      <AdminNav />

      <div className="flex-1 overflow-y-auto pb-16">
      <div className="px-4 mt-4 space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">店舗</label>
          <select
            value={storeCode}
            onChange={e => setStoreCode(e.target.value)}
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">-- 店舗を選択 --</option>
            {stores.map(s => (
              <option key={s.store_code} value={s.store_code}>
                {s.store_name} ({s.store_code})
              </option>
            ))}
          </select>
        </div>

        {storeCode && (
          <div>
            <label className="block text-xs text-muted mb-1">機械</label>
            <select
              value={machineCode}
              onChange={e => setMachineCode(e.target.value)}
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">-- 機械を選択 --</option>
              {machines.map(m => (
                <option key={m.machine_code} value={m.machine_code}>
                  {m.machine_name || m.machine_code} ({m.machine_code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {machineCode && loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-muted text-sm">読み込み中...</p>
        </div>
      )}

      {machineCode && !loading && lockers.length === 0 && (
        <div className="text-center py-10 text-muted text-sm">
          ロッカーが登録されていません
        </div>
      )}

      {machineCode && !loading && lockers.map(locker => (
        <div key={locker.locker_id}
          className={`bg-surface border border-border rounded-xl p-3.5 mx-4 mt-2 ${!locker.is_active ? 'opacity-40' : ''}`}>
          {editingId === locker.locker_id ? (
            <div className="space-y-2">
              <p className="font-bold text-sm text-text">ロッカー{locker.locker_number} 編集</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">スロット数</label>
                  <select
                    value={editSlot}
                    onChange={e => setEditSlot(e.target.value)}
                    className="w-full bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="5">5</option>
                    <option value="8">8</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">ロック種別</label>
                  <select
                    value={editLockType}
                    onChange={e => setEditLockType(e.target.value)}
                    className="w-full bg-surface2 border border-border text-text rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="key">鍵式</option>
                    <option value="pin">暗証番号</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditSave(locker.locker_id)}
                  disabled={editSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-1.5 rounded-lg text-xs transition-colors"
                >
                  {editSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleEditCancel}
                  disabled={editSaving}
                  className="flex-1 border border-border text-muted py-1.5 rounded-lg text-xs hover:bg-surface2 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-text">ロッカー{locker.locker_number}</p>
                  {!locker.is_active && (
                    <span className="text-[10px] text-muted border border-border rounded px-1">無効</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>{locker.slot_count}スロット</span>
                  <span>{locker.lock_type === 'key' ? '鍵式' : '暗証番号'}</span>
                </div>
              </div>
              {locker.is_active ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleEditStart(locker)}
                    className="text-xs text-accent border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(locker.locker_id)}
                    className="text-xs text-accent2 border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors"
                  >
                    削除
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleActivate(locker.locker_id)}
                  className="text-xs text-green-400 border border-green-400/40 rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors shrink-0"
                >
                  有効化
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {machineCode && !loading && (
        <div className="bg-surface border border-border rounded-xl p-4 mx-4 mt-4 space-y-3">
          <p className="text-sm font-bold text-text">ロッカーを追加</p>

          <div>
            <label className="block text-xs text-muted mb-1">ロッカー番号</label>
            <p className="text-sm text-text px-3 py-2 bg-surface2 border border-border rounded-lg">
              ロッカー番号: {nextLockerNumber}
            </p>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">スロット数</label>
            <select
              value={slotCount}
              onChange={e => setSlotCount(e.target.value)}
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="5">5</option>
              <option value="8">8</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">ロック種別</label>
            <select
              value={lockType}
              onChange={e => setLockType(e.target.value)}
              className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="key">鍵式</option>
              <option value="pin">暗証番号</option>
            </select>
          </div>

          {formError && <p className="text-accent2 text-xs">{formError}</p>}

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors"
          >
            {saving ? '追加中...' : '追加'}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
