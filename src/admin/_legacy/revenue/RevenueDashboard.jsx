import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'
import {
  getRevenueByStore,
  getRevenueByMachine,
  getRevenueByPrize,
  getKpiSummary,
} from '../../services/revenueQuery'

const PERIODS = [
  { key: 'today',  label: '今日' },
  { key: 'week',   label: '今週' },
  { key: 'month',  label: '今月' },
  { key: 'custom', label: 'カスタム' },
]

const RANKING_TABS = [
  { key: 'store',   label: '店舗別' },
  { key: 'machine', label: '機械別' },
  { key: 'prize',   label: '景品別' },
]

const PAYOUT_WARNING_THRESHOLD = 75

function toJstDateStr(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export default function RevenueDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const period = searchParams.get('period') || 'today'
  const startDate = searchParams.get('start_date') || ''
  const endDate = searchParams.get('end_date') || ''
  const rankingTab = searchParams.get('ranking_tab') || 'store'

  const [kpi, setKpi] = useState(null)
  const [storeRows, setStoreRows] = useState([])
  const [machineRows, setMachineRows] = useState([])
  const [prizeRows, setPrizeRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [zodError, setZodError] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiData, stores, machines, prizes] = await Promise.all([
        getKpiSummary(period, startDate, endDate),
        getRevenueByStore(period, startDate, endDate),
        getRevenueByMachine(period, startDate, endDate),
        getRevenueByPrize(period, startDate, endDate),
      ])
      setKpi(kpiData)
      setStoreRows(stores)
      setMachineRows(machines)
      setPrizeRows(prizes)
    } catch (err) {
      console.error('[RevenueDashboard] fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const handler = () => setZodError(true)
    window.addEventListener('revenue:zod-error', handler)
    return () => window.removeEventListener('revenue:zod-error', handler)
  }, [])

  function setPeriod(p) {
    const next = new URLSearchParams(searchParams)
    next.set('period', p)
    if (p !== 'custom') {
      next.delete('start_date')
      next.delete('end_date')
    }
    setSearchParams(next)
  }

  function setRankingTab(tab) {
    const next = new URLSearchParams(searchParams)
    next.set('ranking_tab', tab)
    setSearchParams(next)
  }

  function handleCustomDate(key, value) {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next)
  }

  function downloadCsv() {
    const today = toJstDateStr(new Date())
    const filename = `revenue_${period}_${today}.csv`

    let headers, rows
    if (rankingTab === 'store') {
      headers = ['店舗コード', '店舗名', '売上', 'シェア(%)', '払出率(%)', '機械数']
      rows = storeRows.map(r => [r.store_code, r.store_name, r.revenue, r.share, r.payout_rate, r.machine_count])
    } else if (rankingTab === 'machine') {
      headers = ['機械コード', '店舗名', '機械名', '売上', '払出率(%)']
      rows = machineRows.map(r => [r.machine_code, r.store_name, r.machine_name || '', r.revenue, r.payout_rate])
    } else {
      headers = ['景品ID', '景品名', '売上', '平均景品コスト', '利益率(%)']
      rows = prizeRows.map(r => [r.prize_id || '', r.prize_name || '', r.revenue, r.prize_cost_avg, r.profit_margin])
    }

    const csv = '﻿' + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const revenue = kpi?.revenue ?? 0
  const prevRevenue = kpi?.prev_revenue ?? 0
  const delta = prevRevenue > 0 ? revenue - prevRevenue : null
  const deltaPct = delta !== null ? Math.round((delta / prevRevenue) * 100) : null

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-bg border-b border-border px-3 py-2.5 flex items-center gap-3"
        style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: '#3b82f6' }}>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="text-sm font-bold text-muted shrink-0 py-1 active:opacity-70"
        >
          ← 戻る
        </button>
        <div className="flex-1 text-base font-bold">売上分析</div>
        <LogoutButton />
      </div>

      {zodError && (
        <div data-testid="zod-error-banner" className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-xs text-orange-700">
          データ形式エラーが発生しました（一部データが表示されない場合があります）
        </div>
      )}

      <div className="shrink-0 flex border-b border-border bg-bg">
        {PERIODS.map(p => (
          <button
            key={p.key}
            role="tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              period === p.key ? 'text-accent border-b-2 border-accent' : 'text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="shrink-0 flex gap-2 px-4 py-2 bg-bg border-b border-border">
          <input
            type="date"
            data-testid="custom-start-date"
            value={startDate}
            onChange={e => handleCustomDate('start_date', e.target.value)}
            className="flex-1 border border-border rounded px-2 py-1 text-sm"
          />
          <span className="self-center text-muted text-sm">〜</span>
          <input
            type="date"
            data-testid="custom-end-date"
            value={endDate}
            onChange={e => handleCustomDate('end_date', e.target.value)}
            className="flex-1 border border-border rounded px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <section data-testid="kpi-section" className="px-4 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="bg-surface rounded-xl p-3 border border-border">
              <div className="text-xs text-muted mb-1">売上合計</div>
              <div className="text-lg font-bold text-text">
                {loading ? '—' : `¥${revenue.toLocaleString()}`}
              </div>
              <div
                data-testid="kpi-delta"
                className={`text-xs mt-1 ${delta === null ? 'text-muted' : delta >= 0 ? 'text-green-600' : 'text-red-500'}`}
              >
                {loading ? '' : delta === null ? '前期データなし' : `${delta >= 0 ? '▲' : '▼'}${Math.abs(deltaPct)}%`}
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-border">
              <div className="text-xs text-muted mb-1">前期売上</div>
              <div className="text-lg font-bold text-text">
                {loading ? '—' : `¥${prevRevenue.toLocaleString()}`}
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-border">
              <div className="text-xs text-muted mb-1">巡回機械数</div>
              <div className="text-lg font-bold text-text">
                {loading ? '—' : kpi?.machine_count ?? 0}
              </div>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-border">
              <div className="text-xs text-muted mb-1">巡回完了率</div>
              <div className="text-lg font-bold text-text">
                {loading ? '—' : `${kpi?.patrol_completion_rate ?? 0}%`}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-3 pb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {RANKING_TABS.map(t => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={rankingTab === t.key}
                  onClick={() => setRankingTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    rankingTab === t.key ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              data-testid="csv-download-btn"
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-muted hover:border-accent/40 active:scale-[0.98] transition-all"
            >
              ↓ CSV
            </button>
          </div>

          {rankingTab === 'store' && (
            <div className="space-y-2">
              {loading ? (
                <div className="text-center text-muted text-sm py-8">読み込み中...</div>
              ) : storeRows.length === 0 ? (
                <div className="text-center text-muted text-sm py-8">データなし</div>
              ) : (
                storeRows.map((row, idx) => (
                  <div
                    key={row.store_code}
                    data-rank={idx + 1}
                    data-payout-warning={row.payout_rate > PAYOUT_WARNING_THRESHOLD ? 'true' : undefined}
                    className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3"
                  >
                    <span className="text-lg font-bold text-muted/40 w-8 text-center">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text">{row.store_name}</div>
                      <div className="text-xs text-muted mt-0.5">
                        払出率 {row.payout_rate}%
                        {row.payout_rate > PAYOUT_WARNING_THRESHOLD && (
                          <span className="ml-1 text-orange-500">⚠</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-text">¥{row.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted">{row.share}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {rankingTab === 'machine' && (
            <div className="space-y-2">
              {loading ? (
                <div className="text-center text-muted text-sm py-8">読み込み中...</div>
              ) : machineRows.length === 0 ? (
                <div className="text-center text-muted text-sm py-8">データなし</div>
              ) : (
                machineRows.map((row, idx) => (
                  <div
                    key={row.machine_code}
                    data-rank={idx + 1}
                    data-payout-warning={row.payout_rate > PAYOUT_WARNING_THRESHOLD ? 'true' : undefined}
                    className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3"
                  >
                    <span className="text-lg font-bold text-muted/40 w-8 text-center">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text">{row.machine_name || row.machine_code}</div>
                      <div className="text-xs text-muted mt-0.5">{row.store_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-text">¥{row.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted">{row.payout_rate}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {rankingTab === 'prize' && (
            <div className="space-y-2">
              {loading ? (
                <div className="text-center text-muted text-sm py-8">読み込み中...</div>
              ) : prizeRows.length === 0 ? (
                <div className="text-center text-muted text-sm py-8">データなし</div>
              ) : (
                prizeRows.map((row, idx) => (
                  <div
                    key={row.prize_id || row.prize_name || idx}
                    data-rank={idx + 1}
                    data-underperformer={row.profit_margin < 0 ? 'true' : undefined}
                    className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3"
                  >
                    <span className="text-lg font-bold text-muted/40 w-8 text-center">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text">{row.prize_name || row.prize_id || '不明'}</div>
                      <div className="text-xs text-muted mt-0.5">
                        利益率 {row.profit_margin}%
                        {row.profit_margin < 0 && <span className="ml-1 text-red-500">▼</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-text">¥{row.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted">¥{row.prize_cost_avg}/個</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
