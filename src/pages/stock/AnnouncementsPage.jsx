// SPEC-STOCK-ANNOUNCEMENTS-01: 景品案内ビューア (お気に入り付き)。
// 新着タブ + お気に入りタブ、supplier 絞り込み pill、ハート tap → bottom sheet メモ入力。
// UI-CHARTER-V2 [B] layout: text-base / 44px touch / Progressive Disclosure。
// ERROR-HANDLING-V1: 取得失敗時は banner + 再試行可。
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const [annoParams] = useSearchParams()
  const { staffId } = useAuth()
  const goBack = () => {
    const ownerType = annoParams.get('owner_type')
    const ownerId   = annoParams.get('owner_id')
    return ownerType && ownerId
      ? navigate(`/stock/hub?owner_type=${ownerType}&owner_id=${ownerId}`)
      : navigate('/stock')
  }
  const [tab, setTab] = useState('new')        // 'new' | 'favorites'
  const [supplier, setSupplier] = useState('all')
  const [newRows, setNewRows] = useState([])
  const [favRows, setFavRows] = useState([])
  const [staffNames, setStaffNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // SPEC-STOCK-ANNOUNCEMENTS-02: 一覧タップで詳細 sheet、詳細内のハートで memo sub-sheet。
  const [detailRow, setDetailRow] = useState(null)        // 詳細 sheet 対象 row
  const [sheetRow, setSheetRow] = useState(null)          // メモ入力 sub-sheet 対象 row
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

  // SPEC-STOCK-ANNOUNCEMENTS-02: 各 list / 詳細 sheet の row state を最新化する共通 updater。
  function applyUpdatedRow(updated) {
    setNewRows(prev => prev.map(r => r.id === updated.id ? updated : r))
    setFavRows(prev => {
      const exists = prev.some(r => r.id === updated.id)
      if ((updated.favorited_by ?? []).length === 0 && exists) {
        return prev.filter(r => r.id !== updated.id)
      }
      return exists
        ? prev.map(r => r.id === updated.id ? updated : r)
        : [updated, ...prev]
    })
    setDetailRow(prev => prev && prev.id === updated.id ? updated : prev)
  }

  function openMemoSheet(row) {
    setSheetRow(row)
    setSheetMemo(row.favorite_memo || '')
  }
  function closeMemoSheet() {
    setSheetRow(null)
    setSheetMemo('')
  }
  async function confirmFavorite() {
    if (!sheetRow) return
    const updated = await addFavorite({ id: sheetRow.id, staffId, memo: sheetMemo || null })
    if (updated) applyUpdatedRow(updated)
    closeMemoSheet()
  }
  async function handleUnfavorite(row) {
    const updated = await removeFavorite({ id: row.id, staffId })
    if (updated) applyUpdatedRow(updated)
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
        onBack={goBack}
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
            onTapRow={setDetailRow}
          />
        )}
        {!loading && !error && tab === 'favorites' && (
          <FavList
            rows={favRows}
            staffNames={staffNames}
            onTapRow={setDetailRow}
          />
        )}
      </div>

      {/* SPEC-STOCK-ANNOUNCEMENTS-02: 詳細 bottom sheet (写真 + 明細 + ❤️ ボタン) */}
      {detailRow && (
        <AnnouncementDetailSheet
          row={detailRow}
          mine={isFavoritedByMe(detailRow)}
          onClose={() => setDetailRow(null)}
          onTapFavorite={() => openMemoSheet(detailRow)}
          onTapUnfavorite={() => handleUnfavorite(detailRow)}
        />
      )}

      {/* メモ入力 sub-sheet (詳細 sheet 内の ❤️ から開く) */}
      {sheetRow && (
        <FavoriteMemoSheet
          row={sheetRow}
          memo={sheetMemo}
          onMemoChange={setSheetMemo}
          onCancel={closeMemoSheet}
          onConfirm={confirmFavorite}
        />
      )}
    </div>
  )
}

