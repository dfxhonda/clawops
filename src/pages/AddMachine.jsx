import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LogoutButton from '../components/LogoutButton'
import { getStores, getNextMachineCode, getMachineTypes, addMachine } from '../services/masters'

const CATEGORY_COLOR = {
  crane: 'border-blue-500 text-blue-400 bg-blue-900/20',
  gacha: 'border-purple-500 text-purple-400 bg-purple-900/20',
  other: 'border-amber-500 text-amber-400 bg-amber-900/20',
}

export default function AddMachine() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [machineTypes, setMachineTypes] = useState([])
  const [storeCode, setStoreCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [machineName, setMachineName] = useState('')
  const [machineNumber, setMachineNumber] = useState('')
  const [modelId, setModelId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [playPrice, setPlayPrice] = useState('100')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStores().then(s => setStores(s))
    getMachineTypes().then(t => setMachineTypes(t))
  }, [])

  useEffect(() => {
    if (!storeCode) { setNextCode(''); return }
    getNextMachineCode(storeCode).then(setNextCode)
  }, [storeCode])

  async function handleSave() {
    setError(null)
    if (!storeCode) { setError('店舗を選択してください'); return }
    if (!machineName.trim()) { setError('機械名を入力してください'); return }
    const price = parseInt(playPrice, 10)
    if (!playPrice || isNaN(price) || price < 1 || price > 9999) {
      setError('遊技価格は1〜9999で入力してください'); return
    }
    setSaving(true)
    try {
      await addMachine({
        machine_code: nextCode,
        store_code: storeCode,
        machine_name: machineName.trim(),
        machine_number: machineNumber.trim() || null,
        model_id: modelId.trim() || null,
        type_id: typeId || null,
        play_price: price,
        notes: notes.trim() || null,
      })
      setSaved(true)
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full p-3 text-base rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent"

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 pt-4">
        <div className="bg-surface border border-border rounded-xl text-center p-8 mt-8">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-accent3 font-bold text-lg mb-2">機械を追加しました</h3>
          <p className="text-muted text-sm mb-1">{nextCode} — {machineName}</p>
          <button onClick={() => { setSaved(false); setMachineName(''); setMachineNumber(''); setModelId(''); setTypeId(''); setPlayPrice('100'); setNotes(''); setStoreCode('') }}
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
            <h2 className="text-lg font-bold text-accent">機械追加</h2>
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
            <div className="text-xs text-muted mb-1">機械コード（自動）</div>
            <div className="w-full p-3 text-base rounded-lg border-2 border-border bg-surface3 text-muted">
              {nextCode || '店舗選択後に確定'}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">機械名 *</div>
            <input className={inputCls} type="text" placeholder="例: UFOキャッチャー9" value={machineName} onChange={e => setMachineName(e.target.value)} />
          </div>

          {machineTypes.length > 0 && (
            <div>
              <div className="text-xs text-muted mb-1.5">種類</div>
              <div className="flex flex-wrap gap-1.5">
                {machineTypes.map(t => (
                  <button
                    key={t.type_id}
                    type="button"
                    onClick={() => setTypeId(typeId === t.type_id ? '' : t.type_id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all
                      ${typeId === t.type_id
                        ? (CATEGORY_COLOR[t.category] || 'border-accent text-accent bg-accent/10')
                        : 'border-border text-muted'}`}
                  >
                    {t.type_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted mb-1">レンタルコード / 機械番号</div>
              <input className={inputCls} type="text" placeholder="任意" value={machineNumber} onChange={e => setMachineNumber(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">型番</div>
              <input className={inputCls} type="text" placeholder="任意" value={modelId} onChange={e => setModelId(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1">デフォルト遊技価格（円）</div>
            <input className={inputCls} type="number" inputMode="numeric" placeholder="100" value={playPrice} onChange={e => setPlayPrice(e.target.value)} />
          </div>

          <div>
            <div className="text-xs text-muted mb-1">備考</div>
            <textarea className={inputCls + ' resize-y min-h-[60px] !text-sm'} rows={2} placeholder="任意" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors">
            {saving ? '保存中...' : '機械を追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
