import { useEffect, useState, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CHANGE_ORG_ID } from '../../lib/auth/orgConstants'
import { writeAuditLog } from '../../services/audit'
import { logger } from '../../lib/logger'
import StoreCrudDrawer from '../components/StoreCrudDrawer'
// SPEC-LIST-FILTER-SORT-01-fix-02: 共通 filter dropdown bar + sortable header + ソート hook。
// store_type 列が stores に存在 (D-051 正規化後: donki/tenant/other/external/null) を確認し、
// 種別フィルタは store_type で正実装。サーバーソートは廃止し、全件 fetch 後 client-side
// useListSort で SortableTableHeader 適用 (49 行以下なので性能問題なし)。
import ListFilterBar from '../../components/ListFilterBar'
import SortableTableHeader from '../../components/SortableTableHeader'
import { useListSort } from '../../hooks/useListSort'

// T2d-AdminStoreListPage-bugfix-refactor:
// - bugfix: .single() → .maybeSingle() で「Cannot coerce to single JSON」を解消
// - bugfix: WHERE 句を store_code (NOT NULL) ベースに統一
// - SPEC-STORE-MASTER-STORE-ID-FIX-01: stores.store_id 列が DROP (SCHEMA-AUDIT-V1) 済のため
//   本ファイルから store_id 参照を全削除。SELECT 不在で「column does not exist」エラー解消。
// - feature: card view (min-h 88px) を default、grid 表編集を toggle
// - feature: ← ホーム / + 新規追加 / 検索 + 50音タブ + ソート / 削除確認 (ブース数 + meter_readings 件数)
// - audit: 全 CUD を writeAuditLog (services/audit) + logger.info/error (lib/logger)
// - forbidden: stores schema 不変 / 他画面 .single() 不触
// - SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057): store_name_official は編集フォームで表示・編集可 (旧「UI表示なし」解除)

// SPEC-STORE-MASTER-STORE-ID-FIX-01: 旧 store_id 列を SELECT から除外 (DB DROP 済)。
// SPEC-STORE-INFO-WEBSEARCH-01 (D-105): openEdit プリフィル用に lat/lng を追加取得。
const LIST_SELECT = 'store_code,store_name,store_name_official,brand_name,store_type,phone,address,region,locality,locality_kana,lat,lng,is_active,opened_at,closed_at,is_collection_day,notes'

// SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店舗情報検索候補を form に null合体マージ。
// 候補.x が null/空なら現状 form 値を温存 (上書きしない)。store_code/store_name は候補で上書きしない (人間確定・検索キー)。
export function mergeStoreCandidate(form, c) {
  if (!c) return form
  const keep = (cand, cur) => (cand != null && cand !== '' ? cand : cur)
  return {
    ...form,
    store_name_official: keep(c.store_name_official, form.store_name_official),
    brand_name:          keep(c.brand_name, form.brand_name),
    address:             keep(c.address, form.address),
    phone:               keep(c.phone, form.phone),
    region:              keep(c.region, form.region),
    locality:            keep(c.locality, form.locality),
    locality_kana:       keep(c.locality_kana, form.locality_kana),
    lat:                 c.lat != null ? String(c.lat) : form.lat,
    lng:                 c.lng != null ? String(c.lng) : form.lng,
  }
}

