import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getPatrolMachines, getTodayReadings } from '../../services/patrol'
import LogoutButton from '../../components/LogoutButton'

function todayLabel() {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
  })
}

const TILES = [
  { key: 'patrol',     emoji: '📍', label: '巡回',   desc: 'メーター計測・補充・入替', active: true },
  { key: 'collection', emoji: '💰', label: '集金',   desc: '現金回収・記録', active: false },
  { key: 'replace',    emoji: '🔄', label: '入替',   desc: '景品交換記録', active: false },
  { key: 'sales',      emoji: '📈', label: '売上',   desc: '入金・出金記録', active: false },
]

export default function ClawsupportStoreDash() {
  const { storeCode } = useParams()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState(storeCode)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: store }, machines] = await Promise.all([
        supabase.from('stores').select('store_name').eq('store_code', storeCode).single(),
        getPatrolMachines(storeCode),
      ])
      setStoreName(store?.store_name ?? storeCode)

      const boothCodes = machines.flatMap(m => m.booths.map(b => b.booth_code))
      const todayMap = await getTodayReadings(boothCodes)
      setProgress({ done: Object.keys(todayMap).length, total: boothCodes.length })
      setLoading(false)
    }
    load()
  }, [storeCode])

  function handleTileClick(tile) {
    if (tile.key === 'patrol') {
      navigate(`/clawsupport/store/${storeCode}/patrol`)
      return
    }
    setToast(`${tile.label}は準備中です`)
    setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={storeName}
        variant="compact"
        onBack={() => navigate('/clawsupport')}
        rightSlot={
          <LogoutButton className="h-10 px-3 text-xs text-muted bg-surface border border-border rounded-xl active:opacity-70" />
        }
      />

      {/* 進捗チップ */}
      {!loading && progress.total > 0 && (
        <div className="px-5 pb-3">
          <span className={`text-xs px-3 py-1 rounded-full border ${
            progress.done >= progress.total
              ? 'text-emerald-400 border-emerald-400/40'
              : progress.done > 0
              ? 'text-amber-400 border-amber-400/40'
              : 'text-muted border-border'
          }`}>
            巡回 {progress.done}/{progress.total} ブース完了
          </span>
        </div>
      )}

      {/* アクションタイル */}
      <div className="px-5 grid grid-cols-2 gap-3 pt-2">
        {TILES.map(tile => (
          <button
            key={tile.key}
            onClick={() => handleTileClick(tile)}
            className={`flex flex-col gap-1 px-4 py-5 rounded-2xl border text-left transition-all active:scale-[0.97] ${
              tile.active
                ? 'bg-surface border-border'
                : 'bg-surface/50 border-border/50 opacity-60'
            }`}
            style={{ minHeight: 100 }}
          >
            <span className="text-2xl">{tile.emoji}</span>
            <p className={`text-sm font-bold mt-1 ${tile.active ? 'text-text' : 'text-muted'}`}>{tile.label}</p>
            <p className="text-xs text-muted leading-snug">{tile.active ? tile.desc : '準備中'}</p>
          </button>
        ))}
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-8 inset-x-0 flex justify-center pointer-events-none">
          <div className="bg-surface border border-border text-muted text-sm px-5 py-2.5 rounded-2xl shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
