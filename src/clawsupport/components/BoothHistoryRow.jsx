import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

const ENTRY_CHIP = {
  patrol:     { label: '巡', cls: 'bg-slate-600/60 text-slate-300' },
  replace:    { label: '替', cls: 'bg-amber-600/60 text-amber-200' },
  collection: { label: '集', cls: 'bg-cyan-600/60 text-cyan-200' },
}

function fmtDate(row) {
  const d = row.patrol_date || row.read_time?.slice(0, 10)
  if (!d) return { main: '—', day: '' }
  const dt = new Date(d + 'T00:00:00')
  const m = dt.getMonth() + 1
  const day = dt.getDate()
  return { main: `${m}/${day}`, day: DAYS_JA[dt.getDay()] }
}

function fmtDiff(val) {
  if (val == null) return { text: '—', cls: 'text-muted' }
  if (val === 0)   return { text: '0', cls: 'text-muted' }
  if (val > 0)     return { text: `+${val.toLocaleString()}`, cls: 'text-green-400 font-bold' }
  return               { text: `${val.toLocaleString()}`,  cls: 'text-red-400 font-bold' }
}

function fmtMoney(val) {
  if (val == null) return { text: '—', cls: 'text-muted' }
  if (val === 0)   return { text: '¥0', cls: 'text-muted' }
  const abs = Math.abs(val)
  const str = `¥${Math.round(abs).toLocaleString()}`
  if (val > 0) return { text: str, cls: 'text-green-400 font-bold' }
  return { text: `-${str}`, cls: 'text-red-400 font-bold' }
}

export default function BoothHistoryRow({
  row,
  boothCode,
  storeCode,
  machine,
  booth,
  prevPrizeName,
  onSelect,
  isSelected = false,
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)

  const { main: dateMain, day: dateDay } = fmtDate(row)
  const chip = ENTRY_CHIP[row.entry_type] ?? ENTRY_CHIP.patrol
  const inD  = fmtDiff(row.in_diff)
  const outD = fmtDiff(row.out_diff)
  const rev  = fmtMoney(row.revenue)
  const prof = fmtMoney(row.profit)

  const prizeChanged = prevPrizeName != null && row.prize_name !== prevPrizeName
  // Guard: undefined row.reading_id must never match undefined selectedReadingId (phantom-ring bug)
  const effectiveIsSelected = isSelected && row.reading_id != null

  function handlePointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      navigate(`/clawsupport/booth/${boothCode}`, {
        state: { machine, booth, storeCode },
      })
    }, 500)
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current)
  }

  function handlePointerMove() {
    clearTimeout(longPressTimer.current)
  }

  function handleClick() {
    if (onSelect) {
      onSelect(row)
      return
    }
    if (didLongPress.current) return
    setExpanded(e => !e)
  }

  return (
    <div
      data-testid="history-row"
      className={`border-b border-border last:border-b-0${effectiveIsSelected ? ' ring-2 ring-blue-500 bg-blue-900/20 rounded' : ''}`}
    >
      <button
        className="w-full text-left select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <div className="grid gap-2 px-2 py-2 text-base items-center"
          style={{ gridTemplateColumns: '70px 1fr 70px 70px' }}>

          {/* 日付 chip — text-sm 例外許容 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-mono text-text/80 leading-none text-sm">{dateMain}</span>
            <span className={`px-1.5 py-0 rounded text-sm font-bold leading-tight ${chip.cls}`}>
              {dateDay}{chip.label}
            </span>
          </div>

          {/* 景品名 */}
          <div className={`truncate leading-tight ${prizeChanged ? 'font-bold text-amber-200 bg-amber-900/20 rounded px-1' : 'text-muted'}`}>
            {row.prize_name || '—'}
          </div>

          {/* IN差 */}
          <div className={`font-mono text-right ${inD.cls}`}>{inD.text}</div>

          {/* OUT差 */}
          <div className={`font-mono text-right ${outD.cls}`}>{outD.text}</div>

        </div>
      </button>

      {expanded && (
        <div
          data-testid="history-row-detail"
          className="px-3 pb-2 text-base text-muted space-y-1 bg-surface/20"
        >
          <div className="flex gap-4 flex-wrap">
            {row.set_a  != null && <span>A:{row.set_a}</span>}
            {row.set_c  != null && <span>C:{row.set_c}</span>}
            {row.set_l  != null && <span>L:{row.set_l}</span>}
            {row.set_r  != null && <span>R:{row.set_r}</span>}
            {row.set_o  != null && <span>メモ:{row.set_o}</span>}
          </div>
          <div className="flex gap-4 flex-wrap">
            {row.prize_restock_count != null && <span>補充:{row.prize_restock_count}</span>}
            {row.prize_stock_count   != null && <span>在庫:{row.prize_stock_count}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
