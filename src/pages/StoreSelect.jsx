import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStores, getMachines } from '../services/sheets'

export default function StoreSelect() {
  const [stores, setStores] = useState([])
  const [boothCounts, setBoothCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('input')
  const navigate = useNavigate()

  useEffect(() => {
    getStores().then(async s => {
      setStores(s)
      const counts = {}
      for (const store of s) {
        const machines = await getMachines(store.store_id)
        counts[store.store_id] = machines.reduce((sum, m) => sum + Number(m.booth_count), 0)
      }
      setBoothCounts(counts)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const icons = { KIK01:'🏪', KOS01:'🏬', MNK01:'🎯' }

  const modes = [
    { key:'input',   icon:'📝', label:'巡回入力' },
    { key:'ranking', icon:'📊', label:'ランキング' },
  ]

  function handleStoreClick(store) {
    if (mode === 'input')   navigate(`/machines/${store.store_id}`, { state: { storeName: store.store_name, storeId: store.store_id } })
    if (mode === 'ranking') navigate(`/ranking/${store.store_id}`, { state: { storeName: store.store_name } })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">店舗情報を読み込み中...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-accent2 mb-3">エラー: {error}</p>
        <button
          className="bg-surface2 border border-border text-text rounded-lg px-4 py-2 text-sm"
          onClick={() => { sessionStorage.clear(); window.location.href = '/docs/' }}
        >
          ログインし直す
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10 min-h-screen">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-2xl font-bold text-accent tracking-widest">CLAWOPS</div>
          <div className="text-xs text-muted mt-0.5">
            {new Date().toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'})}
          </div>
        </div>
        <button
          className="text-muted text-sm hover:text-accent2 transition-colors"
          onClick={() => { sessionStorage.clear(); window.location.href = '/docs/' }}
        >
          ログアウト
        </button>
      </div>

      {/* モード選択 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {modes.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={`py-3.5 px-2 rounded-xl text-center transition-all duration-200
              ${mode === m.key
                ? 'border-2 border-accent bg-surface3 shadow-[0_0_0_1px_var(--color-accent),inset_0_0_12px_rgba(240,192,64,0.08)]'
                : 'border-2 border-border bg-surface'}`}
          >
            <div className={`text-2xl ${mode !== m.key ? 'grayscale-[0.4] opacity-70' : ''}`}>{m.icon}</div>
            <div className={`text-xs font-bold mt-1.5 ${mode === m.key ? 'text-accent tracking-wide' : 'text-muted'}`}>
              {m.label}
            </div>
            {mode === m.key && <div className="w-5 h-0.5 bg-accent rounded-full mx-auto mt-1.5" />}
          </button>
        ))}
      </div>

      {/* QRスキャン */}
      <button onClick={() => navigate('/patrol')}
        className="w-full mb-3 py-4 px-2 rounded-xl border-2 border-accent3 bg-accent3/8 flex items-center justify-center gap-2.5 transition-all hover:bg-accent3/15 active:scale-[0.98]"
      >
        <span className="text-2xl">📷</span>
        <div className="text-left">
          <div className="text-sm font-bold text-accent3">QRスキャン巡回</div>
          <div className="text-[11px] text-muted mt-0.5">ブースQRを読んで即入力</div>
        </div>
      </button>

      {/* データ検索 */}
      <button onClick={() => navigate('/datasearch')}
        className="w-full mb-3 py-3 px-2 rounded-xl border border-border bg-surface flex items-center justify-center gap-2 transition-all hover:border-accent4/30 active:scale-[0.98]"
      >
        <span className="text-lg">🔍</span>
        <span className="text-xs font-bold text-accent4">データ検索・修正</span>
      </button>

      {/* 管理メニュー */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <button onClick={() => { window.location.href = '/docs/admin.html' }}
          className="py-3 px-2 rounded-xl border border-border bg-surface text-center transition-all hover:border-accent/30 active:scale-[0.98]">
          <span className="text-lg block">🏪</span>
          <span className="text-[11px] font-bold text-muted">店舗管理</span>
        </button>
        <button onClick={() => { window.location.href = '/docs/admin.html' }}
          className="py-3 px-2 rounded-xl border border-border bg-surface text-center transition-all hover:border-accent/30 active:scale-[0.98]">
          <span className="text-lg block">🎰</span>
          <span className="text-[11px] font-bold text-muted">機械管理</span>
        </button>
        <button onClick={() => { window.location.href = '/docs/prizes.html' }}
          className="py-3 px-2 rounded-xl border border-border bg-surface text-center transition-all hover:border-accent/30 active:scale-[0.98]">
          <span className="text-lg block">📦</span>
          <span className="text-[11px] font-bold text-muted">景品管理</span>
        </button>
      </div>

      {/* 店舗選択 */}
      <div className="text-[11px] text-muted uppercase tracking-widest mb-2">店舗を選択</div>
      <div className="space-y-2.5">
        {stores.map(store => (
          <button key={store.store_id}
            className="w-full bg-surface border border-border rounded-xl p-3.5 text-left hover:border-accent/40 transition-colors active:scale-[0.98]"
            onClick={() => handleStoreClick(store)}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{icons[store.store_code]||'🏪'}</span>
              <div>
                <div className="text-base font-bold">{store.store_name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {store.store_code} · {boothCounts[store.store_id]||'?'}ブース
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
