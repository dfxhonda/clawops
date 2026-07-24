// SPEC-MACHINE-MODEL-LINK-ADMIN-01 (D-101): 全店横断 機械一覧・model_id 紐付管理。
// 主目的= machines.model_id 未紐付け(約138台/260)をこの1枚で一気に紐付け。全カラム編集(詳細列トグル)。
// DESIGN_PRINCIPLE: 識別/紐付けは machine_code(不変キー)。machine_name / short_name+丸数字 は表示ラベルのみ。
//   model_id 紐付けは machine_name を自動上書きしない(Q4安全tier=手編集のみ)。short_name は機種マスタ参照(コピー保存しない)。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMachinesForAdmin, updateMachineAdmin, getMachineModels, getAllStores } from '../../services/masters'
import { PageHeader } from '../../shared/ui/PageHeader'

// 常時表示列 (暫定: ヒロ実機後調整前提)。machine_code=読取専用, short_name=機種マスタ引き表示のみ(読取専用),
// store_code=不変キー(machine_code に内包)ゆえ読取専用扱い。
// w = 内容フィット用の min-width (D-103 A案: 横スクロール前提で余白削減、編集inputは潰れない最低幅を保証)。
const ALWAYS_COLS = [
  { key: 'store_code',     label: '店舗',       type: 'ro' },
  { key: 'machine_code',   label: '機械コード', type: 'ro' },
  { key: 'machine_name',   label: '機械名',     type: 'text', w: 'min-w-[10rem]' },
  { key: 'model_id',       label: '機種(model)', type: 'model', w: 'min-w-[10rem]' },
  { key: 'short_name',     label: '短縮名',     type: 'shortname' },
  { key: 'name_suffix',    label: '丸数字',     type: 'text', w: 'min-w-[3.5rem]' },
  { key: 'type_id',        label: '種別',       type: 'text', w: 'min-w-[5rem]' },
  { key: 'machine_number', label: '型番',       type: 'text', w: 'min-w-[6rem]' },
  { key: 'billing_order',  label: '請求順',     type: 'int' },
  { key: 'round_order',    label: '巡回順',     type: 'int' },
  { key: 'is_active',      label: '稼働',       type: 'bool' },
]

// 詳細列トグル (普段隠す・資産/保守系。暫定割当)。
const DETAIL_COLS = [
  { key: 'meter_unit_price',   label: '単価',        type: 'num' },
  { key: 'play_price',         label: 'プレイ単価',  type: 'num' },
  { key: 'meter_per_play',     label: 'M/play',      type: 'num' },
  { key: 'out_meter_count',    label: 'OUT数',       type: 'int' },
  { key: 'floor',              label: 'フロア',      type: 'text', w: 'min-w-[4rem]' },
  { key: 'zone',               label: 'ゾーン',      type: 'text', w: 'min-w-[4rem]' },
  { key: 'floor_area_m2',      label: '面積㎡',      type: 'num' },
  { key: 'ownership_type',     label: '所有区分',    type: 'text', w: 'min-w-[6rem]' },
  { key: 'acquisition_cost',   label: '取得原価',    type: 'num' },
  { key: 'acquired_at',        label: '取得日',      type: 'date' },
  { key: 'installed_at',       label: '設置日',      type: 'date' },
  { key: 'lease_monthly',      label: '月額リース',  type: 'num' },
  { key: 'lease_months',       label: 'リース月数',  type: 'int' },
  { key: 'lease_end_date',     label: 'リース終了',  type: 'date' },
  { key: 'maintenance_status', label: '保守状態',    type: 'text', w: 'min-w-[6rem]' },
  { key: 'last_maintenance_at', label: '最終保守',   type: 'date' },
  { key: 'notes',              label: '備考',        type: 'text', w: 'min-w-[12rem]' },
]

const COL_BY_KEY = [...ALWAYS_COLS, ...DETAIL_COLS].reduce((acc, c) => { acc[c.key] = c; return acc }, {})

