// SPEC-ARRIVAL-UX-01: 景品詳細 bottom sheet ダイアログ。
// ArrivalCheckPage / OrderList / AdminPrizeMasterPage の景品名タップで開く。
// row prop に含まれる prize_orders / prize_masters 既知フィールドをまず表示し、
// prize_id があれば追加で prize_masters を fetch して原価/仕入先/画像等を合成する。
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
// SPEC-PHASE-LABEL-FIX-01: phase の生値ではなく日本語ラベルで表示。
import { getPhaseLabel } from '../constants/phaseLabels'
import { isInternalNote, statusLabel } from '../lib/prizeUtils'

const IMG_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/announcements/`

const PRIZE_MASTERS_SELECT =
  'prize_id, prize_name, image_url, original_cost, supplier_name, category, size, jan_code, phase, notes'

function fmtYen(n) {
  if (n == null) return null
  return `¥${Number(n).toLocaleString('ja-JP')}`
}

function fmtJstDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  } catch { return null }
}

/**
 * row: prize_orders 行 (prize_id 任意) or prize_masters 行 (image_url 等を直接保持)。
 * onClose: 閉じる callback。
 */
export default function PrizeDetailDialog({ row, onClose }) {
  const [masterRow, setMasterRow]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      const pid = row?.prize_id
      if (!pid) return
      // row 自体が prize_masters 行なら追加 fetch 不要
      if (row.image_url !== undefined || row.original_cost !== undefined || row.supplier_name !== undefined) {
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('prize_masters')
        .select(PRIZE_MASTERS_SELECT)
        .eq('prize_id', pid)
        .maybeSingle()
      if (cancel) return
      if (error) { setFetchError(error.message); setLoading(false); return }
      setMasterRow(data ?? null)
      setLoading(false)
    }
    load()
    return () => { cancel = true }
  }, [row])

  if (!row) return null

  const m = masterRow ?? {}
  const name      = row.prize_name_raw ?? row.prize_name ?? m.prize_name ?? '(名称不明)'
  const imageUrl  = row.image_url ?? m.image_url ?? null
  const cost      = row.original_cost ?? m.original_cost ?? null
  const supplier  = row.supplier_name ?? m.supplier_name ?? null
  const category  = row.category ?? m.category ?? null
  const size      = row.size ?? m.size ?? null
  const jan       = row.jan_code ?? m.jan_code ?? null
  const phase     = row.phase ?? m.phase ?? null
  const notes     = row.notes ?? m.notes ?? null

  // master 由来情報が 1 つでもあるなら linked、なければ unlinked と判定。
  // prize_id があってもまだ fetch 結果が来ていない (loading 中) 場合は loading 表示が出る。
  const masterFields = [imageUrl, cost, supplier, category, size, jan, phase, notes]
  const hasMaster = masterFields.some(v => v != null && v !== '')

  return (
    <>
      <style>{`@keyframes prizeDetailUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        data-testid="prize-detail-dialog"
      >
        <div className="absolute inset-0 bg-black/55" />
        <div
          className="absolute left-0 right-0 bottom-0 max-h-[85dvh] overflow-y-auto bg-surface border-t-2 border-accent rounded-t-2xl"
          style={{ animation: 'prizeDetailUp 220ms ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          {/* grab handle */}
          <div className="flex justify-center pt-2 pb-1">
            <span className="block w-12 h-1.5 rounded-full bg-border" />
          </div>

          {/* 画像: image_url ありなら全幅、なし or NULL なら『画像未登録』プレースホルダ */}
          {imageUrl ? (
            <img
              src={IMG_BASE + imageUrl}
              alt={name}
              data-testid="prize-detail-image"
              className="w-full max-h-[40dvh] object-contain bg-bg"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div
              data-testid="prize-detail-noimg"
              className="flex items-center justify-center w-full h-20 bg-surface/40 border-b border-border/50"
            >
              <span className="text-sm text-muted">画像未登録</span>
            </div>
          )}

          <div className="p-4 pb-8">
            <p className="text-lg font-bold leading-snug">{name}</p>

            {/* prize_orders 由来の常時表示フィールド */}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {row.destination != null && (
                <Field label="拠点" value={row.destination} testid="prize-detail-destination" />
              )}
              {row.case_count != null && (
                <Field label="ケース数" value={`${row.case_count}`} testid="prize-detail-case-count" />
              )}
              {row.case_quantity != null && (
                <Field label="入数" value={`${row.case_quantity}個`} testid="prize-detail-case-quantity" />
              )}
              {row.expected_date && (
                <Field label="予定日" value={fmtJstDate(row.expected_date)} testid="prize-detail-expected-date" />
              )}
              {row.status && (
                <Field label="ステータス" value={statusLabel(row.status)} testid="prize-detail-status" />
              )}
              {row.order_date && (
                <Field label="発注日" value={fmtJstDate(row.order_date)} testid="prize-detail-order-date" />
              )}
            </dl>

            {/* prize_master 由来フィールド (linked のとき) */}
            {loading && (
              <p className="mt-3 text-xs text-muted" data-testid="prize-detail-loading">マスタ情報読込中…</p>
            )}
            {!loading && fetchError && (
              <p className="mt-3 text-xs text-rose-300" data-testid="prize-detail-error">マスタ取得失敗: {fetchError}</p>
            )}
            {!loading && !fetchError && !hasMaster && (
              <p
                className="mt-4 text-sm text-amber-400 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30"
                data-testid="prize-detail-unlinked"
              >景品マスタ未登録</p>
            )}
            {!loading && hasMaster && (
              <>
                <p className="mt-4 mb-2 text-xs text-muted">景品マスタ</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  {cost != null    && <Field label="原価"    value={fmtYen(cost)}    testid="prize-detail-original-cost" />}
                  {supplier        && <Field label="仕入先"  value={supplier}        testid="prize-detail-supplier-name" />}
                  {category        && <Field label="カテゴリ" value={category}       testid="prize-detail-category" />}
                  {size            && <Field label="サイズ"  value={size}            testid="prize-detail-size" />}
                  {jan             && <Field label="JAN"    value={jan}             testid="prize-detail-jan" />}
                  {phase           && <Field label="フェーズ" value={getPhaseLabel(phase)} testid="prize-detail-phase" />}
                </dl>
                {notes && !isInternalNote(notes) && (
                  <p className="mt-3 text-sm text-text whitespace-pre-wrap px-3 py-2 rounded bg-bg/60 border border-border"
                     data-testid="prize-detail-notes">
                    {notes}
                  </p>
                )}
              </>
            )}

            {/* 閉じるボタン (scrim タップでも閉じる、a11y 向上のため明示ボタンも併設) */}
            <div className="mt-5">
              <button
                type="button"
                data-testid="prize-detail-close"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-lg bg-surface border border-border text-base font-bold"
              >閉じる</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, testid }) {
  return (
    <>
      <dt className="text-xs text-muted self-center">{label}</dt>
      <dd data-testid={testid} className="text-sm font-bold break-all">{value}</dd>
    </>
  )
}
