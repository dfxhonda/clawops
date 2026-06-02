// SPEC-STOCK-ANNOUNCEMENTS-01: 景品案内ビューア (お気に入り付き)。
// 新着タブ + お気に入りタブ、supplier 絞り込み pill、ハート tap → bottom sheet メモ入力。
// UI-CHARTER-V2 [B] layout: text-base / 44px touch / Progressive Disclosure。
// ERROR-HANDLING-V1: 取得失敗時は banner + 再試行可。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import {
  fetchNewAnnouncements,
  fetchFavoriteAnnouncements,
  addFavorite,
  removeFavorite,
  fetchStaffNamesMap,
} from '../../services/announcements'

const SUPPLIER_PILLS = [
  { id: 'all', label: '全て' },
  { id: 'SDY',  label: 'SDY' },
  { id: 'INF',  label: 'INF' },
  { id: 'PCH',  label: 'PCH' },
  { id: 'SGP',  label: 'SGP' },
]

function formatYen(n) {
  if (n == null) return '-'
  return `¥${Number(n).toLocaleString('ja-JP')}`
}

// JST 短縮日付 (CLAUDE.md jst_date_handling: toISOString 禁止、toLocaleDateString sv-SE 使用)
function formatJstDate(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  } catch {
    return '-'
  }
}