const EMPTY_FORM = {
  store_code: '', store_name: '', store_name_official: '',
  brand_name: '', store_type: '', phone: '', address: '',
  region: '', locality: '', locality_kana: '',
  lat: '', lng: '', // SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 巡回ルート用座標
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
  // SPEC-LIST-FILTER-SORT-01-fix-02: server-side sortKey state 廃止 (サーバーソート廃止)、
  // useListSort で client-side sort に統一。store_type フィルタを追加 (brand_name 代用は撤去)。
  const [storeTypeFilter, setStoreTypeFilter] = useState('')
  const { sortKey, sortDir, onSort, sorted } = useListSort({ sortKey: 'store_name', sortDir: 'asc' })
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [loadKey, setLoadKey]       = useState(0)
  const [view, setView]             = useState('card')
  const [gridEdits, setGridEdits]   = useState({})
  const [gridSaving, setGridSaving] = useState(false)
  const [detailStore, setDetailStore] = useState(null)
  // SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店舗情報Web検索 (B方式=候補表示→確認→反映)
  const [storeCandidate, setStoreCandidate] = useState(null)
  const [searching, setSearching] = useState(false)
  const [latLngVerified, setLatLngVerified] = useState(false)
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
    // SPEC-LIST-FILTER-SORT-01-fix-02: サーバーソート廃止 (.order() 呼び出しなし)、
    // client-side useListSort で render 直前に sorted() を適用する。
    let q = supabase.from('stores').select(LIST_SELECT)
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
  }, [search, activeOnly, brandFilter, kanaFilter, loadKey])

  useEffect(() => { fetchRows() }, [fetchRows])

  function reload() { setLoadKey(k => k + 1) }

  function openNew() {
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
    setStoreCandidate(null)
    setLatLngVerified(false)
  }

  async function openEdit(row) {
    // bugfix: .single() → .maybeSingle() / WHERE store_code 統一
    const { data, error: loadErr } = await supabase
      .from('stores').select(LIST_SELECT)
      .eq('store_code', row.store_code).maybeSingle()
    if (loadErr) { setError(loadErr.message); return }
    if (!data) { setError(`店舗が見つかりません: ${row.store_code}`); return }
    setForm({
      // SPEC-STORE-MASTER-STORE-ID-FIX-01: store_id は DROP 済、参照しない。
      store_code:           data.store_code ?? '',
      store_name:           data.store_name ?? '',
      store_name_official:  data.store_name_official ?? '', // SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057): 編集フォームで表示・編集可
      brand_name:           data.brand_name ?? '',
      store_type:           data.store_type ?? '',
      phone:                data.phone ?? '',
      address:              data.address ?? '',
      region:               data.region ?? '',
      locality:             data.locality ?? '',
      locality_kana:        data.locality_kana ?? '',
      lat:                  data.lat ?? '', // SPEC-STORE-INFO-WEBSEARCH-01 (D-105)
      lng:                  data.lng ?? '',
      is_active:            data.is_active ?? true,
      opened_at:            data.opened_at ?? '',
      closed_at:            data.closed_at ?? '',
      is_collection_day:    data.is_collection_day ?? false,
      notes:                data.notes ?? '',
    })
    setModal(data)
    setError(null)
    setStoreCandidate(null)
    setLatLngVerified(false)
  }

  // SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店名(+住所ヒント)から store-info-search を叩き候補を得る (B方式=確認を挟む)。
  async function handleStoreSearch() {
    const q = form.store_name.trim()
    if (!q) { setError('店舗名を入力してください'); return }
    setSearching(true)
    setStoreCandidate(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('store-info-search', {
        body: { storeName: q, address: form.address || undefined },
      })
      if (fnErr) throw fnErr
      if (!data?.store) throw new Error('店舗情報を取得できませんでした')
      setStoreCandidate(data.store)
    } catch (e) {
      alert('検索に失敗しました: ' + (e?.message || String(e)))
    } finally {
      setSearching(false)
    }
  }

  // 候補を null合体で form に反映 (store_code/store_name は上書きしない)。lat/lng が入れば gps_verified フラグを立てる。
  function applyStoreCandidate() {
    if (!storeCandidate) return
    setForm(prev => mergeStoreCandidate(prev, storeCandidate))
    if (storeCandidate.lat != null && storeCandidate.lng != null) setLatLngVerified(true)
    setStoreCandidate(null)
  }

  async function handleSave() {
    if (!form.store_name.trim()) { setError('店舗名は必須です'); return }
    if (modal === 'new' && !form.store_code?.trim()) { setError('店舗コードは必須です'); return }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const payload = {
      // SPEC-STORE-MASTER-STORE-ID-FIX-01: store_id 列 DROP 済、payload から除外。
      store_name:          form.store_name.trim(),
      store_name_official: form.store_name_official || null, // SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057): 空保存は null (帳票は store_name フォールバック)
      store_code:          form.store_code || null,
      brand_name:          form.brand_name || null,
      store_type:          form.store_type || null,
      phone:               form.phone || null,
      address:             form.address || null,
      region:              form.region || null,
      locality:            form.locality || null,
      locality_kana:       form.locality_kana || null,
      // SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 巡回ルート用座標。空はnull、値は数値化。
      lat:                 form.lat !== '' && form.lat != null ? Number(form.lat) : null,
      lng:                 form.lng !== '' && form.lng != null ? Number(form.lng) : null,
      is_active:           form.is_active,
      opened_at:           form.opened_at || null,
      closed_at:           form.closed_at || null,
      is_collection_day:   form.is_collection_day,
      notes:               form.notes || null,
      updated_by:          staffName,
      updated_at:          now,
      // 検索候補から lat/lng を反映して保存した時のみ GPS確認時刻を打刻
      ...(latLngVerified ? { gps_verified_at: now } : {}),
    }
    try {
      if (modal === 'new') {
        const insertPayload = {
          ...payload,
          // SPEC-STORE-REGISTER-TYPE-DROPDOWN-AND-ORG-DEFAULT-01 (D-063) F2: 実運用全店は CHANGE org。
          // DFX org で登録すると RLS/リストフィルタで弾かれ新規店が出ない不具合の根治。
          organization_id: CHANGE_ORG_ID,
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
          // SPEC-STORE-MASTER-STORE-ID-FIX-01: store_id 撤廃。
          store_name: modal.store_name, store_code: modal.store_code,
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
        // SPEC-STORE-MASTER-STORE-ID-FIX-01: store_id 列 DROP 済、grid edit base から除外。
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
          // SPEC-STORE-MASTER-STORE-ID-FIX-01: store_id 列 DROP 済、UPDATE payload から除外。
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
          // SPEC-STORE-MASTER-STORE-ID-FIX-01: before snapshot からも store_id 除外。
          before_data: before ? { store_name: before.store_name, store_code: before.store_code, address: before.address, phone: before.phone, brand_name: before.brand_name, is_active: before.is_active } : null,
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
      <div className="flex-shrink-0 p-3 pb-2 flex items-center gap-2 border-b border-border">
        <h1 className="text-base font-bold text-text">店舗マスタ</h1>
        <span className="text-sm text-muted">{rows.length}件</span>
        <div className="flex-1" />
        <button
          data-testid="store-list-new-button"
          onClick={openNew}
          className="bg-blue-600 text-white text-sm font-bold rounded px-3 min-h-[40px]"
        >+ 新規追加</button>
      </div>

      {/* SPEC-LIST-FILTER-SORT-01-fix-02: 共通 ListFilterBar (種別=store_type 正実装、active toggle 連動)。
          stores.store_type 列が確認済。SPEC-STORETYPE-DONKI-NORMALIZE-S1G-REPOINT-01 (D-051) で
          donki_tenant -> donki 正規化、tenant(末締め、将来 IIZ02) を追加。fix-01 の brand_name 代用は撤去。 */}
      <ListFilterBar
        filters={[
          { key: 'store_type', label: '種別',
            options: [
              { value: '',         label: '全て' },
              { value: 'donki',    label: 'ドンキ(20日締め)' },
              { value: 'tenant',   label: 'テナント(末締め)' },
              { value: 'external', label: 'external' },
              { value: 'other',    label: 'other' },
            ] },
          { key: 'active', label: '状態',
            options: [
              { value: 'all',    label: '全て' },
              { value: 'active', label: '有効のみ' },
            ] },
        ]}
        values={{ store_type: storeTypeFilter, active: activeOnly ? 'active' : 'all' }}
        onChange={(k, v) => {
          if (k === 'store_type') setStoreTypeFilter(v)
          if (k === 'active')     setActiveOnly(v === 'active')
        }}
        onReset={() => { setStoreTypeFilter(''); setActiveOnly(false) }}
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
        {/* SPEC-LIST-FILTER-SORT-01-fix-02: 旧 server-side sort select は廃止、
            SortableTableHeader でクリックソートに統一。 */}
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
        {(() => {
        // SPEC-LIST-FILTER-SORT-01-fix-02: store_type 絞込 + useListSort.sorted() 適用。
        const displayRows = sorted(
          rows.filter(r => !storeTypeFilter || r.store_type === storeTypeFilter)
        )
        return (<>
        {loading && <p className="text-center text-muted text-sm py-8">読込中…</p>}
        {!loading && displayRows.length === 0 && <p className="text-center text-muted text-sm py-8">該当なし</p>}
        {error && !modal && <p data-testid="store-error" className="text-red-400 text-sm px-3 py-2">{error}</p>}

        {!loading && displayRows.length > 0 && view === 'card' && (
          <ul className="px-3 py-2 space-y-2">
            {displayRows.map(r => (
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
                  {/* SPEC-STORE-MASTER-STORE-ID-FIX-01: 旧 外部ID (store_id) chip 撤廃。 */}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && displayRows.length > 0 && view === 'grid' && (
          <table data-testid="store-list-table" className="w-full text-sm border-collapse">
            {/* SPEC-LIST-FILTER-SORT-01-fix-02: 静的 thead を SortableTableHeader に置換。
                spec sort_columns: [store_name, brand_name, store_type, region, is_active]。
                既存 grid 列構成 (店舗名/コード/外部ID/住所/電話/ブランド/ST) のうち、
                spec 該当列のみクリックソート可、その他は __* prefix で非ソート。 */}
            <thead className="sticky top-0 bg-bg z-10">
              <SortableTableHeader
                variant="tr"
                columns={[
                  { key: 'store_name',  label: '店舗名',  className: 'py-1 px-2 text-left text-muted' },
                  { key: '__code__',    label: 'コード',  className: 'py-1 px-2 text-left text-muted pointer-events-none' },
                  // SPEC-STORE-MASTER-STORE-ID-FIX-01: 旧 '外部ID' 列を撤廃。
                  { key: '__address__', label: '住所',    className: 'py-1 px-2 text-left text-muted hidden md:table-cell pointer-events-none' },
                  { key: '__phone__',   label: '電話',    className: 'py-1 px-2 text-left text-muted hidden md:table-cell pointer-events-none' },
                  { key: 'brand_name',  label: 'ブランド', className: 'py-1 px-2 text-left text-muted hidden md:table-cell' },
                  { key: 'is_active',   label: 'ST',     className: 'py-1 px-2 text-left text-muted' },
                ]}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(k) => { if (k && !k.startsWith('__')) onSort(k) }}
                className="border-b border-border"
              />
            </thead>
            <tbody>
              {displayRows.map(r => {
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
                    {/* SPEC-STORE-MASTER-STORE-ID-FIX-01: 旧 store_id 編集 <td> を撤廃。 */}
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
        </>)
        })()}
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

              {/* SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店名からWeb検索→候補確認→反映 (B方式)。lat/lng誤植で巡回ナビが狂うのを目視で防ぐ */}
              <button
                type="button"
                data-testid="store-info-search-button"
                onClick={handleStoreSearch}
                disabled={!form.store_name.trim() || searching}
                className="self-start px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted bg-surface2 hover:bg-bg disabled:opacity-40"
              >
                {searching ? '検索中...' : '🔍 店舗情報を検索'}
              </button>
              {storeCandidate && (
                <div data-testid="store-candidate" className="rounded-xl border border-border bg-surface2 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-muted uppercase tracking-wide text-[10px]">検索結果（確認して反映）</p>
                  <div className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
                    {[
                      ['正式名称', storeCandidate.store_name_official],
                      ['ブランド', storeCandidate.brand_name],
                      ['住所', storeCandidate.address],
                      ['電話', storeCandidate.phone],
                      ['地域', storeCandidate.region],
                      ['市区町村', storeCandidate.locality],
                      ['カナ', storeCandidate.locality_kana],
                      ['緯度 lat', storeCandidate.lat],
                      ['経度 lng', storeCandidate.lng],
                    ].map(([k, v]) => (
                      <Fragment key={k}>
                        <span className="text-muted">{k}</span>
                        <span className="font-medium text-text break-all">{v == null || v === '' ? '—' : String(v)}</span>
                      </Fragment>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" data-testid="store-candidate-apply" onClick={applyStoreCandidate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs">フォームに反映</button>
                    <button type="button" onClick={() => setStoreCandidate(null)} className="px-3 bg-surface border border-border text-muted font-bold py-1.5 rounded-lg text-xs">閉じる</button>
                  </div>
                  <p className="text-[10px] text-muted">※ 店舗コード・店舗名は上書きしません。緯度経度は反映前に必ず目視確認を。</p>
                </div>
              )}
              {/* SPEC-STORE-OFFICIAL-NAME-EDIT-01 (D-057): 集金帳票の宛名用。旧 forbidden「UI表示なし」は hiro 指示で解除。 */}
              <Field label="正式名称">
                <TInput value={form.store_name_official} onChange={v => f({ store_name_official: v })}
                  placeholder={form.store_name || '店舗名'} testId="store-edit-name-official" />
                <span className="text-xs text-muted">集金帳票の宛名に使用。空の場合は店舗名を使用</span>
              </Field>
              <Field label="店舗コード">
                <TInput value={form.store_code} onChange={v => f({ store_code: v })} placeholder="KKY01" testId="store-edit-code" />
              </Field>
              {/* SPEC-STORE-MASTER-STORE-ID-FIX-01: 旧 外部ID (store_id) 入力 Field を撤廃。 */}
              <Field label="ブランド名">
                <TInput value={form.brand_name} onChange={v => f({ brand_name: v })} placeholder="ブランド名" />
              </Field>
              {/* SPEC-STORE-REGISTER-TYPE-DROPDOWN-AND-ORG-DEFAULT-01 (D-063) F1: 自由入力を D-051 正規化値の select 化 */}
              <Field label="店舗種別">
                <select
                  data-testid="store-edit-type"
                  value={form.store_type ?? ''}
                  onChange={e => f({ store_type: e.target.value })}
                  className="bg-bg border border-border rounded px-2 py-1 text-sm text-text w-full"
                >
                  <option value="">未設定</option>
                  <option value="donki">ドンキ</option>
                  <option value="tenant">テナント</option>
                  <option value="external">外部</option>
                  <option value="other">その他</option>
                  {form.store_type && !['donki', 'tenant', 'external', 'other'].includes(form.store_type) && (
                    <option value={form.store_type}>{form.store_type}（旧値）</option>
                  )}
                </select>
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
              {/* SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 巡回ルート用 緯度経度。検索候補から反映 or 手入力可 */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="緯度 lat">
                  <TInput value={form.lat} onChange={v => { f({ lat: v }); setLatLngVerified(false) }} placeholder="33.5902" type="text" testId="store-edit-lat" />
                </Field>
                <Field label="経度 lng">
                  <TInput value={form.lng} onChange={v => { f({ lng: v }); setLatLngVerified(false) }} placeholder="130.4017" type="text" testId="store-edit-lng" />
                </Field>
              </div>
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
