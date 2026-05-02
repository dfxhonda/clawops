import { useEffect, useMemo, useState } from 'react'
import { getBoothHistory } from '../../services/readings'

function fmtDate(row) {
  const d = row.patrol_date || row.read_time?.slice(0, 10)
  if (!d) return '—'
  return d.slice(5).replace('-', '/')
}

function fmtNum(v) {
  return v != null ? Number(v).toLocaleString() : '—'
}

const ENTRY_BADGE = {
  carry_forward: { label: '据置', color: '#8888a8', bg: 'rgba(136,136,168,.18)' },
  replace:       { label: '入替', color: '#5dade2', bg: 'rgba(93,173,226,.18)' },
}

const TH = { padding: '4px 6px', color: '#6666a8', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }
const TD = { padding: '4px 6px', textAlign: 'right', color: '#d0d0e0' }

function computeRevenues(history) {
  const patrols = [...history]
    .filter(h => h.entry_type !== 'replace' && h.in_meter != null)
    .sort((a, b) => {
      const da = a.patrol_date || a.read_time.slice(0, 10)
      const db = b.patrol_date || b.read_time.slice(0, 10)
      if (da !== db) return da.localeCompare(db)
      return a.read_time.localeCompare(b.read_time)
    })
  const revMap = new Map()
  patrols.forEach((row, i) => {
    if (i === 0) { revMap.set(row.reading_id, null); return }
    const prev = patrols[i - 1]
    const inDiff = Number(row.in_meter) - Number(prev.in_meter)
    revMap.set(row.reading_id, inDiff > 0 ? inDiff * Number(row.play_price || 100) : null)
  })
  return revMap
}

export default function BoothHistoryTable({ boothId, currentReadingId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!boothId) return
    setLoading(true)
    getBoothHistory(boothId, 10).then(data => {
      setRows([...data].reverse()) // 古い順（上）→ 最新（下）: LINEと同じ並び
      setLoading(false)
    })
  }, [boothId])

  const revMap = useMemo(() => computeRevenues(rows), [rows])

  if (loading) return (
    <div style={{ fontSize: 11, color: '#8888a8', padding: '6px 0 8px', textAlign: 'center' }}>
      履歴読み込み中...
    </div>
  )
  if (!rows.length) return null

  return (
    <div style={{ marginBottom: 8, background: '#0d0d1a', border: '1px solid #1e1e36', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', background: '#12121e', borderBottom: '1px solid #1e1e36', fontSize: 10, fontWeight: 700, color: '#6666a8', letterSpacing: '0.5px' }}>
        集金履歴（直近 {rows.length} 件）
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'Courier New', monospace" }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e36' }}>
              <th style={{ ...TH, textAlign: 'left' }}>日付</th>
              <th style={TH}>IN</th>
              <th style={TH}>OUT</th>
              <th style={TH}>残</th>
              <th style={TH}>補</th>
              <th style={TH}>売上</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isCurrent = row.reading_id === currentReadingId
              const badge = ENTRY_BADGE[row.entry_type]
              const isReplace = row.entry_type === 'replace'
              const calcRev = isReplace ? null : revMap.get(row.reading_id)
              return (
                <tr key={row.reading_id}
                  style={{ borderBottom: '1px solid #111124', opacity: isCurrent ? 0.4 : 1 }}>
                  <td style={{ ...TD, textAlign: 'left', color: '#9090b8', whiteSpace: 'nowrap' }}>
                    {fmtDate(row)}
                    {badge && (
                      <span style={{ marginLeft: 3, padding: '0 3px', borderRadius: 3, fontSize: 9, fontFamily: 'sans-serif', color: badge.color, background: badge.bg }}>
                        {badge.label}
                      </span>
                    )}
                  </td>
                  <td style={TD}>{fmtNum(row.in_meter)}</td>
                  <td style={TD}>{fmtNum(row.out_meter)}</td>
                  <td style={TD}>{row.prize_stock_count != null ? row.prize_stock_count : '—'}</td>
                  <td style={TD}>{row.prize_restock_count != null ? row.prize_restock_count : '—'}</td>
                  <td style={{ ...TD, color: calcRev != null ? '#22d3ee' : '#444466', fontWeight: calcRev != null ? 700 : 400 }}>
                    {calcRev != null ? `¥${Number(calcRev).toLocaleString()}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
