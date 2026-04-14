// BoothQrPrint: 店舗単位でブースQRコードを生成・印刷
// QR内容: URL形式 (https://clawops-tau.vercel.app/patrol/scan?booth=BOOTH_CODE)
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { getStores, getMachines, getBooths } from '../../services/masters'
import LogoutButton from '../../components/LogoutButton'

const BASE_URL = 'https://clawops-tau.vercel.app'

function QrCard({ boothCode, machineName, machineCode }) {
  const [imgSrc, setImgSrc] = useState('')
  const [qrError, setQrError] = useState(false)
  const [copied, setCopied] = useState(false)

  const boothUrl = `${BASE_URL}/patrol/scan?booth=${boothCode}`

  useEffect(() => {
    QRCode.toDataURL(boothUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(url => setImgSrc(url)).catch(() => setQrError(true))
  }, [boothUrl])

  const boothNum = boothCode.split('-').pop() // "B01"

  async function handleCopy() {
    await navigator.clipboard.writeText(boothUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="qr-card border border-border rounded-xl p-3 text-center bg-white text-black flex flex-col items-center gap-1 print:border-dashed print:border-gray-400 print:rounded-none print:p-2">
      {qrError
        ? <div className="w-[128px] h-[128px] bg-red-50 flex items-center justify-center text-xs text-red-400 rounded">QR生成失敗</div>
        : imgSrc
          ? <img src={imgSrc} alt={boothCode} className="w-[128px] h-[128px]" />
          : <div className="w-[128px] h-[128px] bg-gray-100 animate-pulse rounded" />
      }
      <div className="text-[11px] font-mono text-gray-500">{machineCode}</div>
      <div className="text-lg font-bold leading-tight">{boothNum}</div>
      <div className="text-[10px] text-gray-600 leading-tight max-w-[120px] truncate">{machineName}</div>
      <button
        onClick={handleCopy}
        className="print:hidden mt-1 text-xs font-bold text-white"
        style={{ background: copied ? '#27ae60' : '#5dade2', borderRadius: 8, padding: '8px 12px', fontWeight: 'bold' }}
      >
        {copied ? '✅ コピー済み' : 'URLコピー'}
      </button>
    </div>
  )
}

export default function BoothQrPrint() {
  const navigate = useNavigate()
  const [stores, setStores] = useState([])
  const [storeCode, setStoreCode] = useState(() => sessionStorage.getItem('qrprint_store') || '')
  const [groups, setGroups] = useState([]) // [{ machine, booths }]
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [allCopied, setAllCopied] = useState(false)

  useEffect(() => {
    getStores().then(s => {
      setStores(s)
      if (s.length === 1 && !storeCode) setStoreCode(s[0].store_code)
    }).catch(() => setLoadError('店舗一覧の読み込みに失敗しました'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (storeCode) sessionStorage.setItem('qrprint_store', storeCode)
    if (!storeCode) { setGroups([]); return }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    setGroups([])
    getMachines(storeCode).then(async machines => {
      const results = await Promise.all(
        machines.map(async m => {
          const booths = await getBooths(m.machine_code)
          return { machine: m, booths }
        })
      )
      if (!cancelled) {
        setGroups(results.filter(g => g.booths.length > 0))
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setLoadError('ブース情報の読み込みに失敗しました')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [storeCode])

  const totalBooths = groups.reduce((n, g) => n + g.booths.length, 0)
  const storeName = stores.find(s => s.store_code === storeCode)?.store_name || ''

  async function handleCopyAll() {
    const lines = groups.flatMap(({ machine, booths }) =>
      booths.map(b => `${b.booth_code}\t${machine.machine_name}\t${BASE_URL}/patrol/scan?booth=${b.booth_code}`)
    )
    await navigator.clipboard.writeText(lines.join('\n'))
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 1500)
  }

  return (
    <div className="min-h-screen pb-16 print:pb-0">

      {/* ヘッダー（印刷時非表示） */}
      <div className="print:hidden sticky top-0 z-50 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3">
        <button onClick={() => navigate('/admin/menu')} className="text-2xl text-muted">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold">QRコード印刷</h2>
          <p className="text-[11px] text-muted">ブースQRラベル生成</p>
        </div>
        <LogoutButton />
      </div>

      {/* 操作パネル（印刷時非表示） */}
      <div className="print:hidden px-4 py-3 space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">店舗を選択</label>
          <select
            value={storeCode}
            onChange={e => setStoreCode(e.target.value)}
            className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">— 選択してください —</option>
            {stores.map(s => (
              <option key={s.store_code} value={s.store_code}>
                {s.store_name}（{s.store_code}）
              </option>
            ))}
          </select>
        </div>

        {storeCode && !loading && totalBooths > 0 && (
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs text-muted">{totalBooths} ブース / {groups.length} 機械</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: allCopied ? '#27ae60' : '#5dade2', borderRadius: 8, fontWeight: 'bold' }}
              >
                {allCopied ? '✅ コピー済み' : '全URLコピー'}
              </button>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                🖨️ 印刷する
              </button>
            </div>
          </div>
        )}
      </div>

      {/* エラー */}
      {loadError && (
        <div className="mx-4 mt-2 bg-accent2/15 border border-accent2 rounded-xl p-3">
          <p className="text-accent2 text-sm">{loadError}</p>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          <p className="text-muted text-sm">ブース情報を読み込み中...</p>
        </div>
      )}

      {/* QRカードグリッド */}
      {!loading && groups.length > 0 && (
        <div className="px-4 space-y-6 print:px-2 print:space-y-4">
          {/* 印刷時ヘッダー */}
          <div className="hidden print:block text-center text-sm font-bold mb-2">
            {storeName} — ブースQRラベル
          </div>

          {groups.map(({ machine, booths }) => (
            <div key={machine.machine_code} className="print:break-inside-avoid">
              {/* 機械ラベル */}
              <div className="text-xs font-bold text-muted mb-2 flex items-center gap-2 print:text-gray-500 print:border-b print:border-gray-300 print:pb-1">
                <span>{machine.machine_code}</span>
                <span className="text-text print:text-black">{machine.machine_name}</span>
                <span className="text-muted">({booths.length}ブース)</span>
              </div>

              {/* QRカード列 */}
              <div className="flex flex-wrap gap-3 print:gap-2">
                {booths.map(b => (
                  <QrCard
                    key={b.booth_code}
                    boothCode={b.booth_code}
                    machineName={machine.machine_name}
                    machineCode={machine.machine_code}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 未選択 or 空 */}
      {!loading && !storeCode && (
        <div className="text-center py-16 text-muted text-sm">
          店舗を選択してください
        </div>
      )}
      {!loading && !loadError && storeCode && groups.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          この店舗にブースがありません
        </div>
      )}
    </div>
  )
}
