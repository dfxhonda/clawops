import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCollectionHistory, getCollectionDetail } from '../services/collections'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'

// J-COLLECTION-01: 集金履歴一覧 (/collection/history)。行タップでPDF再表示。
const yen = n => Number(n || 0).toLocaleString()

export default function CollectionHistoryPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCollectionHistory().then(({ data, error: e }) => {
      if (e) setError(`ERR-COLLECTION-001: ${e.message}`)
      else setRows(data ?? [])
      setLoading(false)
    })
  }, [])

  async function openPdf(id) {
    setError(null)
    try {
      const { data, error: e } = await getCollectionDetail(id)
      if (e) throw e
      await ensureJpFont()
      const doc = buildCollectionSlip(data)
      doc.save(slipFileName(id))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    }
  }

  return (
    <div data-testid="collection-history" className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 p-3 border-b border-border">
        <button onClick={() => navigate('/collection/input')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1 mb-2">← 集金入力</button>
        <h1 className="text-base font-bold text-text">集金履歴</h1>
      </div>

      {error && <p className="text-red-400 text-sm px-3 py-1">{error}</p>}

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading && <p className="text-center text-muted text-base py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-base py-8">集金履歴がありません</p>}
        <div className="space-y-2">
          {rows.map(r => (
            <button
              key={r.collection_id}
              data-testid="collection-history-row"
              onClick={() => openPdf(r.collection_id)}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-text truncate">{r.store_name}</div>
                <div className="text-xs text-muted">{r.collected_at} ・ {r.collection_id}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-text tabular-nums">{yen(r.total)}円</div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                  {r.status === 'confirmed' ? '確定' : '下書'}
                </span>
              </div>
              <span className="text-muted">📄</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
