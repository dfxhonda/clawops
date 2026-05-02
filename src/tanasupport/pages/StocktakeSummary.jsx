import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function StocktakeSummary() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const staffId = sessionStorage.getItem('stocktake_staff_id')

  const [session, setSession]   = useState(null)
  const [lines, setLines]       = useState([])
  const [prizeMap, setPrizeMap] = useState({})
  const [locationName, setLocationName] = useState('')
  const [loading, setLoading]   = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied]   = useState(false)

  useEffect(() => {
    if (!staffId) navigate('/stock', { replace: true })
  }, [staffId, navigate])

  useEffect(() => {
    async function load() {
      const [{ data: sess }, { data: lns }] = await Promise.all([
        supabase.from('stocktake_sessions').select('*').eq('session_id', sessionId).single(),
        supabase.from('stocktake_lines').select('*').eq('session_id', sessionId),
      ])
      setSession(sess)
      setLines(lns ?? [])
      setApplied(sess?.status === 'completed')

      // 景品名
      const ids = (lns ?? []).map(l => l.prize_id)
      if (ids.length > 0) {
        const { data: prizes } = await supabase
          .from('prize_masters').select('prize_id, prize_name').in('prize_id', ids)
        const map = {}
        for (const p of prizes ?? []) map[p.prize_id] = p.prize_name
        setPrizeMap(map)
      }

      // 場所名
      if (sess) {
        if (sess.location_owner_type === 'staff') {
          const { data: st } = await supabase
            .from('staff').select('name').eq('staff_id', sess.location_owner_id).single()
          setLocationName(st ? `${st.name}の車` : sess.location_owner_id)
        } else {
          const { data: loc } = await supabase
            .from('locations').select('location_name').eq('location_id', sess.location_owner_id).single()
          setLocationName(loc?.location_name ?? sess.location_owner_id)
        }
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  const diffLines  = lines.filter(l => l.counted_quantity !== null && l.counted_quantity !== l.system_quantity)
  const uncounted  = lines.filter(l => l.counted_quantity === null).length
  const counted    = lines.filter(l => l.counted_quantity !== null).length

  async function handleApply() {
    if (applied) return
    setApplying(true)
    try {
      const now = new Date().toISOString()

      // 差異がある行のみ prize_stocks を更新
      for (const line of diffLines) {
        await supabase.from('prize_stocks')
          .update({
            quantity:         line.counted_quantity,
            last_counted_at:  now,
            last_counted_by:  line.counted_by ?? staffId,
          })
          .eq('prize_id', line.prize_id)
          .eq('owner_type', session.location_owner_type)
          .eq('owner_id', session.location_owner_id)

        // 移動記録
        await supabase.from('stock_movements').insert({
          prize_id:        line.prize_id,
          movement_type:   'count',
          from_owner_type: session.location_owner_type,
          from_owner_id:   session.location_owner_id,
          to_owner_type:   session.location_owner_type,
          to_owner_id:     session.location_owner_id,
          quantity:        line.counted_quantity - line.system_quantity,
          note:            `棚卸し ${sessionId}: ${line.system_quantity}→${line.counted_quantity}`,
          created_by:      staffId,
          updated_by:      staffId,
        })
      }

      // セッション完了
      await supabase.from('stocktake_sessions')
        .update({
          status:        'completed',
          finished_at:   now,
          counted_items: counted,
          diff_items:    diffLines.length,
        })
        .eq('session_id', sessionId)

      setApplied(true)
    } finally {
      setApplying(false)
    }
  }

  function handleExcel() {
    const rows = lines.map(l => ({
      '景品名':         prizeMap[l.prize_id] ?? l.prize_id,
      'システム在庫':   l.system_quantity,
      '実数':           l.counted_quantity ?? '',
      '差異':           l.counted_quantity !== null ? l.counted_quantity - l.system_quantity : '',
      'カウント者':     l.counted_by ?? '',
      '備考':           l.note ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '棚卸し結果')
    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `棚卸し_${locationName}_${dateStr}.xlsx`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">

      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/stock/top')} className="text-xl text-muted">←</button>
        <div className="flex-1 text-sm font-bold">棚卸し結果</div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5 pb-24">

        {/* サマリーカード */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">場所</span>
            <span className="font-bold">{locationName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">実施日時</span>
            <span>{formatDateTime(session?.started_at)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">カウント</span>
            <span>{lines.length}品目中 {counted}完了
              {uncounted > 0 && <span className="text-yellow-400 ml-1">（未 {uncounted}件）</span>}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">差異あり</span>
            <span className={diffLines.length > 0 ? 'text-red-400 font-bold' : 'text-green-400'}>
              {diffLines.length}品目
            </span>
          </div>
        </div>

        {/* 差異一覧 */}
        {diffLines.length > 0 && (
          <div>
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2">差異あり</div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {diffLines.map((l, i) => {
                const diff = l.counted_quantity - l.system_quantity
                return (
                  <div key={l.line_id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <div className="flex-1 text-sm truncate">{prizeMap[l.prize_id] ?? l.prize_id}</div>
                    <div className="text-xs text-muted font-mono shrink-0">
                      {l.system_quantity}→{l.counted_quantity}
                    </div>
                    <div className={`text-sm font-bold font-mono shrink-0 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-2">
          {!applied ? (
            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full py-4 rounded-xl bg-accent text-bg font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {applying ? '在庫に反映中...' : '差異を在庫に反映して完了'}
            </button>
          ) : (
            <div className="w-full py-4 rounded-xl bg-green-500/10 border border-green-500/40 text-green-400 font-bold text-sm text-center">
              ✅ 在庫に反映済み
            </div>
          )}

          <button
            onClick={handleExcel}
            className="w-full py-3 rounded-xl bg-surface border border-border text-sm font-bold active:scale-[0.98] transition-all"
          >
            📥 Excelダウンロード
          </button>

          <button
            onClick={() => navigate('/stock/top')}
            className="w-full py-3 rounded-xl text-muted text-sm active:bg-surface transition-all"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  )
}