export default function AnnouncementsPage() {
  const navigate = useNavigate()
  const { staffId } = useAuth()
  const [tab, setTab] = useState('new')        // 'new' | 'favorites'
  const [supplier, setSupplier] = useState('all')
  const [newRows, setNewRows] = useState([])
  const [favRows, setFavRows] = useState([])
  const [staffNames, setStaffNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetRow, setSheetRow] = useState(null) // モーダル対象 row (null = 非表示)
  const [sheetMemo, setSheetMemo] = useState('')

  // 新着タブ fetch (タブ切替 or supplier 変更で再 fetch)
  useEffect(() => {
    if (tab !== 'new') return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchNewAnnouncements({ supplierId: supplier })
      .then(rows => { if (!cancelled) { setNewRows(rows); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e?.message || 'fetch error'); setLoading(false) } })
    return () => { cancelled = true }
  }, [tab, supplier])

  // お気に入りタブ fetch + staff 名前 lookup
  useEffect(() => {
    if (tab !== 'favorites') return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchFavoriteAnnouncements()
      .then(async rows => {
        if (cancelled) return
        const allIds = rows.flatMap(r => Array.isArray(r.favorited_by) ? r.favorited_by : [])
        const namesMap = await fetchStaffNamesMap(allIds)
        if (cancelled) return
        setFavRows(rows)
        setStaffNames(namesMap)
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e?.message || 'fetch error'); setLoading(false) } })
    return () => { cancelled = true }
  }, [tab])

  const newBadge = newRows.filter(r => r.status === 'unread').length
  const favBadge = useMemo(() => favRows.length, [favRows])

  function openFavSheet(row) {
    setSheetRow(row)
    setSheetMemo(row.favorite_memo || '')
  }
  function closeSheet() {
    setSheetRow(null)
    setSheetMemo('')
  }
  async function confirmFavorite() {
    if (!sheetRow) return
    const updated = await addFavorite({ id: sheetRow.id, staffId, memo: sheetMemo || null })
    if (updated) {
      // 新着 list の該当 row を update 反映
      setNewRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      // お気に入り list にも反映 (タブ未切替でも整合)
      setFavRows(prev => {
        const exists = prev.some(r => r.id === updated.id)
        return exists ? prev.map(r => r.id === updated.id ? updated : r) : [updated, ...prev]
      })
    }
    closeSheet()
  }
  async function handleUnfavorite(row) {
    const updated = await removeFavorite({ id: row.id, staffId })
    if (updated) {
      setNewRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      const stillFavorited = (updated.favorited_by ?? []).length > 0
      setFavRows(prev => stillFavorited
        ? prev.map(r => r.id === updated.id ? updated : r)
        : prev.filter(r => r.id !== updated.id))
    }
  }

  function isFavoritedByMe(row) {
    return Array.isArray(row.favorited_by) && row.favorited_by.includes(staffId)
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="tanasupport"
        title="景品案内"
        variant="compact"
        onBack={() => navigate('/tanasupport')}
      />

      {/* タブバー */}
      <div className="sticky top-0 z-10 bg-bg shrink-0 flex gap-1 px-4 py-2 border-b border-border">
        {[
          ['new',       '新着',       newBadge],
          ['favorites', 'お気に入り', favBadge],
        ].map(([key, label, badge]) => (
          <button
            key={key}
            data-testid={`announce-tab-${key}`}
            onClick={() => setTab(key)}
            className={`flex-1 min-h-[44px] py-2 rounded-lg text-base font-bold transition-colors ${
              tab === key ? 'bg-accent text-white' : 'bg-surface text-muted'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className="ml-2 inline-block bg-rose-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px]">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 新着タブ: supplier pill */}
      {tab === 'new' && (
        <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-2 border-b border-border">
          {SUPPLIER_PILLS.map(p => (
            <button
              key={p.id}
              data-testid={`supplier-pill-${p.id}`}
              onClick={() => setSupplier(p.id)}
              className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-sm font-bold border ${
                supplier === p.id
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-text border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 本体 */}
      <div className="flex-1 overflow-y-auto" data-testid="announce-list">
        {loading && (
          <p className="text-center text-sm text-muted py-8">読み込み中...</p>
        )}
        {!loading && error && (
          <div role="alert" className="m-4 p-3 rounded-lg bg-rose-500/10 text-rose-300 text-sm">
            取得失敗: {error}
          </div>
        )}
        {!loading && !error && tab === 'new' && (
          <NewList
            rows={newRows}
            isFavoritedByMe={isFavoritedByMe}
            onTapFavorite={openFavSheet}
            onUnfavorite={handleUnfavorite}
          />
        )}
        {!loading && !error && tab === 'favorites' && (
          <FavList
            rows={favRows}
            staffNames={staffNames}
          />
        )}
      </div>

      {/* メモ入力 bottom sheet */}
      {sheetRow && (
        <FavoriteMemoSheet
          row={sheetRow}
          memo={sheetMemo}
          onMemoChange={setSheetMemo}
          onCancel={closeSheet}
          onConfirm={confirmFavorite}
        />
      )}
    </div>
  )
}

function NewList({ rows, isFavoritedByMe, onTapFavorite, onUnfavorite }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted py-8">該当の景品案内はありません</p>
  }
  return (
    <ul className="flex flex-col gap-2 p-4">
      {rows.map(r => {
        const mine = isFavoritedByMe(r)
        return (
          <li
            key={r.id}
            data-testid={`announce-row-${r.id}`}
            className="relative flex items-start gap-2 p-3 rounded-xl bg-surface border border-border"
          >
            {r.status === 'unread' && (
              <span
                aria-label="未読"
                className="absolute -left-1 top-3 w-2 h-2 rounded-full bg-rose-500"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold truncate">{r.prize_name}</p>
              <p className="text-xs text-muted mt-0.5">
                {r.supplier_id || '-'} ・ {formatYen(r.unit_cost)}
                {r.case_quantity != null && <> ・ {r.case_quantity}入</>}
              </p>
              <p className="text-[10px] text-muted/70 mt-1">{formatJstDate(r.created_at)}</p>
            </div>
            <button
              data-testid={`announce-fav-toggle-${r.id}`}
              aria-label={mine ? 'お気に入り解除' : 'お気に入り登録'}
              onClick={() => (mine ? onUnfavorite(r) : onTapFavorite(r))}
              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-2xl"
            >
              {mine ? '❤️' : '🤍'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FavList({ rows, staffNames }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted py-8">お気に入りはまだありません</p>
  }
  return (
    <ul className="flex flex-col gap-2 p-4">
      {rows.map(r => (
        <li
          key={r.id}
          data-testid={`announce-fav-row-${r.id}`}
          className="flex flex-col gap-1 p-3 rounded-xl bg-surface border border-border"
        >
          <p className="text-base font-bold truncate">{r.prize_name}</p>
          <p className="text-xs text-muted">
            {r.supplier_id || '-'} ・ {formatYen(r.unit_cost)}
            {r.case_quantity != null && <> ・ {r.case_quantity}入</>}
          </p>
          {r.favorite_memo && (
            <p className="text-sm text-text mt-1 px-2 py-1 rounded bg-bg/60 border border-border">
              {r.favorite_memo}
            </p>
          )}
          <p className="text-[10px] text-muted/80">
            <span className="font-bold">登録: </span>
            {(r.favorited_by ?? [])
              .map(sid => staffNames[sid] || sid)
              .join(', ') || '-'}
            <span className="ml-2">{formatJstDate(r.favorited_at)}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

function FavoriteMemoSheet({ row, memo, onMemoChange, onCancel, onConfirm }) {
  return (
    <>
      <style>{`@keyframes annSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div
        className="fixed inset-0 z-50"
        onClick={onCancel}
        data-testid="favorite-memo-sheet"
      >
        <div className="absolute inset-0 bg-black/55" />
        <div
          className="absolute left-0 right-0 bottom-0 p-4 pb-8 bg-surface border-t-2 border-accent rounded-t-2xl"
          style={{ animation: 'annSlideUp 200ms ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-base font-bold mb-1 truncate">{row.prize_name}</p>
          <p className="text-xs text-muted mb-3">メモ (任意)</p>
          <textarea
            data-testid="favorite-memo-input"
            value={memo}
            onChange={e => onMemoChange(e.target.value)}
            placeholder="例: 来月のイベント候補"
            className="w-full min-h-[80px] p-2 rounded-lg bg-bg text-text border border-border text-base"
            style={{ fontSize: 16 }}
          />
          <div className="flex gap-2 mt-3">
            <button
              data-testid="favorite-memo-cancel"
              onClick={onCancel}
              className="flex-1 min-h-[44px] rounded-lg bg-surface border border-border text-base font-bold"
            >キャンセル</button>
            <button
              data-testid="favorite-memo-confirm"
              onClick={onConfirm}
              className="flex-1 min-h-[44px] rounded-lg bg-accent text-white text-base font-bold"
            >確定</button>
          </div>
        </div>
      </div>
    </>
  )
}
