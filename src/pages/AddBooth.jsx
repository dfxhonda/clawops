import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { getStores, getMachines, getNextBoothNumber, addBooth } from '../services/masters'

export default function AddBooth() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [machines, setMachines] = useState([])
  const [machineCode, setMachineCode] = useState('')
  const [boothNumber, setBoothNumber] = useState('')
  const [autoBoothNumber, setAutoBoothNumber] = useState(null)
  const [boothCodePreview, setBoothCodePreview] = useState('')
  const [playPrice, setPlayPrice] = useState('')
  const [meterIn, setMeterIn] = useState('7')
  const [meterOut, setMeterOut] = useState('7')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCode, setSavedCode] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    getStores().then(s => setStores(s))
  }, [])

  useEffect(() => {
    if (!storeCode) { setMachines([]); setMachineCode(''); return }
    getMachines(storeCode).then(m => { setMachines(m); setMachineCode('') })
  }, [storeCode])

  useEffect(() => {
    if (!machineCode) { setAutoBoothNumber(null); setBoothCodePreview(''); return }
    getNextBoothNumber(machineCode).then(n => {
      setAutoBoothNumber(n)
      setBoothNumber('')
    })
  }, [machineCode])

  useEffect(() => {
    if (!machineCode) { setBoothCodePreview(''); return }
    const n = boothNumber ? parseInt(boothNumber, 10) : autoBoothNumber
    if (!n) { setBoothCodePreview(''); return }
    const suffix = machineCode.split('-').slice(1).join('-')
    const stCode = machineCode.split('-')[0]
    setBoothCodePreview(`${stCode}-${suffix}-B${String(n).padStart(2, '0')}`)
  }, [machineCode, boothNumber, autoBoothNumber])

  function reset() {
    setStoreCode(''); setMachineCode(''); setBoothNumber(''); setAutoBoothNumber(null)
    setBoothCodePreview(''); setPlayPrice(''); setMeterIn('7'); setMeterOut('7')
    setSaved(false); setSavedCode('')
  }

  async function handleSave() {
    setError(null)
    if (!storeCode) { setError('店舗を選択してください'); return }
    if (!machineCode) { setError('機械を選択してください'); return }
    const n = boothNumber ? parseInt(boothNumber, 10) : autoBoothNumber
    if (!n || n < 1 || n > 99) { setError('ブース番号は1〜99で入力してください'); return }
    const inD = parseInt(meterIn, 10)
    const outD = parseInt(meterOut, 10)
    if (isNaN(inD) || inD < 6 || inD > 8) { setError('INメーター桁数は6〜8で入力してください'); return }
    if (isNaN(outD) || outD < 6 || outD > 8) { setError('OUTメーター桁数は6〜8で入力してください'); return }
    const price = playPrice ? parseInt(playPrice, 10) : null
    if (playPrice && (isNaN(price) || price < 1 || price > 9999)) {
      setError('遊技価格は1〜9999で入力してください'); return
    }
    setSaving(true)
    try {
      const data = await addBooth({
        machine_code: machineCode,
        store_code: storeCode,
        booth_number: n,
        play_price: price,
        meter_in_number: inD,
        meter_out_number: outD,
      })
      setSavedCode(data.booth_code)
      setSaved(true)
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full p-3 text-base rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"
  const selectedMachine = machines.find(m => m.machine_code === machineCode)

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 pt-4">
        <div className="bg-surface border border-border rounded-xl text-center p-8 mt-8">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-accent3 font-bold text-lg mb-2">ブースを追加しました</h3>
          <p className="text-muted text-sm mb-1">{savedCode}</p>
          <button onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mb-2 mt-6">
            続けて追加
          </button>
          <button onClick={() => navigate('/admin')}
            className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl">
            メニューに戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/admin')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-accent">ブース追加</h2>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {error && (
          <div className="mb-3 px-4 py-3 bg-accent2/10 border border-accent2 text-accent2 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div>
            <div className="text-xs text-muted mb-1">店舗 *</div>
            <select value={storeCode} onChange={e => setStoreCode(e.target.value)}
              className={inputCls + ' [color-scheme:dark]'}>
              <option value="">店舗を選択</option>
              {stores.map(s => (
                <option key={s.store_code} value={s.store_code}>{s.store_name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">機械 *</div>
            <select value={machineCode} onChange={e => setMachineCode(e.target.value)}
              disabled={!storeCode}
              className={inputCls + ' [color-scheme:dark] disabled:opacity-50'}>
              <option value="">機械を選択</option>
              {machines.map(m => (
                <option key={m.machine_code} value={m.machine_code}>{m.machine_name} ({m.machine_code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted mb-1">
                ブース番号
                {autoBoothNumber && !boothNumber && (
                  <span className="text-amber-500 ml-1">空欄 = {autoBoothNumber}（自動）</span>
                )}
              </div>
              <input className={inputCls} type="number" inputMode="numeric"
                placeholder={autoBoothNumber ? String(autoBoothNumber) : '1'}
                value={boothNumber} onChange={e => setBoothNumber(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">ブースコード（自動）</div>
              <div className="w-full p-3 text-sm rounded-lg border-2 border-border bg-surface3 text-muted truncate">
                {boothCodePreview || '機械選択後に確定'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted mb-1">INメーター桁数</div>
              <select value={meterIn} onChange={e => setMeterIn(e.target.value)}
                className={inputCls + ' [color-scheme:dark]'}>
                <option value="6">6桁</option>
                <option value="7">7桁</option>
                <option value="8">8桁</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">OUTメーター桁数</div>
              <select value={meterOut} onChange={e => setMeterOut(e.target.value)}
                className={inputCls + ' [color-scheme:dark]'}>
                <option value="6">6桁</option>
                <option value="7">7桁</option>
                <option value="8">8桁</option>
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">
              遊技価格（円）
              {selectedMachine && !playPrice && (
                <span className="text-amber-500 ml-1">空欄 = 機械から継承（¥{selectedMachine.default_price}）</span>
              )}
            </div>
            <input className={inputCls} type="number" inputMode="numeric"
              placeholder={selectedMachine ? String(selectedMachine.default_price) : '100'}
              value={playPrice} onChange={e => setPlayPrice(e.target.value)} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors">
            {saving ? '保存中...' : 'ブースを追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
