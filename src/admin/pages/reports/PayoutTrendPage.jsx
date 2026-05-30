// J-REPORTS-ANALYTICS-01 S2: 払い出し率トレンド (店舗→機械→ブース ドリルダウン)
// payout_rate (左軸) + play_7dma (右軸) の二軸折れ線、上限/下限アラート、phase_at マーカー
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { jstDateNDaysAgo, todayJst } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'

export default function PayoutTrendPage() {
  const [storeCode, setStoreCode] = useState(null)
  const [machineCode, setMachineCode] = useState(null)
  const [boothCode, setBoothCode] = useState(null)
  const [stores, setStores] = useState([])
  const [machines, setMachines] = useState([])
  const [booths, setBooths] = useState([])
  const [series, setSeries] = useState([])
  const [phaseChanges, setPhaseChanges] = useState([])
  const [upper, setUpper] = useState(60)
  const [lower, setLower] = useState(30)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('store_code, store_name').eq('is_active', true)
      .order('store_name').then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    setMachineCode(null); setBoothCode(null); setMachines([]); setBooths([]); setSeries([])
    if (!storeCode) return
    supabase.from('machines').select('machine_code, machine_name').eq('store_code', storeCode).eq('is_active', true)
      .order('machine_code').then(({ data }) => setMachines(data ?? []))
  }, [storeCode])

  useEffect(() => {
    setBoothCode(null); setBooths([]); setSeries([])
    if (!machineCode) return
    supabase.from('booths').select('booth_code, booth_number').eq('machine_code', machineCode).eq('is_active', true)
      .order('booth_number').then(({ data }) => setBooths(data ?? []))
  }, [machineCode])

  useEffect(() => {
    if (!boothCode) { setSeries([]); setPhaseChanges([]); return }
    setLoading(true)
    const from = jstDateNDaysAgo(60)
    supabase.from('daily_booth_stats')
      .select('stat_date, payout_rate, play_7dma, phase_at, prize_id')
      .eq('booth_code', boothCode)
      .gte('stat_date', from)
      .order('stat_date')
      .then(({ data }) => {
        const list = (data ?? []).map(r => ({
          stat_date: r.stat_date,
          payout_rate: r.payout_rate != null ? Number(r.payout_rate) * 100 : null,
          play_7dma: r.play_7dma != null ? Number(r.play_7dma) : null,
        }))
        setSeries(list)
        // phase_at が前日と違う行 = phase 変更
        const changes = []
        let prev = null
        for (const r of data ?? []) {
          if (r.phase_at && r.phase_at !== prev) {
            changes.push(r.stat_date)
            prev = r.phase_at
          }
        }
        setPhaseChanges(changes)
        setLoading(false)
      })
  }, [boothCode])

  return (
    <ReportPageLayout title="払い出し率トレンド" testid="report-payout-trend">
      {/* ドリルダウン */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={storeCode ?? ''} onChange={e => setStoreCode(e.target.value || null)}
          data-testid="select-store"
          className="bg-surface border border-border rounded px-2 py-1 text-xs">
          <option value="">店舗を選択</option>
          {stores.map(s => <option key={s.store_code} value={s.store_code}>{s.store_name}</option>)}
        </select>
        <select value={machineCode ?? ''} onChange={e => setMachineCode(e.target.value || null)}
          disabled={!storeCode} data-testid="select-machine"
          className="bg-surface border border-border rounded px-2 py-1 text-xs disabled:opacity-40">
          <option value="">機械を選択</option>
          {machines.map(m => <option key={m.machine_code} value={m.machine_code}>{m.machine_name || m.machine_code}</option>)}
        </select>
        <select value={boothCode ?? ''} onChange={e => setBoothCode(e.target.value || null)}
          disabled={!machineCode} data-testid="select-booth"
          className="bg-surface border border-border rounded px-2 py-1 text-xs disabled:opacity-40">
          <option value="">ブースを選択</option>
          {booths.map(b => <option key={b.booth_code} value={b.booth_code}>B{String(b.booth_number).padStart(2, '0')}</option>)}
        </select>
      </div>

      {/* アラート閾値 */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <label className="flex items-center gap-1">
          上限<input type="number" value={upper} onChange={e => setUpper(Number(e.target.value))}
            className="w-16 bg-surface border border-border rounded px-2 py-0.5" />%
        </label>
        <label className="flex items-center gap-1">
          下限<input type="number" value={lower} onChange={e => setLower(Number(e.target.value))}
            className="w-16 bg-surface border border-border rounded px-2 py-0.5" />%
        </label>
      </div>

      {!boothCode
        ? <p className="text-center text-muted text-sm py-12">店舗→機械→ブースを選択</p>
        : loading
          ? <p className="text-center text-muted text-sm py-12">読み込み中…</p>
          : series.length === 0
            ? <EmptyState />
            : (
              <div className="bg-surface rounded-lg p-3 border border-border">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="stat_date" stroke="#94a3b8" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} label={{ value: '払出率%', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} label={{ value: '7DMA play', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                    <ReferenceLine yAxisId="left" y={upper} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `上限${upper}%`, fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine yAxisId="left" y={lower} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `下限${lower}%`, fill: '#3b82f6', fontSize: 10 }} />
                    {phaseChanges.map(d => (
                      <ReferenceLine key={d} yAxisId="left" x={d} stroke="#10b981" strokeDasharray="2 2" />
                    ))}
                    <Line yAxisId="left" type="monotone" dataKey="payout_rate" stroke="#fbbf24" strokeWidth={2} dot={false} name="払出率%" />
                    <Line yAxisId="right" type="monotone" dataKey="play_7dma" stroke="#60a5fa" strokeWidth={2} dot={false} name="7DMA" />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted mt-2">緑線=景品phase変更点 ({phaseChanges.length}件)</p>
              </div>
            )}
    </ReportPageLayout>
  )
}
