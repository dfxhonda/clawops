import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DFX_ORG_ID } from '../../lib/auth/orgConstants'
import { writeAuditLog } from '../../services/audit'
import { logger } from '../../lib/logger'
import StoreCrudDrawer from '../components/StoreCrudDrawer'
// SPEC-LIST-FILTER-SORT-01-fix-01: 共通 filter dropdown bar (canonical d0cf209)。
// このページは stores テーブル管理 (location_type 列はなし) のため、spec の location_type filter
// は brand_name で代用する (実質的な '種別' = ブランド、stores 内で意味のある分類軸)。
// SortableTableHeader は useListSort/state 名重複 + 既存 server-side sort のため見送り、
// 既存 sortKey dropdown を維持。implementation_notes 記載。
import ListFilterBar from '../../components/ListFilterBar'

// T2d-AdminStoreListPage-bugfix-refactor:
// - bugfix: .single() → .maybeSingle() で「Cannot coerce to single JSON」を解消
// - bugfix: WHERE 句を store_code (NOT NULL) ベースに統一 (store_id は NULL 許容で WHERE に使えない)
// - feature: store_id を edit_modal 内で editable text field 化 (admin/manager のみ自由入力)
// - feature: card view (min-h 88px) を default、grid 表編集を toggle
// - feature: ← ホーム / + 新規追加 / 検索 + 50音タブ + ソート / 削除確認 (ブース数 + meter_readings 件数)
// - audit: 全 CUD を writeAuditLog (services/audit) + logger.info/error (lib/logger)
// - forbidden: stores schema 不変 / store_name_official の UI 表示なし (内部保持) / 他画面 .single() 不触

const LIST_SELECT = 'store_id,store_code,store_name,store_name_official,brand_name,store_type,phone,address,region,locality,locality_kana,is_active,opened_at,closed_at,is_collection_day,notes'

const EMPTY_FORM = {
  store_id: '',
  store_code: '', store_name: '', store_name_official: '',
  brand_name: '', store_type: '', phone: '', address: '',
  region: '', locality: '', locality_kana: '',
  is_active: true, opened_at: '', closed_at: '',
  is_collection_day: false, notes: '',
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-xs text-muted">{label}</span>}
      {children}
    </div>
  )
}

function TInput({ value, onChange, placeholder, type = 'text', testId }) {
  return (
    <input
      data-testid={testId}
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
    />
  )
}

// 50音タブ: locality_kana 頭文字でフィルタ (簡易)
const KANA_GROUPS = [
  { key: '', label: '全' },
  { key: 'あ', label: 'あ' },
  { key: 'か', label: 'か' },
  { key: 'さ', label: 'さ' },
  { key: 'た', label: 'た' },
  { key: 'な', label: 'な' },
  { key: 'は', label: 'は' },
  { key: 'ま', label: 'ま' },
  { key: 'や', label: 'や' },
  { key: 'ら', label: 'ら' },
  { key: 'わ', label: 'わ' },
]
const KANA_RANGES = {
  'あ': /^[あ-おア-オ]/, 'か': /^[か-ごカ-ゴ]/, 'さ': /^[さ-ぞサ-ゾ]/, 'た': /^[た-どタ-ド]/,
  'な': /^[な-のナ-ノ]/, 'は': /^[は-ぽハ-ポ]/, 'ま': /^[ま-もマ-モ]/, 'や': /^[や-よヤ-ヨ]/,
  'ら': /^[ら-ろラ-ロ]/, 'わ': /^[わ-んワ-ン]/,
}

