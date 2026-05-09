import { useEffect, useState } from 'react'
import { fetchBoothHistory } from '../../services/boothHistory'
import BoothHistoryRow from './BoothHistoryRow'

export default function BoothHistoryList({ boothCode, meterUnitPrice = 100, storeCode, machine, booth }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boothCode) return
    setLoading(true)
    fetchBoothHistory(boothCode, meterUnitPrice, 10).then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [boothCode, meterUnitPrice])

  if (loading) {
    return (
      <div
        data-testid="booth-history-list"
        className="mx-4 mt-2 text-xs text-muted text-center py-3"
      >
        履歴読み込み中...
      </div>
    )
  }

  if (!rows.length) return null

  return (
    <div
      data-testid="booth-history-list"
      className="mx-4 mt-2 rounded-xl bg-surface/30 border border-border overflow-hidden"
    >
      <div className="px-3 py-1.5 bg-surface/50 border-b border-border">
        <div className="grid gap-1 text-[9px] font-bold text-muted/60 uppercase tracking-wide"
          style={{ gridTemplateColumns: '60px 1fr 52px 52px 60px 60px' }}>
          <span>日付</span>
          <span>景品</span>
          <span className="text-right">IN差</span>
          <span className="text-right">OUT差</span>
          <span className="text-right">売上</span>
          <span className="text-right">粗利</span>
        </div>
      </div>

      {rows.map((row, i) => (
        <BoothHistoryRow
          key={row.reading_id}
          row={row}
          boothCode={boothCode}
          storeCode={storeCode}
          machine={machine}
          booth={booth}
          prevPrizeName={i < rows.length - 1 ? rows[i + 1]?.prize_name : null}
        />
      ))}
    </div>
  )
}
