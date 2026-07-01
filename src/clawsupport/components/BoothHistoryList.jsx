import { useEffect, useState } from 'react'
import { fetchBoothHistory, buildBoothHistoryFromIdb } from '../../services/boothHistory'
import { getPatrolRecordsByBooth } from '../../lib/localStore/patrolRecords'
import { logger } from '../../lib/logger'
import BoothHistoryRow from './BoothHistoryRow'

function draftDiffCls(diff) {
  if (diff == null) return 'text-muted'
  if (diff > 0) return 'text-green-400'
  if (diff < 0) return 'text-red-400'
  return 'text-muted'
}
function draftDiffText(diff) {
  if (diff == null) return '—'
  if (diff > 0) return `+${diff}`
  return String(diff)
}

export default function BoothHistoryList({
  boothCode,
  meterUnitPrice = 100,
  storeCode,
  machine,
  booth,
  limit = 10,
  onRowSelect,
  selectedReadingId,
  draftRow,
  historyKey,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boothCode) return
    setLoading(true)
    // SPEC-PATROL-SWIPE-LATENCY-FIX-01: IDB-first history (zero Supabase round-trip)
    async function loadHistory() {
      try {
        const idbRecords = await getPatrolRecordsByBooth(boothCode)
        const syncedRows = idbRecords
          .filter(r => r.synced)
          .sort((a, b) => {
            const dc = (b.patrol_date ?? '').localeCompare(a.patrol_date ?? '')
            if (dc !== 0) return dc
            return (b.created_at ?? '').localeCompare(a.created_at ?? '')
          })
        const idbHistory = buildBoothHistoryFromIdb(syncedRows, meterUnitPrice, limit)
        if (idbHistory !== null) {
          setRows(idbHistory)
          setLoading(false)
          return
        }
      } catch (err) {
        logger.error?.('ERR-LF1-HISTORY-IDB', { boothCode, message: err?.message })
      }
      // Supabase fallback (cold booth or IDB error)
      const data = await fetchBoothHistory(boothCode, meterUnitPrice, limit)
      setRows(data)
      setLoading(false)
    }
    loadHistory()
  }, [boothCode, meterUnitPrice, limit, historyKey])

  if (loading) {
    return (
      <div
        data-testid="booth-history-list"
        className="mx-4 mt-2 text-base text-muted text-center py-3"
      >
        履歴読み込み中...
      </div>
    )
  }

  const showDraft = draftRow?.active && (draftRow.inDiff != null || draftRow.outDiff != null)

  if (!rows.length && !showDraft) return null

  return (
    <div
      data-testid="booth-history-list"
      className="mx-4 mt-2 rounded-xl bg-surface/30 border border-border overflow-hidden"
    >
      <div className="px-3 py-2 bg-surface/50 border-b border-border">
        <div className="grid gap-2 text-base font-bold text-muted/60 uppercase tracking-wide"
          style={{ gridTemplateColumns: '70px 1fr 70px 70px' }}>
          <span>日付</span>
          <span>景品</span>
          <span className="text-right">IN差</span>
          <span className="text-right">OUT差</span>
        </div>
      </div>

      {showDraft && (
        <div
          data-testid="draft-row"
          className="grid items-center px-3 py-1.5 border-b border-border/50 bg-blue-950/40"
          style={{ gridTemplateColumns: '70px 1fr 70px 70px' }}
        >
          <span className="text-xs font-bold text-blue-400">編集中</span>
          <span />
          <span className={`text-right text-xs font-bold tabular-nums ${draftDiffCls(draftRow.inDiff)}`}>
            {draftDiffText(draftRow.inDiff)}
          </span>
          <span className={`text-right text-xs font-bold tabular-nums ${draftDiffCls(draftRow.outDiff)}`}>
            {draftDiffText(draftRow.outDiff)}
          </span>
        </div>
      )}

      {rows.map((row, i) => (
        <BoothHistoryRow
          key={row.reading_id}
          row={row}
          boothCode={boothCode}
          storeCode={storeCode}
          machine={machine}
          booth={booth}
          prevPrizeName={i < rows.length - 1 ? rows[i + 1]?.prize_name : null}
          onSelect={onRowSelect}
          isSelected={selectedReadingId === row.reading_id}
        />
      ))}
    </div>
  )
}
