import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
// SPEC-LIST-FILTER-SORT-01-fix-01: sortable header (canonical d0cf209)。
// SPEC-PRIZE-MASTER-UI-CLEANUP-01: ListFilterBar (2 行目) は撤廃、inline 1 行 flex に統合。
import SortableTableHeader from '../../components/SortableTableHeader'
// SPEC-PRIZE-MASTER-EDIT-DIALOG-01: 旧 PrizeDetailDialog (読取専用) を撤廃、景品名タップ
// 直接 openEdit() で編集モーダル起動に統一。component 自体は ArrivalCheckPage / OrderList で
// 引き続き使用するため削除しない (grep 確認済)。
// SPEC-PHASE-LABEL-FIX-01: phase 表示名/バッジ/選択肢を集約モジュールから取得 (旧ハードコード PHASE_VALUES 撤去)。
import {
  PHASE_FILTER_OPTIONS,
  PHASE_EDIT_OPTIONS,
  getPhaseLabel,
  getPhaseBadgeClass,
} from '../../constants/phaseLabels'
import { generateShortName } from '../../lib/shortenPrizeName'

// SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status 列を SELECT から外し、phase に統一。
// SPEC-PRIZE-NAME-BINDING-FIX-01: aliases 除外、short_name を LIST_SELECT に移動。
// J-SCHEMA-DROP-FIX-01: prize_name_kana/series/order_rules/tags/default_tag/weight_g 列は DB から削除済、SELECT から除外。
const LIST_SELECT = 'prize_id,prize_name,short_name,category,original_cost,supplier_name,latest_order_date,phase,registered_at'
const EDIT_SELECT = LIST_SELECT + ',size,supplier_id,supplier_item_code,jan_code,default_case_quantity,image_url,notes,organization_id,updated_at,updated_by,registered_by'

// SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: STATUS_VALUES 撤廃、phase で表現 (PHASE_FILTER_OPTIONS 参照)。