export default function AdminStoreListPage() {
  const navigate = useNavigate()
  const { staffId, staffName } = useAuth()
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [brands, setBrands]         = useState([])
  const [kanaFilter, setKanaFilter] = useState('')
  const [sortKey, setSortKey]       = useState('store_name')
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [loadKey, setLoadKey]       = useState(0)
  const [view, setView]             = useState('card')
  const [gridEdits, setGridEdits]   = useState({})
  const [gridSaving, setGridSaving] = useState(false)
  const [detailStore, setDetailStore] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { boothCount, readingCount, forceChecked }
  const [deleting, setDeleting] = useState(false)
  const [boothCounts, setBoothCounts] = useState({})

  useEffect(() => {
    supabase.from('stores').select('brand_name').then(({ data, error: e }) => {
      if (e) { logger.error('store_list_fetch_error', { code: 'ERR-STORE-001', subject: 'brands', message: e.message }); return }
      const unique = [...new Set((data ?? []).map(r => r.brand_name).filter(Boolean))].sort()
      setBrands(unique)
    })
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('stores').select(LIST_SELECT)
    if (sortKey === 'store_name') q = q.order('store_name')
    else if (sortKey === 'created_at') q = q.order('created_at', { ascending: false, nullsLast: true })
    else if (sortKey === 'locality_kana') q = q.order('locality_kana', { ascending: true, nullsLast: true })
    if (search.trim()) {
      const s = search.trim()
      q = q.or(`store_name.ilike.%${s}%,locality.ilike.%${s}%`)
    }
    if (activeOnly)    q = q.eq('is_active', true)
    if (brandFilter)   q = q.eq('brand_name', brandFilter)
    const { data, error: loadErr } = await q
    if (loadErr) {
      setError(loadErr.message)
      logger.error('store_list_fetch_error', { code: 'ERR-STORE-001', message: loadErr.message })
    } else {
      // kana filter (client side)
      const filtered = kanaFilter
        ? (data ?? []).filter(r => KANA_RANGES[kanaFilter]?.test(r.locality_kana ?? r.store_name ?? ''))
        : (data ?? [])
      setRows(filtered)
      setError(null)
      logger.info('store_list_fetch_success', { count: filtered.length })
      // ブース数集計
      if (filtered.length > 0) {
        const codes = filtered.map(r => r.store_code)
        const { data: bs } = await supabase.from('booths').select('store_code').in('store_code', codes)
        const counts = {}
        for (const b of bs ?? []) counts[b.store_code] = (counts[b.store_code] ?? 0) + 1
        setBoothCounts(counts)
      } else {
        setBoothCounts({})
      }
    }
    setLoading(false)
  }, [search, activeOnly, brandFilter, kanaFilter, sortKey, loadKey])

  useEffect(() => { fetchRows() }, [fetchRows])

  function reload() { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  async function openEdit(row) {
    // bugfix: .single() → .maybeSingle() / WHERE store_id → store_code (store_id は NULL 許容)
    const { data, error: loadErr } = await supabase
      .from('stores').select(LIST_SELECT)
      .eq('store_code', row.store_code).maybeSingle()
    if (loadErr) { setError(loadErr.message); return }
    if (!data) { setError(`店舗が見つかりません: ${row.store_code}`); return }
    setForm({
      store_id:             data.store_id ?? '',
      store_code:           data.store_code ?? '',
      store_name:           data.store_name ?? '',
      store_name_official:  data.store_name_official ?? '', // UI 非表示、編集も外す (forbidden)
      brand_name:           data.brand_name ?? '',
      store_type:           data.store_type ?? '',
      phone:                data.phone ?? '',
      address:              data.address ?? '',
      region:               data.region ?? '',
      locality:             data.locality ?? '',
      locality_kana:        data.locality_kana ?? '',
      is_active:            data.is_active ?? true,
      opened_at:            data.opened_at ?? '',
      closed_at:            data.closed_at ?? '',
      is_collection_day:    data.is_collection_day ?? false,
      notes:                data.notes ?? '',
    })
    setModal(data)
    setError(null)
  }

  async function handleSave() {
    if (!form.store_name.trim()) { setError('店舗名は必須です'); return }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const payload = {
      store_id:            form.store_id?.trim() || null, // editable: NULL 保持可
      store_name:          form.store_name.trim(),
      store_name_official: form.store_name_official || null, // 内部保持、UI 表示なし
      store_code:          form.store_code || null,
      brand_name:          form.brand_name || null,
      store_type:          form.store_type || null,
      phone:               form.phone || null,
      address:             form.address || null,
      region:              form.region || null,
      locality:            form.locality || null,
      locality_kana:       form.locality_kana || null,
      is_active:           form.is_active,
      opened_at:           form.opened_at || null,
      closed_at:           form.closed_at || null,
      is_collection_day:   form.is_collection_day,
      notes:               form.notes || null,
      updated_by:          staffName,
      updated_at:          now,
    }
    try {
      if (modal === 'new') {
        const insertPayload = {
          ...payload,
          organization_id: DFX_ORG_ID,
        }
        const { error: saveErr } = await supabase.from('stores').insert(insertPayload)
        if (saveErr) throw saveErr
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'INSERT',
          target_table: 'stores',
          target_id: insertPayload.store_code,
          detail: `店舗新規登録: ${insertPayload.store_name}`,
          after_data: insertPayload,
        })
        logger.info('store_create_success', { store_code: insertPayload.store_code })
      } else {
        const before = {
          store_id: modal.store_id, store_name: modal.store_name, store_code: modal.store_code,
          brand_name: modal.brand_name, store_type: modal.store_type, phone: modal.phone,
          address: modal.address, region: modal.region, locality: modal.locality,
          locality_kana: modal.locality_kana, is_active: modal.is_active,
          opened_at: modal.opened_at, closed_at: modal.closed_at,
          is_collection_day: modal.is_collection_day, notes: modal.notes,
        }
        // bugfix: WHERE 句を store_code に統一 (store_id 不可 / NULL 許容)
        const { error: saveErr } = await supabase.from('stores')
          .update(payload).eq('store_code', modal.store_code)
        if (saveErr) throw saveErr
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'UPDATE',
          target_table: 'stores',
          target_id: modal.store_code,
          detail: `店舗更新: ${payload.store_name}`,
          before_data: before,
          after_data: payload,
        })
        logger.info('store_update_success', { store_code: modal.store_code })
      }
      setModal(null)
      reload()
    } catch (err) {
      setError(err.message)
      logger.error(modal === 'new' ? 'store_create_error' : 'store_update_error',
        { code: modal === 'new' ? 'ERR-STORE-002' : 'ERR-STORE-003', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function startDelete() {
    if (!modal || modal === 'new') return
    const { count: boothCount } = await supabase.from('booths')
      .select('booth_code', { count: 'exact', head: true })
      .eq('store_code', modal.store_code)
    // meter_readings に store_code カラムなし、booth_code が '{store_code}-...' 形式なので prefix で集計
    const { count: readingCount } = await supabase.from('meter_readings')
      .select('reading_id', { count: 'exact', head: true })
      .like('booth_code', `${modal.store_code}-%`)
    setDeleteConfirm({
      boothCount: boothCount ?? 0,
      readingCount: readingCount ?? 0,
      forceChecked: false,
    })
  }

  async function confirmDelete() {
    if (!modal || modal === 'new' || !deleteConfirm) return
    if (!deleteConfirm.forceChecked) {
      setError('「関連データも削除」のチェックが必要です')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      // 関連 stocking なしの単純 DELETE。meter_readings / booths は別 spec で扱う方針 (FK エラー時は user に表示)
      const { error: delErr } = await supabase.from('stores').delete().eq('store_code', modal.store_code)
      if (delErr) throw delErr
      await writeAuditLog({
        staff_id: staffId || undefined,
        action: 'DELETE',
        target_table: 'stores',
        target_id: modal.store_code,
        detail: `店舗削除: ${modal.store_name} (booths=${deleteConfirm.boothCount} / readings=${deleteConfirm.readingCount})`,
        before_data: { store_code: modal.store_code, store_name: modal.store_name },
      })
      logger.info('store_delete_success', { store_code: modal.store_code })
      setDeleteConfirm(null)
      setModal(null)
      reload()
    } catch (err) {
      setError(err.message)
      logger.error('store_delete_error', { code: 'ERR-STORE-004', message: err.message })
    } finally {
      setDeleting(false)
    }
  }

  const f = v => setForm(prev => ({ ...prev, ...v }))

  const gridCellCls = "w-full h-7 px-1.5 bg-transparent border-0 text-text text-sm outline-none focus:bg-surface rounded [color-scheme:dark]"

  function setGCell(code, key, val) {
    setGridEdits(prev => {
      const row = rows.find(r => r.store_code === code)
      const base = prev[code] ?? {
        store_name: row?.store_name ?? '',
        store_code: row?.store_code ?? '',
        store_id: row?.store_id ?? '',
        address: row?.address ?? '',
        phone: row?.phone ?? '',
        brand_name: row?.brand_name ?? '',
        is_active: row?.is_active ?? true,
      }
      return { ...prev, [code]: { ...base, [key]: val } }
    })
  }

  async function saveGridEdits() {
    setGridSaving(true)
    const now = new Date().toISOString()
    try {
      for (const [code, ge] of Object.entries(gridEdits)) {
        const before = rows.find(r => r.store_code === code)
        // bugfix: WHERE store_code に統一
        const { error: ge_err } = await supabase.from('stores').update({
          store_id: ge.store_id || null,
          store_name: ge.store_name.trim(),
          store_code: ge.store_code || null,
          address: ge.address || null,
          phone: ge.phone || null,
          brand_name: ge.brand_name || null,
          is_active: ge.is_active,
          updated_by: staffName,
          updated_at: now,
        }).eq('store_code', code)
        if (ge_err) throw ge_err
        await writeAuditLog({
          staff_id: staffId || undefined,
          action: 'UPDATE',
          target_table: 'stores',
          target_id: code,
          detail: `表編集一括保存: ${ge.store_name}`,
          before_data: before ? { store_name: before.store_name, store_code: before.store_code, store_id: before.store_id, address: before.address, phone: before.phone, brand_name: before.brand_name, is_active: before.is_active } : null,
          after_data: ge,
        })
      }
      setGridEdits({})
      reload()
      logger.info('store_update_success', { source: 'grid_bulk', count: Object.keys(gridEdits).length })
    } catch (err) {
      setError(err.message)
      logger.error('store_update_error', { code: 'ERR-STORE-003', source: 'grid_bulk', message: err.message })
    } finally {
      setGridSaving(false)
    }
  }

  return (
    <div data-testid="admin-store-list" className="flex flex-col" style={{ height: 'calc(100dvh - 80px)' }}>
      {/* page_top: ← ホーム / 店舗マスタ / + 新規追加 */}
      <div className="flex-shrink-0 p-3 pb-2 flex items-center gap-2 border-b border-border">
        <a href="/launcher" data-testid="store-home-link" className="text-sm text-muted">← ホーム</a>
        <h1 className="text-base font-bold text-text">店舗マスタ</h1>
        <span className="text-sm text-muted">{rows.length}件</span>
        <div className="flex-1" />
        <button
          data-testid="store-list-new-button"
          onClick={openNew}
          className="bg-blue-600 text-white text-sm font-bold rounded px-3 min-h-[40px]"
        >+ 新規追加</button>
      </div>

      {/* SPEC-LIST-FILTER-SORT-01-fix-01: 共通 ListFilterBar (種別=ブランド、active toggle 補完)。
          location_type 列が stores に無いため brand_name を '種別' として代用。既存 brand select は
          残置 (異なる視覚位置だが両方動作する、リセットリンクで一括クリア可)。 */}
      <ListFilterBar
        filters={[
          { key: 'brand_name', label: '種別 (ブランド)',
            options: [
              { value: '', label: '全て' },
              ...brands.map(b => ({ value: b, label: b })),
            ] },
          { key: 'active', label: '状態',
            options: [
              { value: 'all', label: '全て' },
              { value: 'active', label: '有効のみ' },
            ] },
        ]}
        values={{ brand_name: brandFilter, active: activeOnly ? 'active' : 'all' }}
        onChange={(k, v) => {
          if (k === 'brand_name') setBrandFilter(v)
          if (k === 'active')     setActiveOnly(v === 'active')
        }}
        onReset={() => { setBrandFilter(''); setActiveOnly(false) }}
      />

      {/* search / brand / active / sort / view */}
      <div className="flex-shrink-0 p-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border">
        <input
          data-testid="store-list-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="店舗名 / 地域"
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text flex-1 min-w-[160px]"
        />
        <select
          data-testid="store-list-brand-filter"
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="">ブランド全て</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          data-testid="store-sort"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="store_name">名前順</option>
          <option value="created_at">作成新しい順</option>
          <option value="locality_kana">市区町村カナ順</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            className="accent-accent"
            data-testid="store-list-active-toggle"
          />
          有効のみ
        </label>
        <button
          data-testid="store-view-toggle"
          onClick={() => setView(v => v === 'card' ? 'grid' : 'card')}
          className="px-3 py-1 rounded text-sm font-bold whitespace-nowrap border border-border text-muted"
        >{view === 'card' ? '⊞ 表編集' : '▤ カード'}</button>
      </div>

      {/* 50音タブ */}
      <div data-testid="store-kana-chips" className="flex-shrink-0 px-3 py-2 flex gap-1 flex-wrap border-b border-border">
        {KANA_GROUPS.map(g => (
          <button
            key={g.key || 'all'}
            data-testid={`kana-chip-${g.key || 'all'}`}
            onClick={() => setKanaFilter(g.key)}
            className={`px-2 min-h-[36px] rounded-full text-sm font-bold border ${kanaFilter === g.key ? 'bg-blue-600 text-white border-transparent' : 'border-border text-muted'}`}
          >{g.label}</button>
        ))}
      </div>

      {view === 'grid' && Object.keys(gridEdits).length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-y border-amber-700/40">
          <span className="text-sm text-amber-400">{Object.keys(gridEdits).length}件 変更あり</span>
          <button onClick={() => setGridEdits({})} className="ml-auto text-sm text-muted px-2 py-1 rounded border border-border">取消</button>
          <button onClick={saveGridEdits} disabled={gridSaving} className="text-sm text-white bg-blue-600 px-3 py-1 rounded font-bold disabled:opacity-50">
            {gridSaving ? '保存中…' : '一括保存'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-sm py-8">該当なし</p>}
        {error && !modal && <p data-testid="store-error" className="text-red-400 text-sm px-3 py-2">{error}</p>}

        {!loading && rows.length > 0 && view === 'card' && (
          <ul className="px-3 py-2 space-y-2">
            {rows.map(r => (
              <li
                key={r.store_code}
                data-testid="store-list-row"
                onClick={() => { setDetailStore(r); setError(null) }}
                className="bg-surface border border-border rounded-xl p-3 cursor-pointer hover:bg-surface/80 active:ring-2 active:ring-blue-500"
                style={{ minHeight: 88 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[20px] font-bold text-text truncate">{r.store_name}</p>
                    <p className="text-xs text-muted truncate">{r.locality ?? '—'} ・ {r.store_code}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${r.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                    {r.is_active ? '有効' : '無効'}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted">
                  {r.brand_name && <span className="bg-bg border border-border rounded px-1.5">{r.brand_name}</span>}
                  <span>ブース {boothCounts[r.store_code] ?? 0}</span>
                  {r.store_id && <span className="font-mono">ID:{r.store_id}</span>}
                  {!r.store_id && <span className="text-amber-400">外部ID未割当</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && rows.length > 0 && view === 'grid' && (
          <table data-testid="store-list-table" className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="border-b border-border">
                <th className="py-1 px-2 text-left text-muted">店舗名</th>
                <th className="py-1 px-2 text-left text-muted">コード</th>
                <th className="py-1 px-2 text-left text-muted">外部ID</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">住所</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">電話</th>
                <th className="py-1 px-2 text-left text-muted hidden md:table-cell">ブランド</th>
                <th className="py-1 px-2 text-left text-muted">ST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ge = gridEdits[r.store_code]
                return (
                  <tr
                    key={r.store_code}
                    data-testid="store-list-row"
                    className={`border-b border-border/50 ${ge ? 'bg-amber-900/15' : 'hover:bg-surface/30'}`}
                  >
                    <td className="py-0.5 px-1 text-text font-medium max-w-[180px]">
                      <input value={ge?.store_name ?? r.store_name ?? ''} onChange={ev => setGCell(r.store_code, 'store_name', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted font-mono">
                      <input value={ge?.store_code ?? r.store_code ?? ''} onChange={ev => setGCell(r.store_code, 'store_code', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted font-mono">
                      <input value={ge?.store_id ?? r.store_id ?? ''} onChange={ev => setGCell(r.store_code, 'store_id', ev.target.value)} placeholder="例 678" className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted max-w-[200px] hidden md:table-cell">
                      <input value={ge?.address ?? r.address ?? ''} onChange={ev => setGCell(r.store_code, 'address', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                      <input value={ge?.phone ?? r.phone ?? ''} onChange={ev => setGCell(r.store_code, 'phone', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1 text-muted hidden md:table-cell">
                      <input value={ge?.brand_name ?? r.brand_name ?? ''} onChange={ev => setGCell(r.store_code, 'brand_name', ev.target.value)} className={gridCellCls} />
                    </td>
                    <td className="py-0.5 px-1">
                      <input type="checkbox" checked={ge?.is_active ?? r.is_active ?? false} onChange={ev => setGCell(r.store_code, 'is_active', ev.target.checked)} className="accent-blue-500" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* edit/new modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget && !deleteConfirm) setModal(null) }}
        >
          <div data-testid="store-list-modal" className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text">
                {modal === 'new' ? '店舗 新規登録' : '店舗編集'}
              </span>
              <button onClick={() => setModal(null)} className="text-muted text-lg leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="店舗名 *">
                <TInput value={form.store_name} onChange={v => f({ store_name: v })} placeholder="店舗名" testId="store-edit-name" />
              </Field>
              <Field label="店舗コード">
                <TInput value={form.store_code} onChange={v => f({ store_code: v })} placeholder="KKY01" testId="store-edit-code" />
              </Field>
              <Field label="外部ID (PPIH番号 / スポガ番号 / 英数字自由入力)">
                <TInput
                  value={form.store_id}
                  onChange={v => f({ store_id: v })}
                  placeholder="例) 678 (ドンキ系=PPIH番号) / S001 (スポガ系) / その他英数字自由入力"
                  testId="store-edit-store-id"
                />
              </Field>
              <Field label="ブランド名">
                <TInput value={form.brand_name} onChange={v => f({ brand_name: v })} placeholder="ブランド名" />
              </Field>
              <Field label="店舗種別">
                <TInput value={form.store_type} onChange={v => f({ store_type: v })} placeholder="店舗種別" />
              </Field>
              <Field label="電話番号">
                <TInput value={form.phone} onChange={v => f({ phone: v })} placeholder="0120-..." type="tel" />
              </Field>
              <Field label="住所">
                <TInput value={form.address} onChange={v => f({ address: v })} placeholder="住所" />
              </Field>
              <Field label="地域">
                <TInput value={form.region} onChange={v => f({ region: v })} placeholder="地域" />
              </Field>
              <Field label="市区町村">
                <TInput value={form.locality} onChange={v => f({ locality: v })} placeholder="市区町村" />
              </Field>
              <Field label="市区町村カナ">
                <TInput value={form.locality_kana} onChange={v => f({ locality_kana: v })} placeholder="カタカナ" />
              </Field>
              <Field label="開業日">
                <TInput value={form.opened_at} onChange={v => f({ opened_at: v })} type="date" />
              </Field>
              <Field label="閉業日">
                <TInput value={form.closed_at} onChange={v => f({ closed_at: v })} type="date" />
              </Field>
              <Field label="備考">
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => f({ notes: e.target.value })}
                  rows={3}
                  className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full resize-none"
                  placeholder="備考"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => f({ is_active: e.target.checked })} className="accent-accent" />
                有効 (is_active)
              </label>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="checkbox" checked={form.is_collection_day} onChange={e => f({ is_collection_day: e.target.checked })} className="accent-accent" />
                集金日対象 (is_collection_day)
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 rounded border border-border text-sm text-muted">キャンセル</button>
              <div className="flex-1" />
              <button
                data-testid="store-list-save-button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>

            {modal !== 'new' && (
              <div className="mt-4 pt-3 border-t border-border">
                <button
                  type="button"
                  data-testid="store-delete-button"
                  onClick={startDelete}
                  className="w-full py-2 rounded-lg bg-red-700 text-white text-sm font-bold"
                >この店舗を削除</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 削除確認 (ブース数 / meter_readings 件数 + force checkbox) */}
      {deleteConfirm && modal && modal !== 'new' && (
        <div
          data-testid="store-delete-backdrop"
          onClick={() => setDeleteConfirm(null)}
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-4"
        >
          <div
            data-testid="store-delete-dialog"
            onClick={e => e.stopPropagation()}
            className="bg-bg border border-border rounded-xl p-4 w-full max-w-xs"
          >
            <p className="text-base text-text">店舗を削除しますか？</p>
            <p className="text-xs text-muted mt-1 truncate">{modal.store_name} ({modal.store_code})</p>
            <ul className="mt-2 text-xs text-amber-400 space-y-0.5">
              <li>関連ブース: {deleteConfirm.boothCount} 件</li>
              <li>meter_readings: {deleteConfirm.readingCount} 件</li>
            </ul>
            <label className="mt-3 flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                data-testid="store-delete-force"
                checked={deleteConfirm.forceChecked}
                onChange={e => setDeleteConfirm(c => ({ ...c, forceChecked: e.target.checked }))}
                className="accent-red-500"
              />
              関連データも削除して構わない
            </label>
            <div className="mt-4 flex gap-2 justify-end">
              <button data-testid="store-delete-cancel" onClick={() => setDeleteConfirm(null)} className="px-4 min-h-[44px] rounded-lg border border-border text-text text-sm">キャンセル</button>
              <button
                data-testid="store-delete-confirm"
                onClick={confirmDelete}
                disabled={deleting || !deleteConfirm.forceChecked}
                className="px-4 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50"
              >{deleting ? '削除中…' : '削除'}</button>
            </div>
          </div>
        </div>
      )}

      {detailStore && (
        <StoreCrudDrawer
          storeCode={detailStore.store_code}
          storeName={detailStore.store_name}
          onClose={() => setDetailStore(null)}
          onEditStore={() => { const s = detailStore; setDetailStore(null); openEdit(s) }}
        />
      )}
    </div>
  )
}
