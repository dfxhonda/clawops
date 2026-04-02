import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReadingsByBooth, updateReading, parseNum } from '../services/sheets'

export default function EditReading() {
  const { boothId } = useParams()
  const navigate = useNavigate()
  const [readings, setReadings] = useState([])
  const [editing, setEditing] = useState(null)
  const [original, setOriginal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { loadReadings() }, [])

  async function loadReadings() {
    setLoading(true)
    try {
      const rows = await getReadingsByBooth(boothId)
      setReadings([...rows].reverse().map(r => ({
        reading_id: r.reading_id,
        booth_id: r.booth_id,
        full_booth_code: r.full_booth_code,
        read_time: (r.read_time || '').slice(0, 10),
        in_meter: r.in_meter,
        out_meter: r.out_meter,
        prize_restock_count: r.prize_restock_count,
        prize_stock_count: r.prize_stock_count,
        prize_name: r.prize_name,
      })))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function startEdit(r) { setOriginal({...r}); setEditing({...r}) }

  async function handleSave() {
    setSaving(true)
    try {
      const val = (key) => editing[key] !== '' ? editing[key] : original[key]
      await updateReading(editing.reading_id, {
        in_meter: val('in_meter'), out_meter: val('out_meter'),
        prize_restock_count: val('prize_restock_count'),
        prize_stock_count: val('prize_stock_count'),
        prize_name: val('prize_name'),
      })
      setEditing(null); setOriginal(null)
      await loadReadings()
    } catch (e) {
      setError('保存エラー: ' + e.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted">読み込み中...</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-2xl text-muted hover:text-accent transition-colors">←</button>
        <div>
          <h2 className="text-lg font-bold">データ修正</h2>
          <p className="text-xs text-muted">{readings[0]?.full_booth_code}</p>
        </div>
      </div>

      {error && (
        <div className="bg-accent2/15 border border-accent2 rounded-xl p-3.5 mb-3">
          <p className="text-accent2 text-sm">{error}</p>
          <button onClick={() => { setError(null); loadReadings() }}
            className="mt-2 bg-surface2 border border-border text-text text-sm py-1.5 px-4 rounded-lg">再試行</button>
        </div>
      )}

      {readings.length===0 && !error && (
        <div className="bg-surface border border-border rounded-xl text-center text-muted p-8">データがありません</div>
      )}

      <div className="space-y-2">
        {readings.map(r => (
          <div key={r.rowIndex} className="bg-surface border border-border rounded-xl p-4">
            {editing?.rowIndex===r.rowIndex ? (
              <div>
                <div className="text-sm text-muted mb-3 font-bold">{r.read_time}</div>
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-3 py-2 text-xs text-blue-400 mb-3">
                  💡 修正したい項目だけ入力。空欄のまま保存すると元の値が維持されます。
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[['in_meter','INメーター'],['out_meter','OUTメーター'],['prize_restock_count','景品補充数'],['prize_stock_count','景品投入残']].map(([key,label]) => (
                    <div key={key}>
                      <div className="text-xs text-muted mb-1">{label}</div>
                      <input className="w-full p-2.5 text-center rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="number"
                        placeholder={original?.[key]||''}
                        value={editing[key]}
                        onChange={e => setEditing({...editing,[key]:e.target.value})} />
                    </div>
                  ))}
                </div>
                <div className="mb-3">
                  <div className="text-xs text-muted mb-1">景品名</div>
                  <input className="w-full p-2.5 text-left rounded-lg border-2 border-border bg-surface2 text-text outline-none focus:border-accent" type="text"
                    placeholder={original?.prize_name||''}
                    value={editing.prize_name}
                    onChange={e => setEditing({...editing,prize_name:e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-lg disabled:opacity-50">
                    {saving?'保存中...':'✅ 保存'}
                  </button>
                  <button onClick={() => { setEditing(null); setOriginal(null) }}
                    className="flex-1 bg-surface2 border border-border text-text py-2.5 rounded-lg">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center cursor-pointer" onClick={() => startEdit(r)}>
                <div>
                  <div className="text-xs text-muted mb-0.5">{r.read_time}</div>
                  <div className="font-bold">IN: {parseNum(r.in_meter).toLocaleString()}</div>
                  {r.out_meter && <div className="text-sm text-muted">OUT: {parseNum(r.out_meter).toLocaleString()}</div>}
                  <div className="text-sm text-muted mt-0.5">{r.prize_name||'景品名なし'}</div>
                </div>
                <div className="text-xl text-accent4">✏️</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
