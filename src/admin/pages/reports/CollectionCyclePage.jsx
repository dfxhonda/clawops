// J-REPORTS-ANALYTICS-01 S4: 集金サイクル分析
// 店舗別カード (前回集金/間隔/総回収/日当売上/推奨次回集金日) + 全店間隔ヒストグラム
// SPEC-ADMIN-ANALYTICS-RELABEL-GENREFILTER-TABPILL-01 R3: GenreFilter disabled (集金は機種別非対応)
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { diffDays, formatJstDate, todayJst } from '../../lib/jstDate'
import ReportPageLayout, { EmptyState } from './ReportPageLayout'
import GenreFilter from './GenreFilter'

export default function CollectionCyclePage() {
  const [stores, setStores] = useState([])
  const [perStore, setPerStore] = useState([])  // [{store, last, interval_days, total, daily_revenue, recommended_next}]
  const [hist, setHist] = useState([])          // [{bucket: '0-7', count}]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: storeData } = await supabase
        .from('stores').select('store_code, store_name').eq('is_active', true).order('store_name')
      // 最新 collection per store + sum of cash_collection_booths.total
      const { data: collections } = await supabase
        .from('cash_collections')
        .select('collection_id, store_code, collected_at, prev_collection_date')
        .order('collected_at', { ascending: false })
      const latestPerStore = {}
      for (const c of collections ?? []) {
        if (!latestPerStore[c.store_code]) latestPerStore[c.store_code] = c
      }
      const { data: boothsRows } = await supabase
        .from('cash_collection_booths')
        .select('collection_id, total')
      const totalByCollection = {}
      for (const r of boothsRows ?? []) {
        totalByCollection[r.collection_id] = (totalByCollection[r.collection_id] ?? 0) + Number(r.total || 0)
      }
      const intervalCounts = {} // for histogram
      const cards = (storeData ?? []).map(s => {
        const c = latestPerStore[s.store_code]
        if (!c) return { store_code: s.store_code, store_name: s.store_name, no_record: true }
        const interval = diffDays(c.prev_collection_date, c.collected_at)
        const total = totalByCollection[c.collection_id] ?? 0
        const dailyRev = (interval && interval > 0) ? total / interval : null
        const recommendedNext = (interval && interval > 0)
          ? new Date(new Date(c.collected_at).getTime() + interval * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
          : null
        // ヒストグラム bucketing
        if (interval != null) {
          const b = interval <= 7 ? '0-7日' : interval <= 14 ? '8-14日' : interval <= 30 ? '15-30日' : '31日+'
          intervalCounts[b] = (intervalCounts[b] ?? 0) + 1
        }
        return {
          store_code: s.store_code, store_name: s.store_name,
          last: c.collected_at, interval_days: interval, total, daily_revenue: dailyRev, recommended_next: recommendedNext,
        }
      })
      setPerStore(cards)
      setHist(['0-7日', '8-14日', '15-30日', '31日+'].map(b => ({ bucket: b, count: intervalCounts[b] ?? 0 })))
      setStores(storeData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <ReportPageLayout title="集金サイクル分析" testid="report-collection-cycle">
      {/* 集金は機種別フィルタ非対応 */}
      <GenreFilter value="all" onChange={() => {}} disabled disabledReason="集金は機種別非対応" />
      {loading ? (
        <p className="text-center text-muted text-sm py-12">読み込み中…</p>
      ) : (
        <>
          {/* 店舗別カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {perStore.map(s => (
              <div key={s.store_code} className={`border rounded-lg p-3 ${s.no_record ? 'border-border bg-surface/40 opacity-60' : 'border-border bg-surface'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-sm truncate">{s.store_name}</p>
                  <span className="text-[10px] font-mono text-muted">{s.store_code}</span>
                </div>
                {s.no_record ? (
                  <p className="text-xs text-muted">集金記録なし</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted">前回集金</span><span>{formatJstDate(s.last)}</span>
                    <span className="text-muted">間隔</span><span>{s.interval_days ?? '—'}日</span>
                    <span className="text-muted">総回収</span><span>¥{Math.round(s.total).toLocaleString()}</span>
                    <span className="text-muted">日当売上</span><span>{s.daily_revenue != null ? `¥${Math.round(s.daily_revenue).toLocaleString()}` : '—'}</span>
                    <span className="text-muted">推奨次回</span><span className="text-accent">{s.recommended_next ?? '—'}</span>
                  </div>
                )}
              </div>
            ))}
            {perStore.length === 0 && <EmptyState />}
          </div>

          {/* ヒストグラム */}
          <div className="bg-surface border border-border rounded-lg p-3">
            <p className="text-xs font-bold text-muted mb-2">全店 集金間隔分布</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                <Bar dataKey="count" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ReportPageLayout>
  )
}