function NewList({ rows, isFavoritedByMe, onTapRow }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted py-8">該当の景品案内はありません</p>
  }
  return (
    <ul className="flex flex-col gap-2 p-4">
      {rows.map(r => {
        const mine = isFavoritedByMe(r)
        return (
          // SPEC-STOCK-ANNOUNCEMENTS-02: 行全体 tap で詳細 sheet を開く。
          // ハートは 登録済み=❤️ / 未登録=🤍 の視覚インジケータのみ (非 button、event 不通)。
          <li
            key={r.id}
            data-testid={`announce-row-${r.id}`}
            onClick={() => onTapRow(r)}
            className="relative flex items-start gap-2 p-3 rounded-xl bg-surface border border-border active:bg-bg/60 cursor-pointer"
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
            <span
              data-testid={`announce-fav-indicator-${r.id}`}
              aria-label={mine ? 'お気に入り済' : '未お気に入り'}
              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-2xl pointer-events-none"
            >
              {mine ? '❤️' : '🤍'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function FavList({ rows, staffNames, onTapRow }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted py-8">お気に入りはまだありません</p>
  }
  return (
    <ul className="flex flex-col gap-2 p-4">
      {rows.map(r => (
        // SPEC-STOCK-ANNOUNCEMENTS-02: お気に入り行も tap で詳細 sheet を開く。
        <li
          key={r.id}
          data-testid={`announce-fav-row-${r.id}`}
          onClick={() => onTapRow(r)}
          className="flex flex-col gap-1 p-3 rounded-xl bg-surface border border-border active:bg-bg/60 cursor-pointer"
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

// SPEC-STOCK-ANNOUNCEMENTS-02: 詳細 bottom sheet。写真 + 明細 + ❤️ ボタン (memo sub-sheet 起動)。
// スワイプダウン (タッチ縦移動 > 80px) で onClose 発火、scrim タップでも閉じる。
function AnnouncementDetailSheet({ row, mine, onClose, onTapFavorite, onTapUnfavorite }) {
  const [dragOffset, setDragOffset] = useState(0)
  const startYRef = useRef(null)

  function onTouchStart(e) {
    startYRef.current = e.touches?.[0]?.clientY ?? null
  }
  function onTouchMove(e) {
    if (startYRef.current == null) return
    const dy = (e.touches?.[0]?.clientY ?? 0) - startYRef.current
    // 下方向のみ追従 (上方向はスクロール優先)
    if (dy > 0) setDragOffset(dy)
  }
  function onTouchEnd() {
    if (dragOffset > 80) {
      onClose()
    } else {
      setDragOffset(0)
    }
    startYRef.current = null
  }

  return (
    <>
      <style>{`@keyframes annDetailUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        data-testid="announce-detail-sheet"
      >
        <div className="absolute inset-0 bg-black/55" />
        <div
          className="absolute left-0 right-0 bottom-0 max-h-[85dvh] overflow-y-auto bg-surface border-t-2 border-accent rounded-t-2xl"
          style={{
            animation: dragOffset === 0 ? 'annDetailUp 220ms ease-out' : 'none',
            transform: `translateY(${dragOffset}px)`,
            transition: dragOffset === 0 ? 'transform 180ms ease-out' : 'none',
            willChange: 'transform',
          }}
          onClick={e => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* grab handle */}
          <div className="flex justify-center pt-2 pb-1">
            <span className="block w-12 h-1.5 rounded-full bg-border" />
          </div>

          {/* 写真 (image_url ありなら全幅、なければプレースホルダー) */}
          {row.image_url ? (
            <img
              src={row.image_url}
              alt={row.prize_name}
              data-testid="announce-detail-image"
              className="w-full max-h-[40dvh] object-contain bg-bg"
              loading="lazy"
            />
          ) : (
            <div
              data-testid="announce-detail-image-placeholder"
              className="w-full h-32 flex items-center justify-center text-muted text-sm bg-bg border-y border-border"
            >
              （写真なし）
            </div>
          )}

          <div className="p-4 pb-8">
            <p className="text-lg font-bold leading-snug">{row.prize_name}</p>
            <p className="text-xs text-muted mt-1">
              {row.supplier_id || '-'}
              {row.release_date && <>　・　発売: {formatJstDate(row.release_date)}</>}
            </p>

            {/* 価格 + 入数 + ケース合計 */}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-bg/60 p-2 border border-border">
                <dt className="text-[10px] text-muted">単価</dt>
                <dd data-testid="announce-detail-unit-cost" className="text-base font-bold">{formatYen(row.unit_cost)}</dd>
              </div>
              <div className="rounded-lg bg-bg/60 p-2 border border-border">
                <dt className="text-[10px] text-muted">入数</dt>
                <dd data-testid="announce-detail-case-quantity" className="text-base font-bold">
                  {row.case_quantity != null ? `${row.case_quantity}個` : '-'}
                </dd>
              </div>
              <div className="rounded-lg bg-bg/60 p-2 border border-border">
                <dt className="text-[10px] text-muted">ケース合計</dt>
                <dd data-testid="announce-detail-case-cost" className="text-base font-bold">{formatYen(row.case_cost)}</dd>
              </div>
            </dl>

            {row.notes && (
              <p className="mt-3 text-sm text-text px-3 py-2 rounded-lg bg-bg/60 border border-border whitespace-pre-wrap">
                {row.notes}
              </p>
            )}

            {/* ❤️ お気に入りボタン (シート内に集約、memo 入力は sub-sheet) */}
            <div className="mt-4">
              <button
                data-testid="announce-detail-fav-button"
                aria-label={mine ? 'お気に入り解除' : 'お気に入り登録'}
                onClick={() => (mine ? onTapUnfavorite() : onTapFavorite())}
                className={`w-full min-h-[48px] rounded-lg text-base font-bold border ${
                  mine
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                    : 'bg-accent text-white border-accent'
                }`}
              >
                {mine ? '❤️ お気に入り解除' : '🤍 お気に入りに追加'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
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