// D-103 R1: ヘッダクリック 3-state (無→asc→desc→無)。純関数=単体テスト可。
export function nextSortState(sortKey, sortDir, key) {
  if (sortKey !== key) return { sortKey: key, sortDir: 'asc' }
  if (sortDir === 'asc') return { sortKey: key, sortDir: 'desc' }
  return { sortKey: null, sortDir: 'asc' } // desc の次=無ソート(供給順へ復帰)
}

// D-103 R1: 型別比較ソート。表示順のみを返す新配列 (元 rows は不変=machine_code 実体・edits 紐付き無傷)。
// int/num=数値, bool=真偽, その他(ro/text/date/model/shortname)=文字列localeCompare。null/空は dir 無関係で末尾。
// model=model_name, shortname=short_name でソート (人間に自然)。
export function sortMachines(rows, sortKey, sortDir) {
  if (!sortKey) return rows // 無ソート=masters供給順 (store_code ASC → machine_code ASC)
  const col = COL_BY_KEY[sortKey]
  if (!col) return rows
  const dir = sortDir === 'desc' ? -1 : 1
  const valOf = (row) => col.type === 'model' ? row.model_name
    : col.type === 'shortname' ? row.short_name
    : row[col.key]
  return [...rows].sort((ra, rb) => {
    const a = valOf(ra), b = valOf(rb)
    const an = a == null || a === '', bn = b == null || b === ''
    if (an && bn) return 0
    if (an) return 1
    if (bn) return -1
    let c
    if (col.type === 'int' || col.type === 'num') c = Number(a) - Number(b)
    else if (col.type === 'bool') c = (a === b) ? 0 : (a ? 1 : -1)
    else c = String(a).localeCompare(String(b), 'ja')
    return c * dir
  })
}

