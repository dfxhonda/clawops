import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { findBoothByCode } from '../services/masters'
import LogoutButton from '../components/LogoutButton'


export default function PatrolScan() {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [resolving, setResolving] = useState(false)
  const scannerRef = useRef(null)

  useEffect(() => {
    startScanner()
    return () => stopScanner()
  }, [])

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
    } catch (err) {
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
      navigate('/patrol/input', { state: { booth, fromScan: true } })
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

  return (
    <div className="h-screen flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">巡回スキャン</h2>
            <p className="text-xs text-muted">ブースQRコードを読み取り</p>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">

      {/* QRスキャナー */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-3">
        <div id="qr-reader" className="w-full min-h-[300px] bg-black relative" />
        {!scanning && !resolving && !error && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted text-sm">
            カメラ起動中...
          </div>
        )}
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-accent2/15 border border-accent2 rounded-xl p-3.5 mb-3">
          <p className="text-accent2 text-sm mb-2.5">{error}</p>
          <button onClick={handleRetry}
            className="w-full bg-surface2 border border-border text-text font-medium py-2.5 rounded-lg">
            📷 もう一度スキャン
          </button>
        </div>
      )}

      {resolving && (
        <div className="text-center py-5 text-accent text-base">ブース検索中...</div>
      )}

      {/* 手動入力 */}
      <div className="bg-surface border border-border rounded-xl p-3.5 mt-3">
        <div className="text-xs text-muted mb-2">QRが読めない場合はブースコードを手動入力</div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2.5 text-text text-sm text-left outline-none focus:border-accent" type="text"
            placeholder="例: KIK01-M01-B01"
            value={manualCode} onChange={e => setManualCode(e.target.value)} />
          <button type="submit" disabled={resolving}
            className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
            検索
          </button>
        </form>
      </div>

      </div>{/* スクロール領域終了 */}
    </div>
  )
}
