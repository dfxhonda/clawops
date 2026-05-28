import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'

const PRINT_STYLE = `
@media print {
  @page { size: 50mm 18mm; margin: 0.5mm; }
  body { margin: 0; }
  [data-testid="admin-top-tabs"],
  .no-print { display: none !important; }
  .label-unselected { display: none !important; }
  .qr-label {
    width: 49mm; height: 17mm;
    display: flex; flex-direction: row; align-items: center; gap: 1mm;
    page-break-after: always;
    border: none !important; background: white; color: black;
    box-shadow: none !important;
  }
  .qr-text-block { flex: 1; min-width: 0; }
  .qr-text-store   { font-size: 6pt; display: block; }
  .qr-text-machine { font-size: 7pt; font-weight: bold; display: block; }
  .qr-text-code    { font-size: 6pt; font-family: monospace; display: block; }
  .qr-canvas-block { width: 14mm; height: 14mm; flex-shrink: 0; }
  .qr-canvas-block canvas { width: 14mm !important; height: 14mm !important; }
}
`

function QRLabelCard({ booth }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, booth.booth_code, { width: 56, margin: 1 })
    }
  }, [booth.booth_code])

  return (
    <div
      className="qr-label flex flex-row items-center gap-1 border border-gray-300 rounded bg-white text-black"
      style={{ width: 200, height: 60, padding: '2px 4px' }}
    >
      <div className="qr-text-block flex-1 min-w-0 overflow-hidden">
        <span className="qr-text-store block truncate" style={{ fontSize: 9 }}>{booth.store_name}</span>
        <span className="qr-text-machine block truncate font-bold" style={{ fontSize: 10 }}>{booth.machine_name}</span>
        <span className="qr-text-code block truncate" style={{ fontSize: 8, fontFamily: 'monospace' }}>{booth.booth_code}</span>
      </div>
      <div className="qr-canvas-block flex-shrink-0" style={{ width: 56, height: 56 }}>
        <canvas ref={canvasRef} style={{ width: 56, height: 56 }} />
      </div>
    </div>
  )
}

export default function AdminQRLabelPage() {
  const [booths, setBooths]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [storeFilter, setStore]     = useState('')
  const [machineFilter, setMachine] = useState('')
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => {
    async function load() {
      const { data, error: e } = await supabase
        .from('booths')
        .select('booth_code, booth_number, machine_code, machines!machine_code(machine_name, store_code, stores!store_code(store_name))')
        .eq('is_active', true)
        .order('machine_code')
        .order('booth_number')
      if (e) { setError(e.message); setLoading(false); return }
      const flat = (data ?? []).map(b => ({
        booth_code:   b.booth_code,
        booth_number: b.booth_number,
        machine_code: b.machine_code,
        machine_name: b.machines?.machine_name ?? b.machine_code,
        store_code:   b.machines?.store_code ?? '',
        store_name:   b.machines?.stores?.store_name ?? b.machines?.store_code ?? '',
      })).sort((a, b) =>
        a.store_code.localeCompare(b.store_code) ||
        a.machine_code.localeCompare(b.machine_code) ||
        a.booth_number - b.booth_number
      )
      setBooths(flat)
      setSelected(new Set(flat.map(b => b.booth_code)))
      setLoading(false)
    }
    load()
  }, [])

  const stores = [...new Map(booths.map(b => [b.store_code, b.store_name])).entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const machines = [...new Map(
    booths
      .filter(b => !storeFilter || b.store_code === storeFilter)
      .map(b => [b.machine_code, b.machine_name])
  ).entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const filtered = booths.filter(b =>
    (!storeFilter   || b.store_code   === storeFilter) &&
    (!machineFilter || b.machine_code === machineFilter)
  )

  const printTargets = filtered.filter(b => selected.has(b.booth_code))
  const allChecked   = filtered.length > 0 && filtered.every(b => selected.has(b.booth_code))

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allChecked) filtered.forEach(b => next.delete(b.booth_code))
      else            filtered.forEach(b => next.add(b.booth_code))
      return next
    })
  }

  function toggle(code) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else                next.add(code)
      return next
    })
  }

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
        {/* toolbar */}
        <div className="no-print flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border">
          <select
            data-testid="qr-filter-store"
            value={storeFilter}
            onChange={e => { setStore(e.target.value); setMachine('') }}
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
          >
            <option value="">全店</option>
            {stores.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <select
            data-testid="qr-filter-machine"
            value={machineFilter}
            onChange={e => setMachine(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
          >
            <option value="">全機械</option>
            {machines.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              data-testid="qr-select-all"
              checked={allChecked}
              onChange={toggleAll}
              className="accent-blue-500"
            />
            全選択
          </label>
          <span className="text-sm text-muted">{printTargets.length}枚選択中</span>
          <button
            data-testid="qr-print-button"
            onClick={() => window.print()}
            disabled={printTargets.length === 0}
            className="ml-auto px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-40 whitespace-nowrap"
          >
            印刷 ({printTargets.length}枚)
          </button>
        </div>

        {/* label list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted text-sm py-8">該当なし</p>
          )}
          <div data-testid="qr-label-list" className="flex flex-wrap gap-3">
            {filtered.map(booth => {
              const isSelected = selected.has(booth.booth_code)
              return (
                <div
                  key={booth.booth_code}
                  className={isSelected ? '' : 'label-unselected'}
                  style={{ opacity: isSelected ? 1 : 0.3 }}
                >
                  <label className="no-print flex items-center gap-1 text-sm text-muted mb-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(booth.booth_code)}
                      className="accent-blue-500"
                    />
                    {booth.booth_code}
                  </label>
                  <QRLabelCard booth={booth} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