export default function MachineModelLinkPage() {
  const navigate = useNavigate()
  const [rows, setRows]     = useState([])
  const [models, setModels] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits]   = useState({}) // { [machine_code]: { key: value, ... } } dirty patch
  const [savingCode, setSavingCode] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [error, setError]   = useState('')

  const [storeFilter, setStoreFilter] = useState('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [showDetail, setShowDetail]   = useState(false)
  // D-103 R1: ヘッダクリック 3-state ソート (無→asc→desc→無)。表示順のみ=machine_code紐付き無傷。
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const toggleSort = (key) => {
    const next = nextSortState(sortKey, sortDir, key)
    setSortKey(next.sortKey)
    setSortDir(next.sortDir)
  }

  const load = async () => {
    setLoading(true)
    try {
      const [ms, mm, st] = await Promise.all([getAllMachinesForAdmin(), getMachineModels(), getAllStores()])
      setRows(ms)
      setModels(mm)
      setStores(st)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const modelById = useMemo(() => {
    const m = {}
    for (const x of models) m[x.model_id] = x
    return m
  }, [models])

  // 有効 model_id (編集中なら編集値、なければ元値)
  const effModelId = (row) => (edits[row.machine_code] && 'model_id' in edits[row.machine_code])
    ? edits[row.machine_code].model_id
    : row.model_id
  // short_name は常に機種マスタ参照 (選択中 model の short_name)。machines 側にはコピーしない。
  const shortNameFor = (row) => {
    const mid = effModelId(row)
    return mid ? (modelById[mid]?.short_name ?? '') : ''
  }

  const cellValue = (row, key) => {
    const e = edits[row.machine_code]
    if (e && key in e) return e[key]
    return row[key]
  }

  const setCell = (code, key, value) => {
    setEdits(prev => ({ ...prev, [code]: { ...(prev[code] ?? {}), [key]: value } }))
  }

  const storeOptions = useMemo(() => {
    const seen = new Map()
    for (const r of rows) if (!seen.has(r.store_code)) {
      const st = stores.find(s => s.store_code === r.store_code)
      seen.set(r.store_code, st?.store_name ?? r.store_code)
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows, stores])

  const typeOptions = useMemo(
    () => [...new Set(rows.map(r => r.type_id).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    let r = rows
    if (storeFilter) r = r.filter(m => m.store_code === storeFilter)
    if (typeFilter)  r = r.filter(m => m.type_id === typeFilter)
    if (unlinkedOnly) r = r.filter(m => !effModelId(m))
    return r
  }, [rows, storeFilter, typeFilter, unlinkedOnly, edits])

  // D-103 R1: 表示順のみソート (元行不変=machine_code実体・edits紐付き無傷)。edits非依存=元供給値で安定ソート。
  const sorted = useMemo(() => sortMachines(filtered, sortKey, sortDir), [filtered, sortKey, sortDir])

  const cols = showDetail ? [...ALWAYS_COLS, ...DETAIL_COLS] : ALWAYS_COLS
  const dirtyCodes = Object.keys(edits).filter(c => Object.keys(edits[c] ?? {}).length > 0)
  const unlinkedCount = useMemo(() => rows.filter(r => !effModelId(r)).length, [rows, edits])

  const saveRow = async (code) => {
    const patch = edits[code]
    if (!patch || Object.keys(patch).length === 0) return
    setSavingCode(code)
    setError('')
    try {
      await updateMachineAdmin(code, patch)
      // ローカル反映 + dirty クリア (再読込せず体感速度優先。model_name/short_name は modelById 参照で追従)
      setRows(prev => prev.map(r => r.machine_code === code ? { ...r, ...patch } : r))
      setEdits(prev => { const n = { ...prev }; delete n[code]; return n })
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSavingCode(null)
    }
  }

  const saveAll = async () => {
    setBulkSaving(true)
    setError('')
    for (const code of dirtyCodes) {
      const patch = edits[code]
      try {
        await updateMachineAdmin(code, patch)
        setRows(prev => prev.map(r => r.machine_code === code ? { ...r, ...patch } : r))
        setEdits(prev => { const n = { ...prev }; delete n[code]; return n })
      } catch (e) {
        setError(`${code}: ${e.message || '保存に失敗しました'}`)
        setBulkSaving(false)
        return
      }
    }
    setBulkSaving(false)
  }

  const inputCls = 'w-full h-8 px-1.5 bg-transparent border border-transparent hover:border-border focus:border-accent text-text text-xs outline-none rounded'
  const thCls = 'py-1.5 px-2 whitespace-nowrap text-left'

  const renderCell = (row, col) => {
    const code = row.machine_code
    const dirty = edits[code] && col.key in edits[code]
    switch (col.type) {
      case 'ro':
        return <span className="text-xs text-muted whitespace-nowrap">{row[col.key] ?? '—'}</span>
      case 'shortname':
        return <span data-testid={`sn-${code}`} className="text-xs text-amber-300 whitespace-nowrap">{shortNameFor(row) || '—'}</span>
      case 'model':
        return (
          <select
            data-testid={`model-${code}`}
            value={cellValue(row, 'model_id') ?? ''}
            onChange={e => setCell(code, 'model_id', e.target.value)}
            className={`${inputCls} ${dirty ? 'border-amber-400' : ''} ${col.w ?? 'min-w-[9rem]'} bg-bg`}
          >
            <option value="">（未設定）</option>
            {models.map(m => <option key={m.model_id} value={m.model_id}>{m.model_name}</option>)}
          </select>
        )
      case 'bool':
        return (
          <input
            type="checkbox"
            data-testid={`active-${code}`}
            checked={!!cellValue(row, 'is_active')}
            onChange={e => setCell(code, 'is_active', e.target.checked)}
            className="w-5 h-5 accent-blue-600"
          />
        )
      case 'int':
      case 'num':
        return (
          <input
            type="number"
            value={cellValue(row, col.key) ?? ''}
            onChange={e => setCell(code, col.key, e.target.value)}
            className={`${inputCls} text-right ${dirty ? 'border-amber-400' : ''} ${col.type === 'int' ? 'min-w-[3.5rem]' : 'min-w-[4.5rem]'}`}
          />
        )
      case 'date':
        return (
          <input
            type="date"
            value={cellValue(row, col.key) ?? ''}
            onChange={e => setCell(code, col.key, e.target.value)}
            className={`${inputCls} ${dirty ? 'border-amber-400' : ''} min-w-[8rem]`}
          />
        )
      default: // text
        return (
          <input
            type="text"
            value={cellValue(row, col.key) ?? ''}
            onChange={e => setCell(code, col.key, e.target.value)}
            className={`${inputCls} ${dirty ? 'border-amber-400' : ''} ${col.w ?? 'min-w-[7rem]'}`}
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader module="admin" hideHome={true} title="機械モデル紐付" onBack={() => navigate('/admin')} />

      {/* フィルタ / トグル */}
      <div className="shrink-0 px-4 py-2 border-b border-border space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-xs bg-bg text-text">
            <option value="">全店舗</option>
            {storeOptions.map(([code, name]) => <option key={code} value={code}>{name}（{code}）</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-xs bg-bg text-text">
            <option value="">全種別</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => setUnlinkedOnly(v => !v)}
            data-testid="toggle-unlinked"
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${unlinkedOnly ? 'bg-amber-500 text-white border-transparent' : 'bg-bg text-text border-border hover:bg-surface'}`}
          >
            未紐付けのみ（{unlinkedCount}）
          </button>
          <button
            onClick={() => setShowDetail(v => !v)}
            data-testid="toggle-detail"
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${showDetail ? 'bg-blue-600 text-white border-transparent' : 'bg-bg text-text border-border hover:bg-surface'}`}
          >
            {showDetail ? '詳細列 表示中' : '詳細列 展開'}
          </button>
          <span className="text-xs text-muted ml-auto">{filtered.length}台 / 全{rows.length}台</span>
        </div>
        {dirtyCodes.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-900/20 border border-amber-200 rounded-lg">
            <span className="text-xs text-amber-700">{dirtyCodes.length}台 変更あり</span>
            <button onClick={() => setEdits({})} className="ml-auto text-xs text-muted px-3 py-1 rounded border border-border">取消</button>
            <button onClick={saveAll} disabled={bulkSaving} data-testid="bulk-save" className="text-xs text-white bg-blue-600 px-4 py-1 rounded font-bold disabled:opacity-50">
              {bulkSaving ? '保存中…' : '一括保存'}
            </button>
          </div>
        )}
        {error && <p className="text-accent2 text-xs">{error}</p>}
      </div>

      {/* グリッド (タブレット以上想定の横広編集グリッド) */}
      <div className="flex-1 overflow-auto list-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
            <span className="text-muted text-sm">読み込み中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted text-sm py-10">該当する機械がありません</p>
        ) : (
          <table className="text-sm border-collapse min-w-max">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-muted text-xs font-bold">
                {cols.map(c => (
                  <th key={c.key} className={thCls}>
                    <button
                      type="button"
                      data-testid={`sort-${c.key}`}
                      onClick={() => toggleSort(c.key)}
                      className="flex items-center gap-0.5 font-bold hover:text-accent"
                    >
                      {c.label}
                      {sortKey === c.key && <span className="text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                ))}
                <th className={thCls}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const isDirty = !!(edits[row.machine_code] && Object.keys(edits[row.machine_code]).length > 0)
                return (
                  <tr key={row.machine_code} data-testid={`row-${row.machine_code}`} className={`border-b border-border ${isDirty ? 'bg-amber-900/10' : 'hover:bg-surface/50'}`}>
                    {cols.map(c => <td key={c.key} className="py-0.5 px-1 align-middle">{renderCell(row, c)}</td>)}
                    <td className="py-0.5 px-1">
                      {isDirty && (
                        <button
                          onClick={() => saveRow(row.machine_code)}
                          disabled={savingCode === row.machine_code}
                          className="text-[11px] text-white bg-blue-600 px-2.5 py-1 rounded font-bold disabled:opacity-50 whitespace-nowrap"
                        >
                          {savingCode === row.machine_code ? '…' : '保存'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
