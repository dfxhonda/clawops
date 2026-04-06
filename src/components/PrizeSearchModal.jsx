import { useState, useMemo } from 'react'

const IMG_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/announcements/`

export default function PrizeSearchModal({ onSelect, onClose, prizes, vehicleStocks }) {
  const [query, setQuery] = useState('')
  const [vehicleOnly, setVehicleOnly] = useState(false)

  const vehicleMap = useMemo(
    () => new Map((vehicleStocks || []).map(s => [s.prize_id, s.quantity])),
    [vehicleStocks]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (prizes || []).filter(p => {
      if (vehicleOnly && !vehicleMap.has(p.prize_id)) return false
      if (q && !p.prize_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [prizes, query, vehicleOnly, vehicleMap])

  function handleSelect(prizeName) {
    onSelect(prizeName)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg/95 backdrop-blur">
      {/* ヘッダー */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <button onClick={onClose} className="text-xl text-muted hover:text-accent">←</button>
        <span className="font-bold text-sm flex-1">景品を検索</span>
        <button
          onClick={() => setVehicleOnly(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${vehicleOnly ? 'bg-accent4/20 border-accent4/40 text-accent4 font-bold' : 'bg-surface2 border-border text-muted'}`}>
          🚗 車載のみ
        </button>
      </div>

      {/* 検索入力 */}
      <div className="shrink-0 px-3 py-2">
        <input
          type="text"
          autoFocus
          placeholder="景品名で検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent placeholder:text-muted/60"
        />
      </div>

      {/* 結果グリッド */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center text-muted text-sm py-8">該当なし</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(prize => {
              const qty = vehicleMap.get(prize.prize_id)
              return (
                <button
                  key={prize.prize_id}
                  onClick={() => handleSelect(prize.prize_name)}
                  className="bg-surface border border-border rounded-xl overflow-hidden text-left active:scale-[0.97] transition-all hover:border-accent/40">
                  {prize.image_url ? (
                    <img
                      src={IMG_BASE + prize.image_url}
                      alt={prize.prize_name}
                      className="w-full aspect-square object-cover"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                    />
                  ) : null}
                  <div
                    className="w-full aspect-square bg-surface2 items-center justify-center text-muted text-xs"
                    style={{ display: prize.image_url ? 'none' : 'flex' }}>
                    画像なし
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-text leading-tight line-clamp-2">{prize.prize_name}</div>
                    {qty != null && (
                      <div className="mt-0.5 text-[10px] font-bold text-accent4">🚗 {qty}個</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
