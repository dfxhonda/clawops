import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrizes, addPrize, getLocations, transferStock } from '../../services/sheets'
import LogoutButton from '../../components/LogoutButton'

// あいまい一致スコア（簡易版: 共通文字列長ベース）
function fuzzyScore(a, b) {
  if (!a || !b) return 0
  const al = a.toLowerCase().replace(/[\s　\-_]/g, '')
  const bl = b.toLowerCase().replace(/[\s　\-_]/g, '')
  if (al === bl) return 1
  if (al.includes(bl) || bl.includes(al)) return 0.8
  // bigram一致率
  const bigramsA = new Set()
  for (let i = 0; i < al.length - 1; i++) bigramsA.add(al.slice(i, i + 2))
  let matches = 0
  for (let i = 0; i < bl.length - 1; i++) {
    if (bigramsA.has(bl.slice(i, i + 2))) matches++
  }
  const total = Math.max(bigramsA.size, bl.length - 1)
  return total > 0 ? matches / total : 0
}

export default function InventoryMatch() {
  const navigate = useNavigate()
  const [prizes, setPrizes] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // CSV読み込み結果
  const [importItems, setImportItems] = useState([])
  // マッチング結果: { csvName, matchedPrize, score, action: 'match'|'provisional', quantity }
  const [matchResults, setMatchResults] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [p, l] = await Promise.all([getPrizes(), getLocations()])
        setPrizes(p)
        setLocations(l.filter(x => x.active_flag === '1'))
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
      if (lines.length < 2) return
      const header = lines[0]
      // 商品名・数量のカラムを自動検出
      const nameIdx = header.findIndex(h => /商品名|景品名|prize_name|品名/i.test(h))
      const qtyIdx = header.findIndex(h => /数量|quantity|受注数|入数|個数/i.test(h))
      const codeIdx = header.findIndex(h => /商品コード|jan_code|code/i.test(h))

      const items = lines.slice(1)
        .filter(r => r.length > nameIdx && r[nameIdx])
        .map(r => ({
          name: r[nameIdx] || '',
          quantity: parseInt(r[qtyIdx]) || 1,
          code: codeIdx >= 0 ? r[codeIdx] || '' : '',
        }))
      setImportItems(items)
      runMatching(items)
    }
    reader.readAsText(file, 'Shift_JIS')
  }

  function runMatching(items) {
    const results = items.map(item => {
      // 景品マスタとのマッチング
      let bestMatch = null
      let bestScore = 0
      for (const p of prizes) {
        // 商品コードの完全一致を最優先
        if (item.code && p.jan_code && item.code === p.jan_code) {
          bestMatch = p; bestScore = 1; break
        }
        const s1 = fuzzyScore(item.name, p.prize_name)
        const s2 = p.short_name ? fuzzyScore(item.name, p.short_name) : 0
        const score = Math.max(s1, s2)
        if (score > bestScore) { bestScore = score; bestMatch = p }
      }
      return {
        csvName: item.name,
        csvCode: item.code,
        quantity: item.quantity,
        matchedPrize: bestScore >= 0.5 ? bestMatch : null,
        score: bestScore,
        action: bestScore >= 0.5 ? 'match' : 'provisional',
        confirmed: false,
      }
    })
    setMatchResults(results)
  }

  function toggleAction(idx) {
    setMatchResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, action: r.action === 'match' ? 'provisional' : 'match' } : r
    ))
  }

  function confirmItem(idx) {
    setMatchResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, confirmed: !r.confirmed } : r
    ))
  }

  async function handleImport() {
    if (!selectedLocation) {
      setMessage({ type: 'error', text: '入庫先の拠点を選択してください' })
      return
    }
    const confirmed = matchResults.filter(r => r.confirmed)
    if (confirmed.length === 0) {
      setMessage({ type: 'error', text: '1件以上確認済みにしてください' })
      return
    }

    setSaving(true)
    let successCount = 0
    let provisionalCount = 0
    try {
      for (const item of confirmed) {
        let prizeId, prizeName
        if (item.action === 'match' && item.matchedPrize) {
          prizeId = item.matchedPrize.prize_id
          prizeName = item.matchedPrize.prize_name
        } else {
          // 仮登録
          prizeName = `(仮) ${item.csvName}`
          prizeId = await addPrize({
            prize_name: prizeName,
            jan_code: item.csvCode || '',
            is_active: 'TRUE',
            category: 'provisional',
          })
          provisionalCount++
        }
        // 入庫として在庫追加
        await transferStock({
          prizeId: String(prizeId),
          prizeName,
          fromOwnerType: '', fromOwnerId: '',
          toOwnerType: 'location', toOwnerId: selectedLocation,
          quantity: item.quantity,
          note: `マッチング取込: ${item.csvName}`,
          createdBy: ''
        })
        successCount++
      }
      setMessage({
        type: 'success',
        text: `${successCount}件をインポート（うち仮登録 ${provisionalCount}件）`
      })
      // 景品マスタをリフレッシュ
      const p = await getPrizes()
      setPrizes(p)
    } catch (e) {
      setMessage({ type: 'error', text: 'インポート失敗: ' + e.message })
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">読み込み中...</div>

  return (
    <div className="h-screen flex flex-col bg-bg text-text max-w-lg mx-auto">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/inventory')} className="text-muted text-2xl">←</button>
          <h1 className="flex-1 text-xl font-bold text-accent">🔍 景品マッチング</h1>
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pt-0 pb-24">

      {message && (
        <div className={`rounded-xl p-3 mb-4 text-sm ${message.type === 'error' ? 'bg-accent2/20 text-accent2' : 'bg-accent3/20 text-accent3'}`}>
          {message.text}
        </div>
      )}

      {/* ファイル選択 */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <label className="text-xs text-muted block mb-2">棚卸しCSV / 発注CSVを選択</label>
        <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
          className="w-full text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent/20 file:text-accent file:font-bold file:text-xs" />
        <p className="text-xs text-muted mt-2">※ 商品名・数量カラムを自動検出します（Shift_JIS対応）</p>
      </div>

      {/* マッチング結果 */}
      {matchResults.length > 0 && (
        <>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-text">{matchResults.length}件のアイテム</span>
            <div className="flex gap-3 text-xs">
              <span className="text-accent3">✓ マッチ {matchResults.filter(r => r.action === 'match').length}</span>
              <span className="text-accent">? 仮登録 {matchResults.filter(r => r.action === 'provisional').length}</span>
            </div>
          </div>

          <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
            {matchResults.map((r, i) => (
              <div key={i} className={`bg-surface border rounded-xl p-3 ${r.confirmed ? 'border-accent3' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.csvName}</div>
                    {r.matchedPrize && r.action === 'match' && (
                      <div className="text-xs text-accent3 mt-1">
                        → {r.matchedPrize.prize_name}（{Math.round(r.score * 100)}%）
                      </div>
                    )}
                    {r.action === 'provisional' && (
                      <div className="text-xs text-accent mt-1">→ (仮) として新規登録</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-muted">×{r.quantity}</span>
                    <button onClick={() => toggleAction(i)}
                      className={`text-xs px-2 py-1 rounded ${r.action === 'match' ? 'bg-accent3/20 text-accent3' : 'bg-accent/20 text-accent'}`}>
                      {r.action === 'match' ? '既存' : '仮'}
                    </button>
                    <button onClick={() => confirmItem(i)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.confirmed ? 'bg-accent3 text-black' : 'bg-surface2 text-muted'}`}>
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 入庫先選択 + インポート実行 */}
          <div className="bg-surface border border-border rounded-xl p-4 mb-4">
            <label className="text-xs text-muted block mb-2">入庫先（拠点）</label>
            <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="">選択してください</option>
              {locations.map(l => (
                <option key={l.location_id} value={l.location_id}>
                  {l.parent_location_id ? '　└ ' : ''}{l.name}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleImport} disabled={saving}
            className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50">
            {saving ? 'インポート中...' : `確認済み ${matchResults.filter(r => r.confirmed).length}件 をインポート`}
          </button>
        </>
      )}

      {importItems.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-6 text-center text-sm text-muted">
          <div className="text-3xl mb-3">📄</div>
          <p>発注CSV（景品フォーム等）をアップロードすると<br/>景品マスタと自動照合します</p>
          <p className="mt-2 text-xs">マッチしないものは (仮) として仮登録できます</p>
        </div>
      )}
      </div>{/* スクロール領域終了 */}
    </div>
  )
}
