import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllStores, getMachines } from '../../services/masters'
import { getMachineLockers, addLocker, deleteLocker } from '../../services/patrol'
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
    getMachineLockers(machineCode).then(data => {
      setLockers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [machineCode])

  const reloadLockers = () => {
    setLoading(true)
    getMachineLockers(machineCode).then(data => {
      setLockers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
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

  const handleAdd = async () => {
    setSaving(true)
    setFormError('')
    try {
      const lockerNumber = lockers.length + 1
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

  return (
    <div className="min-h-screen pb-16">

      <div className="sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">ロッカー登録</h2>
          <p className="text-[11px] text-muted">ガチャ機のロッカー設定</p>
        </div>
        <LogoutButton />
      </div>
      <AdminNav />

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
        <div key={locker.locker_id} className="bg-surface border border-border rounded-xl p-3.5 mx-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text">ロッカー{locker.locker_number}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{locker.slot_count}スロット</span>
                <span>{locker.lock_type === 'key' ? '鍵式' : '暗証番号'}</span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(locker.locker_id)}
              className="text-xs text-accent2 border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors shrink-0"
            >
              削除
            </button>
          </div>
        </div>
      ))}

      {machineCode && !loading && (
        <div className="bg-surface border border-border rounded-xl p-4 mx-4 mt-4 space-y-3">
          <p className="text-sm font-bold text-text">ロッカーを追加</p>

          <div>
            <label className="block text-xs text-muted mb-1">ロッカー番号</label>
            <p className="text-sm text-text px-3 py-2 bg-surface2 border border-border rounded-lg">
              ロッカー番号: {lockers.length + 1}
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
  )
}
