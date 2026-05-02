import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllStores, getMachines, getBooths, updateBooth } from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'
import AdminNav from '../components/AdminNav'

export default function BoothList() {
  const navigate = useNavigate()

  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState(() => sessionStorage.getItem('admin_booth_store') || '')
  const [machines, setMachines] = useState([])
  const [machineCode, setMachineCode] = useState(() => sessionStorage.getItem('admin_booth_machine') || '')
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(false)
  const [editCode, setEditCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAllStores().then(setStores)
  }, [])

  useEffect(() => {
    if (!storeCode) {
      setMachines([])
      setMachineCode('')
      return
    }
    sessionStorage.setItem('admin_booth_store', storeCode)
    getMachines(storeCode).then(list => {
      setMachines(list)
      const codes = list.map(m => m.machine_code)
      if (machineCode && !codes.includes(machineCode)) {
        setMachineCode('')
        sessionStorage.removeItem('admin_booth_machine')
      }
    })
  }, [storeCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!machineCode) {
      setBooths([])
      return
    }
    sessionStorage.setItem('admin_booth_machine', machineCode)
    setLoading(true)
    getBooths(machineCode).then(data => {
      setBooths(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [machineCode])

  const startEdit = booth => {
    setEditCode(booth.booth_code)
    setEditForm({
      play_price: booth.play_price != null ? String(booth.play_price) : '',
      meter_in_number: booth.meter_in_number ?? 7,
      meter_out_number: booth.meter_out_number ?? 7,
      is_active: true,
    })
    setEditError('')
  }

  const handleEditChange = (field, value) => setEditForm(f => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setEditError('')
    try {
      await updateBooth(editCode, {
        play_price: editForm.play_price ? Number(editForm.play_price) : null,
        meter_in_number: Number(editForm.meter_in_number) || 7,
        meter_out_number: Number(editForm.meter_out_number) || 7,
        is_active: editForm.is_active,
      })
      setEditCode(null)
      setLoading(true)
      const data = await getBooths(machineCode)
      setBooths(data)
      setLoading(false)
    } catch (err) {
      setEditError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">

      <div className="shrink-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">ブース一覧</h2>
          <p className="text-[11px] text-muted">ブース設定の確認・編集</p>
        </div>
        <LogoutButton to="/admin/menu" />
      </div>
      <AdminNav />

      <div className="flex-1 overflow-y-auto pb-16">
      <div className="px-4 mt-4 space-y-3 md:max-w-3xl md:mx-auto">
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

      {machineCode && !loading && booths.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          ブースが見つかりません
        </div>
      )}

      {machineCode && !loading && booths.map(booth => (
        <div key={booth.booth_code} className="bg-surface border border-border rounded-xl p-3.5 mx-4 md:max-w-3xl md:mx-auto mt-2">
          {editCode === booth.booth_code ? (
            <div className="space-y-3">
              <p className="text-xs font-mono text-muted">{booth.booth_code}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-muted mb-1">プレイ単価</label>
                  <input
                    type="number"
                    value={editForm.play_price}
                    onChange={e => handleEditChange('play_price', e.target.value)}
                    placeholder="100"
                    className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-muted mt-0.5">空白のままにすると機械設定を引き継ぎます</p>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">INメーター桁数</label>
                  <input
                    type="number"
                    value={editForm.meter_in_number}
                    onChange={e => handleEditChange('meter_in_number', e.target.value)}
                    min={1}
                    max={10}
                    className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">OUTメーター桁数</label>
                  <input
                    type="number"
                    value={editForm.meter_out_number}
                    onChange={e => handleEditChange('meter_out_number', e.target.value)}
                    min={1}
                    max={10}
                    className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={e => handleEditChange('is_active', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">有効</span>
              </label>

              {editError && <p className="text-accent2 text-xs">{editError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditCode(null)}
                  className="flex-1 bg-surface2 border border-border text-text font-bold py-2 rounded-xl text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">{booth.booth_code}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    'bg-green-900/40 text-green-400'
                  }`}>
                    有効
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>ブース #{booth.booth_number}</span>
                  <span>
                    単価: {booth.play_price != null ? `¥${booth.play_price}` : '—'}
                  </span>
                  <span>IN: {booth.meter_in_number}桁</span>
                  <span>OUT: {booth.meter_out_number}桁</span>
                </div>
              </div>
              <button
                onClick={() => startEdit(booth)}
                className="text-xs text-accent border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface2 transition-colors shrink-0"
              >
                編集
              </button>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
