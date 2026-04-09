import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { findBoothByCode, getStores, getMachines, getBooths } from '../services/masters'
import LogoutButton from '../components/LogoutButton'

const SS_STORE = 'patrol_store_sel'
const SS_MACHINE = 'patrol_machine_sel'

export default function PatrolScan() {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [resolving, setResolving] = useState(false)
  const scannerRef = useRef(null)

  // ドロップダウン用
  const [stores, setStores] = useState([])
  const [machines, setMachines] = useState([])
  const [selStore, setSelStore] = useState(() => sessionStorage.getItem(SS_STORE) || '')
  const [selMachine, setSelMachine] = useState(() => sessionStorage.getItem(SS_MACHINE) || '')
  const [dropError, setDropError] = useState(null)

  useEffect(() => {
    startScanner()
    getStores().then(setStores)
    return () => stopScanner()
  }, [])

  useEffect(() => {
    if (!selStore) { setMachines([]); setSelMachine(''); return }
    getMachines(selStore).then(ms => {
      setMachines(ms)
      // 保存済み機械が存在するか確認
      if (sessionStorage.getItem(SS_MACHINE) && !ms.find(m => m.machine_code === sessionStorage.getItem(SS_MACHINE))) {
        setSelMachine('')
      }
    })
  }, [selStore])

  async function startScanner() {
    try {
      setError(null)
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        onScanSuccess, () => {}
      )
      setScanning(true)
    } catch {
      setError('カメラを起動できません。カメラの権限を確認してください。')
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  async function onScanSuccess(decodedText) {
    await stopScanner()
    await resolveBooth(decodedText.trim())
  }

  async function resolveBooth(code) {
    setResolving(true); setError(null)
    try {
      const booth = await findBoothByCode(code)
      if (!booth) { setError(`ブース「${code}」が見つかりません`); setResolving(false); return }
      navigate('/patrol/input', { state: { booth } })
    } catch (e) { setError('検索エラー: ' + e.message); setResolving(false) }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualCode.trim()) return
    resolveBooth(manualCode.trim())
  }

  async function handleRetry() {
    setError(null); setResolving(false)
    await startScanner()
  }

  async function handleDropdownStart() {
    if (!selMachine) { setDropError('機械を選択してください'); return }
    setDropError(null); setResolving(true)
    try {
      const bs = await getBooths(selMachine)
      if (!bs.length) { setDropError('ブースが見つかりません'); setResolving(false); return }
      sessionStorage.setItem(SS_STORE, selStore)
      sessionStorage.setItem(SS_MACHINE, selMachine)
      navigate('/patrol/input', { state: { booth: bs[0] } })
    } catch (e) { setDropError('エラー: ' + e.message); setResolving(false) }
  }

  function handleStoreChange(code) {
    setSelStore(code)
    setSelMachine('')
    setDropError(null)
    sessionStorage.setItem(SS_STORE, code)
    sessionStorage.removeItem(SS_MACHINE)
  }

  function handleMachineChange(code) {
    setSelMachine(code)
    setDropError(null)
    sessionStorage.setItem(SS_MACHINE, code)
  }

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">巡回スキャン</h2>
            <p className="text-xs text-muted">QRスキャン or ドロップダウンで開始</p>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-3">

        {/* QRスキャナー */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden relative">
          <div id="qr-reader" className="w-full min-h-[280px] bg-black" />
          {!scanning && !resolving && !error && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-muted text-sm">カメラ起動中...</p>
            </div>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-accent2/15 border border-accent2 rounded-xl p-3.5">
            <p className="text-accent2 text-sm mb-2.5">{error}</p>
            <button onClick={handleRetry}
              className="w-full bg-surface2 border border-border text-text font-medium py-2.5 rounded-lg">
              📷 もう一度スキャン
            </button>
          </div>
        )}

        {resolving && (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-accent text-sm">ブース検索中...</p>
          </div>
        )}

        {/* ドロップダウン選択 */}
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <div className="text-xs text-muted font-semibold mb-2.5">📋 ドロップダウンで選択</div>
          <div className="space-y-2">
            <select
              value={selStore}
              onChange={e => handleStoreChange(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent">
              <option value="">— 店舗を選択 —</option>
              {stores.map(s => (
                <option key={s.store_code} value={s.store_code}>{s.store_name}</option>
              ))}
            </select>
            <select
              value={selMachine}
              onChange={e => handleMachineChange(e.target.value)}
              disabled={!selStore || machines.length === 0}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent disabled:opacity-40">
              <option value="">— 機械を選択 —</option>
              {machines.map(m => (
                <option key={m.machine_code} value={m.machine_code}>{m.machine_name || m.machine_code}</option>
              ))}
            </select>
            {dropError && <p className="text-accent2 text-xs">{dropError}</p>}
            <button
              onClick={handleDropdownStart}
              disabled={!selMachine || resolving}
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg disabled:opacity-40 transition-opacity">
              入力開始 →
            </button>
          </div>
        </div>

        {/* 手動コード入力 */}
        <div className="bg-surface border border-border rounded-xl p-3.5">
          <div className="text-xs text-muted mb-2">QRが読めない場合はブースコードを手動入力</div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent" type="text"
              placeholder="例: KIK01-M01-B01"
              value={manualCode} onChange={e => setManualCode(e.target.value)} />
            <button type="submit" disabled={resolving}
              className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
              検索
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
