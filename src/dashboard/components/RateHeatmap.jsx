import { useState } from 'react'

const CELL = 14
const GAP = 1
const LABEL_W = 90

function getColor(rate) {
  if (rate == null) return '#f1f5f9'
  if (rate >= 0.5 && rate <= 0.65) return '#10b981'
  if ((rate >= 0.4 && rate < 0.5) || (rate > 0.65 && rate <= 0.75)) return '#f59e0b'
  return '#f43f5e'
}

function getLast14Days(today) {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(new Date(today).getTime() - i * 86400000)
    days.push(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }))
  }
  return days
}

export default function RateHeatmap({ data, machines, today }) {
  const [tooltip, setTooltip] = useState(null)

  if (!machines || machines.length === 0) {
    return <div className="text-xs text-slate-400">データなし</div>
  }

  const days = getLast14Days(today)
  const svgW = LABEL_W + days.length * (CELL + GAP)
  const svgH = machines.length * (CELL + GAP)

  return (
    <div className="relative">
      <svg
        width={svgW}
        height={svgH + 20}
        style={{ display: 'block' }}
      >
        {/* 日付ラベル (簡略: M/D) */}
        {days.map((d, j) => {
          const md = d.slice(5).replace('-', '/')
          return (
            <text
              key={d}
              x={LABEL_W + j * (CELL + GAP) + CELL / 2}
              y={12}
              fontSize={7}
              textAnchor="middle"
              fill="#94a3b8"
            >
              {j % 3 === 0 ? md : ''}
            </text>
          )
        })}

        {machines.map((m, i) => {
          const y = 20 + i * (CELL + GAP)
          return (
            <g key={m.machine_code}>
              <text
                x={LABEL_W - 4}
                y={y + CELL - 3}
                fontSize={9}
                textAnchor="end"
                fill="#64748b"
              >
                {(m.machine_name || m.machine_code).slice(0, 10)}
              </text>
              {days.map((d, j) => {
                const cell = data?.[m.machine_code]?.[d]
                const x = LABEL_W + j * (CELL + GAP)
                return (
                  <rect
                    key={d}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={getColor(cell?.rate)}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      setTooltip(t =>
                        t?.machine === m.machine_code && t?.date === d ? null : { machine: m.machine_code, machineName: m.machine_name, date: d, cell, x, y }
                      )
                    }
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {tooltip && (
        <div
          className="absolute z-10 bg-slate-800 text-white text-[11px] rounded px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y - 40 }}
        >
          <div className="font-bold">{tooltip.machineName || tooltip.machine}</div>
          <div>{tooltip.date}</div>
          {tooltip.cell
            ? <div>出率 {(tooltip.cell.rate * 100).toFixed(1)}% IN{tooltip.cell.inSum} OUT{tooltip.cell.outSum}</div>
            : <div>データなし</div>
          }
        </div>
      )}
    </div>
  )
}