function Field({ label, children, row }) {
  return (
    <div className={`flex ${row ? 'flex-row items-center gap-2' : 'flex-col gap-0.5'}`}>
      {label && <span className="text-xs text-muted whitespace-nowrap">{label}</span>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required, className = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full ${className}`}
    />
  )
}


function SortTh({ col, label, align = 'left', sortCol, sortAsc, onSort }) {
  const active = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`py-1 px-2 whitespace-nowrap cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-blue-400' : 'text-muted hover:text-text'}`}
    >
      {label}{active ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )
}

const EMPTY_FORM = {
  // J-SCHEMA-DROP-FIX-01: 削除済列 (prize_name_kana/series/order_rules/tags/default_tag/weight_g) を初期値から除外。
  // SPEC-PRIZE-NAME-BINDING-FIX-01: aliases 除外、short_name 追加。
  prize_name: '', short_name: '', category: '',
  // SPEC-PHASE-LABEL-FIX-01: 新規登録 default phase は実在値 'active'。
  // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status 撤廃、phase のみ。
  size: '', phase: 'active',
  original_cost: '', supplier_id: '', supplier_name: '', supplier_item_code: '',
  jan_code: '', default_case_quantity: '', image_url: '', notes: '',
}

export default function AdminPrizeMasterPage() {
  const { staffName } = useAuth()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [totalCount, setTotal]  = useState(null)
  const [sortCol, setSortCol]   = useState('registered_at')
  const [sortAsc, setSortAsc]   = useState(false)
  const [loadKey, setLoadKey]   = useState(0)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('')
  // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: stFilter / status select は撤廃、フェーズ ドロップダウンに統一。
  // SPEC-LIST-FILTER-SORT-01-fix-01: 仕入先 + フェーズ ドロップダウン (client-side filter)。
  const [supplierFilter, setSupplierFilter] = useState('')
  const [phaseFilter, setPhaseFilter]       = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [gridMode, setGridMode] = useState(false)
  const [gridEdits, setGridEdits] = useState({})
  const [gridSaving, setGridSaving] = useState(false)
  // SPEC-PRIZE-MASTER-EDIT-DIALOG-01: detailRow state 撤廃、景品名タップは openEdit に統合。

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      let q = supabase
        .from('prize_masters')
        .select(LIST_SELECT, { count: 'exact' })
        .order(sortCol, { ascending: sortAsc })
      if (search.trim()) q = q.or(`prize_name.ilike.%${search}%,short_name.ilike.%${search}%`)
      if (catFilter)     q = q.ilike('category', `%${catFilter}%`)
      // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status server-side filter 撤廃、phase は ListFilterBar で client-side。
      const { data, count, error: e } = await q
      if (cancelled) return
      if (e) setError(e.message)
      else { setRows(data ?? []); if (count !== null) setTotal(count) }
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [sortCol, sortAsc, search, catFilter, loadKey]) // eslint-disable-line

  function handleSort(col) {
    if (col === sortCol) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }
  function handleSearch(v)  { setSearch(v) }
  function handleCat(v)     { setCat(v) }
  function reload()         { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setShowMore(false)
    setError(null)
  }

  async function openEdit(row) {
    const { data, error: e } = await supabase
      .from('prize_masters')
      .select(EDIT_SELECT)
      .eq('prize_id', row.prize_id)
      .single()
    if (e) { setError(e.message); return }
    setForm({
      // J-SCHEMA-DROP-FIX-01: 削除済列 (prize_name_kana/series/order_rules/tags/default_tag/weight_g) は読込対象外。
      // SPEC-PRIZE-NAME-BINDING-FIX-01: aliases → short_name に変更。
      prize_name: data.prize_name ?? '', short_name: data.short_name ?? '',
      category: data.category ?? '',
      size: data.size ?? '',
      // SPEC-PHASE-LABEL-FIX-01: 既存行 phase が null/未マップ値でも 'active' に矯正せず DB 値を保持。
      // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status 撤廃、phase のみ。
      phase: data.phase ?? 'active',
      original_cost: data.original_cost ?? '', supplier_id: data.supplier_id ?? '',
      supplier_name: data.supplier_name ?? '', supplier_item_code: data.supplier_item_code ?? '',
      jan_code: data.jan_code ?? '', default_case_quantity: data.default_case_quantity ?? '',
      image_url: data.image_url ?? '', notes: data.notes ?? '',
    })
    setModal(data)
    setShowMore(false)
    setError(null)
  }

  async function handleSave() {
    if (!form.prize_name.trim()) { setError('正式名称は必須です'); return }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const shortName = form.short_name.trim()
      ? form.short_name.trim()
      : await generateShortName(form.prize_name)
    const payload = {
      ...form,
      short_name: shortName || null,
      original_cost: form.original_cost === '' ? null : Number(form.original_cost),
      default_case_quantity: form.default_case_quantity === '' ? null : Number(form.default_case_quantity),
      updated_by: staffName,
      updated_at: now,
    }
    if (modal === 'new') {
      const { error: e } = await supabase.from('prize_masters').insert({
        prize_id: crypto.randomUUID(),
        organization_id: DFX_ORG_ID,
        ...payload,
        registered_by: staffName,
      })
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('prize_masters')
        .update(payload)
        .eq('prize_id', modal.prize_id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    reload()
  }

  async function handleSoftDelete() {
    if (!modal || modal === 'new') return
    setSaving(true)
    const { error: e } = await supabase.from('prize_masters')
      // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: 旧 status='inactive' soft-delete → phase='dead' に統一。
      .update({ phase: 'dead', updated_by: staffName, updated_at: new Date().toISOString() })
      .eq('prize_id', modal.prize_id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setModal(null)
    reload()
  }

  const f = (v) => setForm(prev => ({ ...prev, ...v }))
  const caseTotal = (Number(form.original_cost) || 0) * (Number(form.default_case_quantity) || 0)

  const gridCellCls = "w-full h-7 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded [color-scheme:dark]"

  function setGCell(id, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.prize_id === id)
      const base = prev[id] ?? {
        prize_name: row?.prize_name ?? '',
        short_name: row?.short_name ?? '',
        category: row?.category ?? '',
        // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status 撤廃、phase で表現。
        phase: row?.phase ?? 'active',
        original_cost: row?.original_cost ?? '',
        supplier_name: row?.supplier_name ?? '',
      }
      return { ...prev, [id]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    for (const [id, ge] of Object.entries(gridEdits)) {
      // SPEC-PHASE-LABEL-FIX-01: グリッド編集対象が status → phase に切替。
      // SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: status 列は廃止、phase 一本化。
      const { error: ge_err } = await supabase.from('prize_masters').update({
        prize_name: ge.prize_name,
        short_name: ge.short_name || null,
        category: ge.category || null,
        phase: ge.phase,
        original_cost: ge.original_cost === '' ? null : Number(ge.original_cost),
        supplier_name: ge.supplier_name || null,
        updated_by: staffName,
        updated_at: now,
      }).eq('prize_id', id)
      if (ge_err) { setError(ge_err.message); setGridSaving(false); return }
    }
    setGridSaving(false)
    setGridEdits({})
    reload()
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* SPEC-LIST-FILTER-SORT-01-fix-01: 共通 ListFilterBar (仕入先 + フェーズ)、
          既存 toolbar の検索 + カテゴリ + ステータスは保持 (異なる検索軸のため併用)。
          supplier options は現在 fetch 済 rows から distinct で算出。 */}
      {/* SPEC-PRIZE-MASTER-UI-CLEANUP-01: 旧 ListFilterBar (2 行目) + toolbar (3 行目) を
          1 行 flex-wrap に統合。iOS Safari の zoom 抑止のため select/input は fontSize:16px。 */}
      <div className="flex-shrink-0 p-3 pb-2">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1 text-xs text-muted">
            <span>仕入先</span>
            <select
              data-testid="prize-filter-supplier"
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
              style={{ fontSize: 16 }}
            >
              <option value="">全て</option>
              {Array.from(new Set(rows.map(r => r.supplier_name).filter(Boolean))).sort()
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            <span>フェーズ</span>
            <select
              data-testid="prize-filter-phase"
              value={phaseFilter}
              onChange={e => setPhaseFilter(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
              style={{ fontSize: 16 }}
            >
              {PHASE_FILTER_OPTIONS.map(o => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <input
            data-testid="prize-search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="景品名・短縮名 検索"
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text flex-1 min-w-[160px]"
            style={{ fontSize: 16 }}
          />
          <input
            data-testid="prize-filter-category"
            value={catFilter}
            onChange={e => handleCat(e.target.value)}
            placeholder="カテゴリ絞込"
            className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-28"
            style={{ fontSize: 16 }}
          />
          {(supplierFilter || phaseFilter) && (
            <button
              onClick={() => { setSupplierFilter(''); setPhaseFilter('') }}
              className="text-xs text-accent underline decoration-dotted whitespace-nowrap"
            >リセット</button>
          )}
          {totalCount !== null && (
            <span data-testid="prize-total-count" className="text-sm text-muted whitespace-nowrap">
              全{totalCount.toLocaleString()}件
            </span>
          )}
          <button
            data-testid="prize-new-button"
            onClick={openNew}
            className="ml-auto px-3 py-1 rounded bg-blue-600 text-white text-sm font-bold whitespace-nowrap"
          >
            + 新規登録
          </button>
          <button
            onClick={() => { setGridMode(m => !m); setGridEdits({}) }}
            className={`px-3 py-1 rounded text-sm font-bold whitespace-nowrap border ${gridMode ? 'bg-amber-600 text-white border-transparent' : 'border-border text-muted'}`}
          >
            {gridMode ? '⊞ 表編集中' : '⊞ 表編集'}
          </button>
        </div>
      </div>

      {gridMode && Object.keys(gridEdits).length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-y border-amber-700/40">
          <span className="text-sm text-amber-400">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-sm text-muted px-2 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-sm text-white bg-blue-600 px-3 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 overflow-x-auto">
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-muted text-sm py-8">該当なし</p>
        )}
        <div data-testid="prize-list">
          <table className="w-full text-sm border-collapse">
            {/* SPEC-LIST-FILTER-SORT-01-fix-01: 既存 SortTh を共通 SortableTableHeader に置換。
                sortCol/sortAsc を sortKey/sortDir にマップし、ソートは server-side (既存 query) 維持。
                spec sort_columns: prize_name, supplier_name, original_cost, registered_at, phase。
                'カテゴリ' / 'ST' は非ソート列のため pointer-events-none + __NOSORT__ key で除外。 */}
            <thead className="sticky top-0 bg-bg z-10">
              <SortableTableHeader
                variant="tr"
                columns={[
                  { key: 'prize_name',        label: '景品名',  className: 'py-1 px-2 whitespace-nowrap text-left text-muted' },
                  { key: '__category__',      label: 'カテゴリ', className: 'py-1 px-2 whitespace-nowrap text-left text-muted pointer-events-none' },
                  // SPEC-PHASE-LABEL-FIX-01: 旧 'ST' (status 列) を 'ステータス' (phase 列) に再定義。
                  // SPEC-PRIZE-MASTER-UI-CLEANUP-01: フィルタ「フェーズ」とヘッダ表記を統一 (旧 'ステータス'→'フェーズ')。
                  { key: '__phase_badge__',   label: 'フェーズ', className: 'py-1 px-2 whitespace-nowrap text-left text-muted pointer-events-none' },
                  { key: 'original_cost',     label: '原価',    className: 'py-1 px-2 whitespace-nowrap text-right text-muted' },
                  { key: 'supplier_name',     label: '取引先',  className: 'py-1 px-2 whitespace-nowrap text-left text-muted' },
                  { key: 'latest_order_date', label: '最終発注', className: 'py-1 px-2 whitespace-nowrap text-left text-muted' },
                ]}
                sortKey={sortCol}
                sortDir={sortAsc ? 'asc' : 'desc'}
                onSort={(k) => { if (k && !k.startsWith('__')) handleSort(k) }}
                className="border-b border-border"
              />
            </thead>
            <tbody>
              {rows.filter(r =>
                (!supplierFilter || r.supplier_name === supplierFilter) &&
                // SPEC-PRIZE-MASTER-UI-CLEANUP-01: 'provisional' 選択時は yobigun 行も同ラベル「入荷予定」に
                // 該当するため一緒にヒットさせる (PHASE_FILTER_OPTIONS から yobigun エントリは撤去済)。
                (!phaseFilter
                  || r.phase === phaseFilter
                  || (phaseFilter === 'provisional' && r.phase === 'yobigun'))
              ).map(r => {
                const ge = gridEdits[r.prize_id]
                return (
                  <tr
                    key={r.prize_id}
                    data-testid="prize-row"
                    onClick={gridMode ? undefined : () => openEdit(r)}
                    className={`border-b border-border/50 ${gridMode ? (ge ? 'bg-amber-900/15' : 'hover:bg-surface/30') : 'hover:bg-surface cursor-pointer'}`}
                  >
                    <td className="py-0.5 px-1 max-w-[220px]">
                      {gridMode
                        ? <input value={ge?.short_name ?? r.short_name ?? ''} onChange={ev => setGCell(r.prize_id, 'short_name', ev.target.value)} className={gridCellCls} />
                        : (
                          // SPEC-PRIZE-MASTER-EDIT-DIALOG-01: 景品名タップで openEdit 直接起動。
                          // SPEC-PRIZE-NAME-BINDING-FIX-01: 太字=short_name、サブテキスト=prize_name。
                          <>
                            <button
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); openEdit(r) }}
                              data-testid={`prize-master-name-${r.prize_id}`}
                              className="truncate text-text font-bold text-left underline decoration-dotted decoration-muted/40 hover:decoration-accent cursor-pointer w-full"
                            >
                              {r.short_name || r.prize_name}
                            </button>
                            {r.short_name && <div className="truncate text-xs text-muted">{r.prize_name}</div>}
                          </>
                        )}
                    </td>
                    {/* SPEC-PRIZE-MASTER-UI-CLEANUP-01: 全 td に whitespace-nowrap + truncate
                        を統一して 1 行固定高さに揃える (旧: supplier_name 折り返しで行高さ不揃い)。 */}
                    <td className="py-0.5 px-1 text-muted whitespace-nowrap truncate max-w-[120px]">
                      {gridMode
                        ? <input value={ge?.category ?? r.category ?? ''} onChange={ev => setGCell(r.prize_id, 'category', ev.target.value)} className={gridCellCls} />
                        : r.category}
                    </td>
                    {/* SPEC-PHASE-LABEL-FIX-01: 'ステータス' 列は phase を日本語バッジで表示、
                        grid 編集モードでは phase を編集 (status 列は DB 保持のまま、本列の対象外)。 */}
                    <td className="py-0.5 px-1 whitespace-nowrap">
                      {gridMode
                        ? <select
                            data-testid={`prize-phase-select-${r.prize_id}`}
                            value={ge?.phase ?? r.phase ?? 'active'}
                            onChange={ev => setGCell(r.prize_id, 'phase', ev.target.value)}
                            className="h-7 px-1 bg-bg border border-border/50 text-text text-sm rounded w-full [color-scheme:dark]"
                          >
                            {PHASE_EDIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        : <span
                            data-testid={`prize-phase-badge-${r.prize_id}`}
                            className={`px-1 py-0.5 rounded text-xs font-bold ${getPhaseBadgeClass(r.phase)}`}
                          >
                            {getPhaseLabel(r.phase)}
                          </span>}
                    </td>
                    <td className="py-0.5 px-1 text-right text-muted whitespace-nowrap">
                      {gridMode
                        ? <input type="number" value={ge?.original_cost ?? r.original_cost ?? ''} onChange={ev => setGCell(r.prize_id, 'original_cost', ev.target.value)} className={`${gridCellCls} text-right`} />
                        : (r.original_cost != null ? r.original_cost.toLocaleString() : '')}
                    </td>
                    <td className="py-0.5 px-1 text-muted whitespace-nowrap truncate max-w-[160px]">
                      {gridMode
                        ? <input value={ge?.supplier_name ?? r.supplier_name ?? ''} onChange={ev => setGCell(r.prize_id, 'supplier_name', ev.target.value)} className={gridCellCls} />
                        : <span className="truncate block">{r.supplier_name}</span>}
                    </td>
                    <td className="py-1 px-2 text-muted whitespace-nowrap">{r.latest_order_date ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div data-testid="prize-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '景品 新規登録' : '景品編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              {/* 1: 景品名 (短縮形) — 空欄で保存すると自動生成 */}
              <Field label="景品名 (短縮形)">
                <input
                  type="text"
                  value={form.short_name}
                  onChange={e => f({ short_name: e.target.value })}
                  placeholder="空欄で自動生成"
                  className="bg-bg border border-border rounded px-2 py-2 text-sm text-text w-full"
                />
              </Field>

              {/* 2: 正式名称 (prize_name) */}
              <Field label="正式名称 *">
                <Input
                  value={form.prize_name}
                  onChange={v => f({ prize_name: v })}
                  placeholder="正式名称"
                />
              </Field>

              {/* 3: 原価 + 入数 + ケース金額 */}
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-0.5 w-24">
                  <span className="text-xs text-muted">単価</span>
                  <Input value={form.original_cost} onChange={v => f({ original_cost: v })} type="number" placeholder="0" />
                </div>
                <div className="flex flex-col gap-0.5 w-20">
                  <span className="text-xs text-muted">入数</span>
                  <Input value={form.default_case_quantity} onChange={v => f({ default_case_quantity: v })} type="number" placeholder="0" />
                </div>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-xs text-muted">ケース金額</span>
                  <div className="bg-bg border border-border/50 rounded px-2 py-1 text-sm text-muted">
                    {caseTotal > 0 ? caseTotal.toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* 4: 仕入先名 + 仕入先ID */}
              <div className="flex gap-2">
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="text-xs text-muted">仕入先名</span>
                  <Input value={form.supplier_name} onChange={v => f({ supplier_name: v })} placeholder="仕入先名" />
                </div>
                <div className="flex flex-col gap-0.5 w-28">
                  <span className="text-xs text-muted">仕入先ID</span>
                  <Input value={form.supplier_id} onChange={v => f({ supplier_id: v })} placeholder="ID" />
                </div>
              </div>

              {/* 5: カテゴリ */}
              <Field label="カテゴリ">
                <Input value={form.category} onChange={v => f({ category: v })} placeholder="カテゴリ" />
              </Field>

              {/* 6: 画像URL */}
              <Field label="画像URL">
                <Input value={form.image_url} onChange={v => f({ image_url: v })} placeholder="https://..." />
              </Field>

              {/* その他 (折りたたみ) */}
              <button
                type="button"
                onClick={() => setShowMore(m => !m)}
                className="text-left text-sm text-muted border-t border-border pt-2 flex items-center gap-1"
              >
                その他 {showMore ? '▲' : '▼'}
              </button>
              {showMore && (
                <div className="flex flex-col gap-3">
                  {/* SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01: ステータス フィールドは撤廃 (phase に統一)。 */}
                  {/* SPEC-PHASE-LABEL-FIX-01: モーダル編集も実在 phase 値 + 日本語ラベル。
                      'ALL' option は不要、編集には常に値を選ぶため PHASE_EDIT_OPTIONS を直接 render。 */}
                  <Field label="フェーズ">
                    <select
                      value={form.phase ?? 'active'}
                      onChange={e => f({ phase: e.target.value })}
                      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
                    >
                      {PHASE_EDIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="サイズ">
                    <Input value={form.size} onChange={v => f({ size: v })} placeholder="サイズ" />
                  </Field>
                  <Field label="JANコード">
                    <Input value={form.jan_code} onChange={v => f({ jan_code: v })} placeholder="JAN" />
                  </Field>
                  <Field label="備考">
                    <textarea
                      value={form.notes ?? ''}
                      onChange={e => f({ notes: e.target.value })}
                      rows={2}
                      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full resize-none"
                      placeholder="備考"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {modal !== 'new' && (
                <button
                  data-testid="prize-delete-button"
                  onClick={handleSoftDelete}
                  disabled={saving}
                  className="px-3 py-1.5 rounded bg-red-800 text-white text-sm font-bold disabled:opacity-50"
                >
                  廃止
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-sm text-muted">
                キャンセル
              </button>
              <button
                data-testid="prize-save-button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPEC-PRIZE-MASTER-EDIT-DIALOG-01: 旧 PrizeDetailDialog JSX 撤廃 (景品名タップは openEdit 直接起動)。 */}
    </div>
  )
}
