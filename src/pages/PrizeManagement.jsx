import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPrizes, addPrize, addPrizesBatch, updatePrize,
  getPrizeOrders, addPrizeOrder,
  getVehicleStocks, addVehicleStock, updateVehicleStock, deleteVehicleStock,
  getInventoryChecks, saveInventoryCheck, updateInventoryCheck, deleteInventoryCheck,
} from '../services/sheets'

const TABS = [
  { key: 'master', label: 'マスタ' },
  { key: 'import', label: 'CSV取込' },
  { key: 'orders', label: '発注' },
  { key: 'inventory', label: '棚卸し' },
  { key: 'vehicle', label: '車在庫' },
]

const SUPPLIERS = [
  { id: 'SGP', name: '景品フォーム' },
  { id: 'PCH', name: 'ピーチトイ' },
  { id: 'SDY', name: 'エスディーワイ' },
  { id: 'INF', name: 'インフィニティ' },
  { id: 'AXS', name: 'アクシズ' },
  { id: 'LNS', name: 'LINE仕入先' },
  { id: 'MCR', name: 'メルカリ' },
]

// 商品名から短縮名とサイズを自動抽出
function extractFromName(name) {
  if (!name) return { short_name: '', item_size: '' }
  let item_size = ''
  let short_name = name

  // サイズ抽出パターン
  const sizePatterns = [
    /\b(BIG|big|Big)\b/,
    /\b(XXL|XL|LL|L|M|S|SS)\b/i,
    /(\d+[cm×xX]\d+[cm]*)/,
    /(\d+cm)/i,
    /(特大|大|中|小|ミニ)/,
    /(Lサイズ|Mサイズ|Sサイズ)/,
    /(ぬいぐるみ|BIG|メガ|ギガ|ジャンボ)/,
  ]
  for (const pat of sizePatterns) {
    const m = name.match(pat)
    if (m) { item_size = m[1] || m[0]; break }
  }

  // 短縮名: 先頭20文字、カッコ内やサイズ部分を除去
  short_name = name
    .replace(/【.*?】/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/（.*?）/g, '')
    .replace(/\s*(BIG|XXL|XL|LL|Lサイズ|Mサイズ|Sサイズ|特大|ジャンボ|メガ|ギガ)\s*/gi, ' ')
    .trim()
  if (short_name.length > 20) short_name = short_name.slice(0, 20)

  return { short_name, item_size }
}

export default function PrizeManagement() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('master')
  const [prizes, setPrizes] = useState([])
  const [orders, setOrders] = useState([])
  const [vehicleStocks, setVehicleStocks] = useState([])
  const [inventoryChecks, setInventoryChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name') // name, cost, supplier, active, created
  const [sortAsc, setSortAsc] = useState(true)

  // 棚卸し用state
  const [checkItems, setCheckItems] = useState({}) // { prize_id: { checked, qty, note } }
  const [checkedBy, setCheckedBy] = useState('')
  const [selectedForMove, setSelectedForMove] = useState({}) // { prize_id: true }
  const [moveStaff, setMoveStaff] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)

  // CSV取込用state
  const [csvFile, setCsvFile] = useState(null)
  const [csvRows, setCsvRows] = useState([])       // パース済みデータ
  const [csvHeaders, setCsvHeaders] = useState([])  // CSVのヘッダー行
  const [csvMapping, setCsvMapping] = useState({})  // CSV列→フィールドのマッピング
  const [csvPreview, setCsvPreview] = useState([])  // 変換後プレビュー
  const [csvStep, setCsvStep] = useState('upload')  // upload → map → preview → done
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')

  // 棚卸し履歴編集
  const [editingInventory, setEditingInventory] = useState(null) // { _row, warehouse_qty, checked_by, note }

  // 車在庫フィルタ
  const [vehicleFilter, setVehicleFilter] = useState('')

  useEffect(() => { loadData() }, [])

  // コード→日本語名に変換するヘルパー
  function resolveSupplierName(raw) {
    if (!raw) return ''
    const s = SUPPLIERS.find(x => x.id === raw || x.name === raw)
    return s ? s.name : raw
  }

  async function loadData() {
    setLoading(true)
    try {
      const [p, o, vs, ic] = await Promise.all([
        getPrizes(), getPrizeOrders(),
        getVehicleStocks(), getInventoryChecks(),
      ])
      // 仕入先名を読み込み時に正規化
      p.forEach(item => { item.supplier_name = resolveSupplierName(item.supplier_name) })
      o.forEach(item => {
        if (!item.supplier_name) {
          const prize = p.find(x => String(x.prize_id) === String(item.prize_id))
          item.supplier_name = prize?.supplier_name || ''
        } else {
          item.supplier_name = resolveSupplierName(item.supplier_name)
        }
      })
      setPrizes(p)
      setOrders(o)
      setVehicleStocks(vs.filter(v => v.stock_id)) // 空行除外
      setInventoryChecks(ic)
    } catch (e) { setMsg('読み込みエラー: ' + e.message) }
    setLoading(false)
  }

  // --- 景品マスタ ---
  function startNewPrize() {
    setForm({ unit_cost: '0', is_active: 'TRUE' })
    setEditing({ type: 'prize', mode: 'new' })
    setMsg('')
  }

  function startEditPrize(p) {
    const f = { ...p }
    // loadDataで変換済みだが念のため
    f.supplier_name = resolveSupplierName(f.supplier_name)
    setForm(f)
    setEditing({ type: 'prize', mode: 'edit', data: p })
    setMsg('')
  }

  async function savePrize() {
    if (!form.prize_name) { setMsg('景品名は必須です'); return }
    setSaving(true)
    try {
      if (editing.mode === 'new') {
        await addPrize(form)
        setMsg('✅ 景品を登録しました')
      } else {
        await updatePrize(editing.data._row, form)
        setMsg('✅ 景品を更新しました')
      }
      setEditing(null)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  // --- 発注 ---
  function startNewOrder() {
    setForm({ ordered_at: new Date().toISOString().slice(0,10) })
    setEditing({ type: 'order', mode: 'new' })
    setMsg('')
  }

  async function saveOrder() {
    if (!form.prize_id || !form.order_quantity) { setMsg('景品と数量は必須です'); return }
    const p = prizes.find(x => String(x.prize_id) === String(form.prize_id))
    setSaving(true)
    try {
      await addPrizeOrder({
        ...form,
        prize_name: p?.prize_name || '',
        unit_cost_at_order: form.unit_cost_at_order || p?.unit_cost || '0',
      })
      setMsg('✅ 発注を登録しました')
      setEditing(null)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  // --- 棚卸し ---
  function initCheckItems() {
    const items = {}
    prizes.filter(p => p.is_active === 'TRUE').forEach(p => {
      items[p.prize_id] = { checked: false, qty: '', note: '' }
    })
    setCheckItems(items)
    setSelectedForMove({})
  }

  useEffect(() => {
    if (tab === 'inventory' && prizes.length > 0) {
      initCheckItems()
    }
  }, [tab, prizes])

  function toggleCheck(prizeId) {
    setCheckItems(prev => ({
      ...prev,
      [prizeId]: { ...prev[prizeId], checked: !prev[prizeId]?.checked }
    }))
  }

  function updateCheckQty(prizeId, qty) {
    // マイナス値バリデーション
    const numVal = Number(qty)
    if (qty !== '' && (isNaN(numVal) || numVal < 0)) return
    setCheckItems(prev => ({
      ...prev,
      [prizeId]: { ...prev[prizeId], qty }
    }))
  }

  function updateCheckNote(prizeId, note) {
    setCheckItems(prev => ({
      ...prev,
      [prizeId]: { ...prev[prizeId], note }
    }))
  }

  async function saveCheck() {
    const items = Object.entries(checkItems)
      .filter(([_, v]) => v.checked)
      .map(([pid, v]) => {
        const p = prizes.find(x => String(x.prize_id) === pid)
        return {
          prize_id: pid,
          prize_name: p?.prize_name || '',
          warehouse_qty: v.qty || '0',
          checked_by: checkedBy,
          note: v.note,
        }
      })
    if (items.length === 0) { setMsg('チェック済みの景品がありません'); return }
    if (!checkedBy.trim()) { setMsg('⚠️ 確認者名を入力してください'); return }
    // マイナス値の最終チェック
    const invalidItems = items.filter(it => Number(it.warehouse_qty) < 0)
    if (invalidItems.length > 0) { setMsg('⚠️ 数量にマイナス値があります。0以上の値を入力してください。'); return }
    setSaving(true)
    try {
      await saveInventoryCheck(items)
      setMsg(`✅ ${items.length}件の棚卸しを記録しました`)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  // --- 棚卸し→車在庫 移動 ---
  function toggleMoveSelect(prizeId) {
    setSelectedForMove(prev => {
      const next = { ...prev }
      if (next[prizeId]) delete next[prizeId]
      else next[prizeId] = true
      return next
    })
  }

  async function moveToVehicle() {
    const ids = Object.keys(selectedForMove)
    if (ids.length === 0) { setMsg('移動する景品を選択してください'); return }
    if (!moveStaff.trim()) { setMsg('担当者名を入力してください'); return }
    setSaving(true)
    try {
      for (const pid of ids) {
        const p = prizes.find(x => String(x.prize_id) === pid)
        const qty = checkItems[pid]?.qty || '1'
        // 既存の車在庫に同じ担当者・景品がある場合は数量加算
        const existing = vehicleStocks.find(
          v => String(v.prize_id) === pid && v.staff_name === moveStaff.trim()
        )
        if (existing) {
          const newQty = (parseInt(existing.quantity) || 0) + (parseInt(qty) || 1)
          await updateVehicleStock(existing._row, {
            ...existing, quantity: String(newQty)
          })
        } else {
          await addVehicleStock({
            staff_name: moveStaff.trim(),
            prize_id: pid,
            prize_name: p?.prize_name || '',
            quantity: qty || '1',
          })
        }
      }
      setMsg(`✅ ${ids.length}件を ${moveStaff} の車在庫に移動しました`)
      setShowMoveModal(false)
      setSelectedForMove({})
      setMoveStaff('')
      await loadData()
    } catch (e) { setMsg('移動エラー: ' + e.message) }
    setSaving(false)
  }

  // --- 車在庫 ---
  function startEditVehicle(v) {
    setForm({ ...v })
    setEditing({ type: 'vehicle', mode: 'edit', data: v })
    setMsg('')
  }

  function startAddVehicle() {
    setForm({ quantity: '1' })
    setEditing({ type: 'vehicle', mode: 'new' })
    setMsg('')
  }

  async function saveVehicleItem() {
    if (!form.prize_id) { setMsg('景品を選択してください'); return }
    if (!form.staff_name) { setMsg('担当者名を入力してください'); return }
    const p = prizes.find(x => String(x.prize_id) === String(form.prize_id))
    setSaving(true)
    try {
      if (editing.mode === 'new') {
        await addVehicleStock({
          ...form,
          prize_name: p?.prize_name || form.prize_name || '',
        })
        setMsg('✅ 車在庫に追加しました')
      } else {
        await updateVehicleStock(editing.data._row, {
          ...form,
          prize_name: p?.prize_name || form.prize_name || '',
        })
        setMsg('✅ 車在庫を更新しました')
      }
      setEditing(null)
      await loadData()
    } catch (e) { setMsg('保存エラー: ' + e.message) }
    setSaving(false)
  }

  async function removeVehicleItem(v) {
    if (!confirm(`${v.prize_name} を車在庫から削除しますか？`)) return
    try {
      await deleteVehicleStock(v._row)
      setMsg('✅ 削除しました')
      await loadData()
    } catch (e) { setMsg('削除エラー: ' + e.message) }
  }

  // --- CSV取込 ---
  const CSV_FIELDS = [
    { key: 'prize_name', label: '商品名', required: true },
    { key: 'short_name', label: '短縮名' },
    { key: 'item_size', label: 'サイズ' },
    { key: 'unit_cost', label: '単価' },
    { key: 'supplier_name', label: 'サプライヤー' },
    { key: 'jan_code', label: 'JANコード' },
    { key: 'category', label: 'カテゴリ' },
    { key: 'order_at', label: '発注日' },
    { key: 'arrival_at', label: '到着予定日' },
    { key: 'case_count', label: 'ケース数' },
    { key: 'pieces_per_case', label: '入数/ケース' },
    { key: 'restock_count', label: '後入り数' },
    { key: 'stock_count', label: '在庫数' },
    { key: 'is_active', label: 'ステータス' },
  ]

  // CSV列名の自動マッチング
  const HEADER_ALIASES = {
    prize_name: ['商品名','品名','品目','アイテム名','名前','商品','prize_name','name','item','product'],
    short_name: ['短縮名','short_name','short'],
    item_size: ['サイズ','size','item_size'],
    unit_cost: ['単価','仕入単価','原価','コスト','price','cost','unit_cost'],
    supplier_name: ['サプライヤー','仕入先','メーカー','supplier','vendor'],
    jan_code: ['jan','janコード','jan_code','バーコード','barcode'],
    category: ['カテゴリ','分類','種類','category','type'],
    order_at: ['発注日','注文日','order_at','order_date','発注'],
    arrival_at: ['到着予定日','入荷予定','納期','arrival','arrival_at','到着日'],
    case_count: ['ケース数','ケース','case','cases','case_count'],
    pieces_per_case: ['入数','入数/ケース','pcs','pieces','pieces_per_case'],
    restock_count: ['後入り数','後入り','restock','restock_count'],
    stock_count: ['在庫数','在庫','stock','stock_count'],
    is_active: ['ステータス','status','is_active','active'],
  }

  function autoMapHeaders(headers) {
    const mapping = {}
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const h of headers) {
        const normalized = h.trim().toLowerCase()
        if (aliases.some(a => normalized === a.toLowerCase() || normalized.includes(a.toLowerCase()))) {
          mapping[field] = h
          break
        }
      }
    }
    return mapping
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    // ヘッダー行を取得
    const headers = parseCSVLine(lines[0])
    const rows = lines.slice(1).map(line => {
      const vals = parseCSVLine(line)
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] || '' })
      return obj
    }).filter(r => Object.values(r).some(v => v.trim()))
    return { headers, rows }
  }

  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i+1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { result.push(current.trim()); current = '' }
        else current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  function handleCsvFile(file) {
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const { headers, rows } = parseCSV(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      const mapping = autoMapHeaders(headers)
      setCsvMapping(mapping)
      setCsvStep('map')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function buildPreview() {
    const preview = csvRows.map(row => {
      const item = {}
      for (const [field, csvCol] of Object.entries(csvMapping)) {
        // null/undefinedのみ空文字にする（"0"等のfalsyな値はそのまま保持）
        if (csvCol) {
          const val = row[csvCol]
          item[field] = val != null ? String(val) : ''
        }
      }
      // 商品名が数値のみ・空の場合はスキップ（列マッピング誤りの可能性）
      if (!item.prize_name || /^\d+$/.test(item.prize_name.trim())) {
        // 数値のみの商品名は明らかにマッピングミス → 空扱い
        if (/^\d+$/.test((item.prize_name || '').trim())) {
          console.warn('CSV取込: 商品名が数値のみです。列マッピングを確認してください:', item.prize_name)
          return null
        }
        return null
      }
      // 商品名から short_name, item_size を自動抽出（CSVに値がなければ）
      if (item.prize_name) {
        const { short_name, item_size } = extractFromName(item.prize_name)
        if (!item.short_name) item.short_name = short_name
        if (!item.item_size) item.item_size = item_size
      }
      // ステータス: CSVにあればそのまま、なければTRUE
      if (!item.is_active) item.is_active = 'TRUE'
      return item
    }).filter(Boolean)
    if (preview.length === 0 && csvRows.length > 0) {
      setMsg('⚠️ 有効な行が0件です。「商品名」の列マッピングが正しいか確認してください。')
    }
    setCsvPreview(preview)
    setCsvStep('preview')
  }

  async function runImport() {
    if (csvPreview.length === 0) return
    setImporting(true)
    setImportResult('')
    try {
      const count = await addPrizesBatch(csvPreview)
      setImportResult(`${count}件の景品を登録しました`)
      setCsvStep('done')
      await loadData()
    } catch (e) {
      setImportResult('インポートエラー: ' + e.message)
    }
    setImporting(false)
  }

  function resetCsv() {
    setCsvFile(null)
    setCsvRows([])
    setCsvHeaders([])
    setCsvMapping({})
    setCsvPreview([])
    setCsvStep('upload')
    setImportResult('')
  }

  const SORT_OPTIONS = [
    { key: 'name', label: '名前' },
    { key: 'short', label: '短縮名' },
    { key: 'cost', label: '単価' },
    { key: 'supplier', label: 'サプライヤー' },
    { key: 'order', label: '発注日' },
    { key: 'arrival', label: '納期' },
    { key: 'stock', label: '在庫数' },
    { key: 'active', label: 'ステータス' },
  ]

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filteredPrizes = prizes
    .filter(p => !search || p.prize_name?.includes(search) || p.supplier_name?.includes(search) || p.short_name?.includes(search))
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1
      switch (sortKey) {
        case 'short': return (a.short_name||'').localeCompare(b.short_name||'') * dir
        case 'cost': return ((parseInt(a.unit_cost)||0) - (parseInt(b.unit_cost)||0)) * dir
        case 'supplier': return (a.supplier_name||'').localeCompare(b.supplier_name||'') * dir
        case 'order': return (a.order_at||'').localeCompare(b.order_at||'') * dir
        case 'arrival': return (a.arrival_at||'').localeCompare(b.arrival_at||'') * dir
        case 'stock': return ((parseInt(a.stock_count)||0) - (parseInt(b.stock_count)||0)) * dir
        case 'active': {
          const av = a.is_active === 'TRUE' ? 0 : 1
          const bv = b.is_active === 'TRUE' ? 0 : 1
          return (av - bv) * dir
        }
        default: return (a.prize_name||'').localeCompare(b.prize_name||'') * dir
      }
    })

  const activePrizes = prizes.filter(p => p.is_active === 'TRUE')

  // 車在庫: 担当者リスト取得
  const staffList = [...new Set(vehicleStocks.map(v => v.staff_name).filter(Boolean))]
  const filteredVehicle = vehicleFilter
    ? vehicleStocks.filter(v => v.staff_name === vehicleFilter)
    : vehicleStocks

  // 車在庫を担当者別にグループ化
  const vehicleByStaff = {}
  filteredVehicle.forEach(v => {
    if (!vehicleByStaff[v.staff_name]) vehicleByStaff[v.staff_name] = []
    vehicleByStaff[v.staff_name].push(v)
  })

  if (loading) return <div className="min-h-screen bg-bg text-text flex items-center justify-center">読み込み中...</div>

  // --- 編集フォーム ---
  if (editing) {
    if (editing.type === 'prize') return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">{editing.mode === 'new' ? '景品登録' : '景品編集'}</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}
        <div className="space-y-4">
          <Field label="商品名" k="prize_name" form={form} setForm={setForm} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="短縮名" k="short_name" form={form} setForm={setForm} placeholder="自動抽出可" />
            <Field label="サイズ" k="item_size" form={form} setForm={setForm} placeholder="自動抽出可" />
          </div>
          {/* 商品名から自動抽出ボタン */}
          {form.prize_name && !form.short_name && (
            <button onClick={() => {
              const { short_name, item_size } = extractFromName(form.prize_name)
              setForm(p => ({ ...p, short_name: short_name || p.short_name, item_size: item_size || p.item_size }))
            }} className="text-xs text-accent underline">商品名から短縮名・サイズを自動抽出</button>
          )}
          <div>
            <label className="block text-muted text-sm mb-1">カテゴリ</label>
            <select value={form.category||''} onChange={e => setForm(p=>({...p, category:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="">未設定</option>
              <option value="フィギュア">フィギュア</option>
              <option value="ぬいぐるみ">ぬいぐるみ</option>
              <option value="雑貨">雑貨</option>
              <option value="食品">食品</option>
              <option value="ラスワン">ラスワン</option>
              <option value="限定">限定</option>
              <option value="セット">セット</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="仕入単価(円)" k="unit_cost" form={form} setForm={setForm} type="number" />
            <Field label="JANコード" k="jan_code" form={form} setForm={setForm} placeholder="空欄可" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="ケース数" k="case_count" form={form} setForm={setForm} type="number" placeholder="0" />
            <Field label="入数/ケース" k="pieces_per_case" form={form} setForm={setForm} type="number" placeholder="0" />
            <div>
              <label className="block text-muted text-sm mb-1">合計数</label>
              <div className="bg-surface2 border border-border rounded-lg px-3 py-2 text-accent font-bold text-center">
                {(parseInt(form.case_count)||0) * (parseInt(form.pieces_per_case)||0) || '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted text-sm mb-1">仕入先</label>
              <select value={form.supplier_name||''} onChange={e => setForm(p=>({...p, supplier_name:e.target.value}))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
                <option value="">選択してください</option>
                {SUPPLIERS.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <Field label="連絡先" k="supplier_contact" form={form} setForm={setForm} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="発注日" k="order_at" form={form} setForm={setForm} type="date" />
            <Field label="到着予定日" k="arrival_at" form={form} setForm={setForm} type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="後入り数" k="restock_count" form={form} setForm={setForm} type="number" placeholder="0" />
            <Field label="在庫数" k="stock_count" form={form} setForm={setForm} type="number" placeholder="0" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">ステータス</label>
            <select value={form.is_active||'TRUE'} onChange={e => setForm(p=>({...p, is_active:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="TRUE">有効</option>
              <option value="FALSE">無効</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={savePrize} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )

    if (editing.type === 'order') return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">新規発注</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">景品 <span className="text-accent2">*</span></label>
            <select value={form.prize_id||''} onChange={e => {
              const p = prizes.find(x => String(x.prize_id) === e.target.value)
              const supName = p?.supplier_name || ''
              const sup = SUPPLIERS.find(s => s.id === supName || s.name === supName)
              setForm(prev => ({...prev, prize_id: e.target.value, unit_cost_at_order: p?.unit_cost||'0', supplier_name: sup?.name || supName}))
            }} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="">選択してください</option>
              {prizes.filter(p=>p.is_active==='TRUE').map(p => (
                <option key={p.prize_id} value={p.prize_id}>{p.prize_name} (¥{p.unit_cost})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">仕入先</label>
            <select value={form.supplier_name||''} onChange={e => setForm(p=>({...p, supplier_name:e.target.value}))}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="">選択してください</option>
              {SUPPLIERS.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <Field label="発注日" k="ordered_at" form={form} setForm={setForm} type="date" />
          <Field label="発注数" k="order_quantity" form={form} setForm={setForm} type="number" required />
          <Field label="発注時単価" k="unit_cost_at_order" form={form} setForm={setForm} type="number" />
          {form.order_quantity && form.unit_cost_at_order && (
            <div className="bg-surface2 rounded-lg p-3 text-center">
              <span className="text-muted text-sm">合計: </span>
              <span className="text-accent font-bold text-lg">
                ¥{((parseInt(form.order_quantity)||0) * (parseInt(form.unit_cost_at_order)||0)).toLocaleString()}
              </span>
            </div>
          )}
          <Field label="備考" k="note" form={form} setForm={setForm} />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={saveOrder} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '発注登録'}
          </button>
        </div>
      </div>
    )

    if (editing.type === 'vehicle') return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">{editing.mode === 'new' ? '車在庫追加' : '車在庫編集'}</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}
        <div className="space-y-4">
          <Field label="担当者" k="staff_name" form={form} setForm={setForm} required />
          <div>
            <label className="block text-muted text-sm mb-1">景品 <span className="text-accent2">*</span></label>
            <select value={form.prize_id||''} onChange={e => {
              const p = prizes.find(x => String(x.prize_id) === e.target.value)
              setForm(prev => ({...prev, prize_id: e.target.value, prize_name: p?.prize_name||''}))
            }} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text">
              <option value="">選択してください</option>
              {activePrizes.map(p => (
                <option key={p.prize_id} value={p.prize_id}>{p.prize_name}</option>
              ))}
            </select>
          </div>
          <Field label="数量" k="quantity" form={form} setForm={setForm} type="number" required />
          <Field label="備考" k="note" form={form} setForm={setForm} />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setEditing(null)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={saveVehicleItem} disabled={saving}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  // --- 移動モーダル ---
  if (showMoveModal) {
    const moveIds = Object.keys(selectedForMove)
    return (
      <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowMoveModal(false)} className="text-muted text-2xl">←</button>
          <h1 className="text-xl font-bold text-accent">車在庫へ移動</h1>
        </div>
        {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

        <div className="mb-4">
          <label className="block text-muted text-sm mb-1">担当者名 <span className="text-accent2">*</span></label>
          <input type="text" value={moveStaff} onChange={e => setMoveStaff(e.target.value)}
            placeholder="例: 田中" list="staff-list"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text" />
          {staffList.length > 0 && (
            <datalist id="staff-list">
              {staffList.map(s => <option key={s} value={s} />)}
            </datalist>
          )}
        </div>

        <div className="text-muted text-sm mb-2">移動する景品 ({moveIds.length}件)</div>
        <div className="space-y-2 mb-6">
          {moveIds.map(pid => {
            const p = prizes.find(x => String(x.prize_id) === pid)
            const qty = checkItems[pid]?.qty || '1'
            return (
              <div key={pid} className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
                <span className="text-text font-bold">{p?.prize_name}</span>
                <span className="text-accent text-sm">x{qty}</span>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowMoveModal(false)} className="flex-1 bg-surface2 text-muted rounded-lg py-3">キャンセル</button>
          <button onClick={moveToVehicle} disabled={saving}
            className="flex-1 bg-accent3 text-black font-bold rounded-lg py-3 disabled:opacity-50">
            {saving ? '移動中...' : '移動する'}
          </button>
        </div>
      </div>
    )
  }

  // --- メイン一覧 ---
  return (
    <div className="min-h-screen bg-bg text-text p-4 max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/admin')} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold text-accent">景品管理</h1>
      </div>

      {msg && <div className="bg-surface2 rounded-lg p-3 mb-4 text-sm text-accent">{msg}</div>}

      {/* タブ */}
      <div className="flex bg-surface rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg('') }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap px-2 ${
              tab === t.key ? 'bg-accent text-black' : 'text-muted'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ===== 景品マスタ ===== */}
      {tab === 'master' && (
        <>
          {/* 検索 + 新規 */}
          <div className="flex gap-2 mb-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="検索..." className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            <button onClick={startNewPrize} className="bg-accent text-black font-bold rounded-lg px-3 py-2 text-sm whitespace-nowrap">
              + 新規
            </button>
          </div>

          {/* 並び替えチップ */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => toggleSort(opt.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
                  sortKey === opt.key
                    ? 'bg-accent/20 border-accent/50 text-accent'
                    : 'bg-surface border-border text-muted'
                }`}>
                {opt.label}
                {sortKey === opt.key && <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>

          {/* 件数 */}
          <div className="text-muted text-[11px] mb-2">{filteredPrizes.length}件</div>

          {/* カード一覧 */}
          <div className="space-y-1.5">
            {filteredPrizes.map(p => {
              const displayName = p.short_name || p.prize_name
              const hasArrival = p.arrival_at && !p.arrival_at.startsWith('0')
              const stockNum = parseInt(p.stock_count) || 0
              const restockNum = parseInt(p.restock_count) || 0
              return (
                <div key={p.prize_id} onClick={() => startEditPrize(p)}
                  className={`bg-surface border rounded-xl px-3 py-2.5 active:bg-surface2 cursor-pointer ${
                    p.is_active !== 'TRUE' ? 'border-border opacity-50' : 'border-border'
                  }`}>
                  <div className="flex items-center gap-2">
                    {/* ステータスドット */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      p.is_active === 'TRUE' ? 'bg-accent3' : 'bg-accent2/50'
                    }`} />

                    {/* メイン: 短縮名+用途を上、景品フル名を下（小さく） */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-text font-bold text-sm truncate">{displayName}</span>
                        {p.item_size && <span className="text-accent4 text-[10px] font-bold px-1 py-0.5 bg-accent4/10 rounded">{p.item_size}</span>}
                        {p.category && <span className="text-accent text-[10px] font-bold px-1 py-0.5 bg-accent/10 rounded">{p.category}</span>}
                      </div>
                      <div className="text-muted text-[11px] truncate flex items-center gap-2">
                        {p.short_name && <span>{p.prize_name}</span>}
                        <span>{p.supplier_name || '—'}</span>
                        <span className="text-accent font-bold">¥{parseInt(p.unit_cost||0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* 右側: 在庫・納期 */}
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {restockNum > 0 && <span className="text-accent4 text-[10px]">+{restockNum}</span>}
                        <span className={`text-xs font-bold ${stockNum <= 0 ? 'text-accent2' : 'text-accent3'}`}>{stockNum}</span>
                      </div>
                      {hasArrival && (
                        <div className="text-muted text-[10px]">{p.arrival_at}</div>
                      )}
                    </div>
                    <span className="text-muted/30 text-sm">›</span>
                  </div>
                </div>
              )
            })}
            {filteredPrizes.length === 0 && <div className="text-center text-muted py-8">景品が登録されていません</div>}
          </div>
        </>
      )}

      {/* ===== CSV取込 ===== */}
      {tab === 'import' && (
        <>
          {/* ステップ1: アップロード */}
          {csvStep === 'upload' && (
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-xl p-4 text-center">
                <div className="text-muted text-sm mb-3">CSVファイルを選択して景品を一括登録</div>
                <label className="inline-block bg-accent text-black font-bold rounded-lg px-6 py-3 text-sm cursor-pointer">
                  CSVファイルを選択
                  <input type="file" accept=".csv,.txt" className="hidden"
                    onChange={e => handleCsvFile(e.target.files[0])} />
                </label>
                <div className="text-muted text-[11px] mt-3">
                  対応列: 商品名, 単価, サプライヤー, JANコード, カテゴリ, 発注日, 到着予定日, ケース数, 入数 など
                </div>
              </div>
              <div className="bg-surface2 rounded-xl p-3 text-[11px] text-muted space-y-1">
                <div className="font-bold text-text text-xs mb-1">自動処理</div>
                <div>・商品名から短縮名(20文字)を自動生成</div>
                <div>・商品名からサイズ(BIG/L/M/S等)を自動抽出</div>
                <div>・CSV列名を自動でフィールドにマッピング</div>
              </div>
            </div>
          )}

          {/* ステップ2: 列マッピング */}
          {csvStep === 'map' && (
            <div className="space-y-4">
              <div className="bg-surface2 rounded-xl p-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted">ファイル: </span>
                  <span className="text-accent font-bold">{csvFile?.name}</span>
                  <span className="text-muted ml-2">({csvRows.length}行)</span>
                </div>
                <button onClick={resetCsv} className="text-xs text-muted hover:text-accent2">リセット</button>
              </div>

              <div className="text-xs text-muted font-bold uppercase tracking-wider">列マッピング</div>
              <div className="space-y-2">
                {CSV_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className={`text-xs w-28 shrink-0 ${f.required ? 'text-accent2 font-bold' : 'text-muted'}`}>
                      {f.label}{f.required && ' *'}
                    </span>
                    <select value={csvMapping[f.key] || ''}
                      onChange={e => setCsvMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text">
                      <option value="">（未割当）</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={resetCsv}
                  className="flex-1 bg-surface2 text-muted rounded-lg py-3 text-sm">キャンセル</button>
                <button onClick={buildPreview} disabled={!csvMapping.prize_name}
                  className="flex-1 bg-accent text-black font-bold rounded-lg py-3 text-sm disabled:opacity-30">
                  プレビュー
                </button>
              </div>
            </div>
          )}

          {/* ステップ3: プレビュー */}
          {csvStep === 'preview' && (
            <div className="space-y-4">
              <div className="bg-surface2 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm">
                  <span className="text-accent font-bold">{csvPreview.length}件</span>
                  <span className="text-muted"> の景品をインポートします</span>
                </span>
                <button onClick={() => setCsvStep('map')} className="text-xs text-muted hover:text-accent">戻る</button>
              </div>

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {csvPreview.map((item, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-text font-bold text-sm truncate">{item.short_name || item.prize_name}</span>
                      {item.item_size && <span className="text-accent4 text-[10px] font-bold px-1 py-0.5 bg-accent4/10 rounded">{item.item_size}</span>}
                      {item.category && <span className="text-accent text-[10px] font-bold px-1 py-0.5 bg-accent/10 rounded">{item.category}</span>}
                    </div>
                    <div className="text-muted text-[11px] truncate flex items-center gap-2 mt-0.5">
                      {item.short_name && <span className="text-muted/60">{item.prize_name}</span>}
                      {item.supplier_name && <span>{item.supplier_name}</span>}
                      {item.unit_cost && <span className="text-accent font-bold">¥{parseInt(item.unit_cost||0).toLocaleString()}</span>}
                      {item.case_count && item.pieces_per_case && (
                        <span className="text-accent3">{item.case_count}C×{item.pieces_per_case}</span>
                      )}
                      {item.arrival_at && <span>{item.arrival_at}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {importResult && (
                <div className="bg-surface2 rounded-lg p-3 text-sm text-accent">{importResult}</div>
              )}

              <div className="flex gap-3">
                <button onClick={resetCsv}
                  className="flex-1 bg-surface2 text-muted rounded-lg py-3 text-sm">キャンセル</button>
                <button onClick={runImport} disabled={importing || csvPreview.length === 0}
                  className="flex-1 bg-accent3 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-30">
                  {importing ? 'インポート中...' : `${csvPreview.length}件をインポート`}
                </button>
              </div>
            </div>
          )}

          {/* ステップ4: 完了 */}
          {csvStep === 'done' && (
            <div className="space-y-4">
              <div className="bg-accent3/10 border border-accent3/30 rounded-xl p-6 text-center">
                <div className="text-accent3 text-3xl mb-2">✅</div>
                <div className="text-accent3 font-bold text-lg">{importResult}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={resetCsv}
                  className="flex-1 bg-surface2 text-muted rounded-lg py-3 text-sm">別のCSVを取込</button>
                <button onClick={() => { setTab('master'); resetCsv() }}
                  className="flex-1 bg-accent text-black font-bold rounded-lg py-3 text-sm">マスタを確認</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 発注履歴 ===== */}
      {tab === 'orders' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={startNewOrder} className="bg-accent text-black font-bold rounded-lg px-4 py-2 text-sm">
              + 新規発注
            </button>
          </div>
          <div className="space-y-2">
            {orders.map(o => {
              const status = !o.arrived_at ? '未入荷' : (parseInt(o.arrival_quantity||0) < parseInt(o.order_quantity||0) ? '一部入荷' : '入荷済')
              const statusColor = status === '未入荷' ? 'bg-accent2/20 text-accent2' : status === '入荷済' ? 'bg-accent3/20 text-accent3' : 'bg-accent/20 text-accent'
              const supDisplay = o.supplier_name || ''
              return (
                <div key={o.order_id} className="bg-surface border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text font-bold">{o.prize_name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>{status}</span>
                  </div>
                  <div className="text-muted text-xs mt-1 flex gap-3 flex-wrap">
                    <span>{o.ordered_at}</span>
                    <span>x{o.order_quantity}</span>
                    <span>¥{parseInt(o.total_cost||0).toLocaleString()}</span>
                    {supDisplay && <span>{supDisplay}</span>}
                  </div>
                </div>
              )
            })}
            {orders.length === 0 && <div className="text-center text-muted py-8">発注履歴がありません</div>}
          </div>
        </>
      )}

      {/* ===== 棚卸し ===== */}
      {tab === 'inventory' && (
        <>
          {/* 担当者入力（必須） */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <input type="text" value={checkedBy} onChange={e => setCheckedBy(e.target.value)}
                placeholder="確認者名（必須）"
                className={`w-full bg-surface border rounded-lg px-3 py-2 text-sm text-text ${
                  !checkedBy.trim() ? 'border-accent2/50' : 'border-border'}`} />
              {!checkedBy.trim() && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-accent2 text-xs">必須</span>}
            </div>
          </div>

          {/* サマリー */}
          <div className="bg-surface2 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted">アクティブ景品: </span>
              <span className="text-accent font-bold">{activePrizes.length}</span>
              <span className="text-muted ml-3">チェック済: </span>
              <span className="text-accent3 font-bold">
                {Object.values(checkItems).filter(v => v.checked).length}
              </span>
            </div>
          </div>

          {/* 一括操作バー */}
          {Object.keys(selectedForMove).length > 0 && (
            <div className="sticky top-0 z-40 bg-surface3 border border-accent3/30 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-accent3 font-bold">
                {Object.keys(selectedForMove).length}件選択中
              </span>
              <button onClick={() => setShowMoveModal(true)}
                className="bg-accent3 text-black font-bold rounded-lg px-4 py-2 text-sm">
                車在庫へ移動
              </button>
            </div>
          )}

          {/* アクティブ景品リスト */}
          <div className="space-y-2 mb-6">
            {activePrizes.map(p => {
              const ci = checkItems[p.prize_id] || {}
              const isChecked = ci.checked
              const isSelected = selectedForMove[p.prize_id]
              return (
                <div key={p.prize_id}
                  className={`bg-surface border rounded-xl p-3 transition-all ${
                    isSelected ? 'border-accent3/60 bg-accent3/5' :
                    isChecked ? 'border-accent/30' : 'border-border'
                  }`}>
                  <div className="flex items-center gap-3">
                    {/* チェックボックス */}
                    <button onClick={() => toggleCheck(p.prize_id)}
                      className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                        isChecked ? 'bg-accent border-accent text-black' : 'border-border'
                      }`}>
                      {isChecked && <span className="text-lg font-bold">✓</span>}
                    </button>

                    {/* 景品情報 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-text font-bold text-sm truncate block">{p.prize_name}</span>
                      <div className="text-muted text-xs flex gap-2">
                        <span>¥{parseInt(p.unit_cost||0).toLocaleString()}</span>
                        <span>{p.supplier_name}</span>
                      </div>
                    </div>

                    {/* 車移動選択 */}
                    {isChecked && (
                      <button onClick={() => toggleMoveSelect(p.prize_id)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-accent3/20 border-accent3 text-accent3'
                            : 'border-border text-muted hover:border-accent3/50'
                        }`}>
                        {isSelected ? '選択中' : '車へ'}
                      </button>
                    )}
                  </div>

                  {/* チェック済みの場合: 数量・メモ入力 */}
                  {isChecked && (
                    <div className="mt-2 pl-10 flex gap-2">
                      <input type="number" min="0" value={ci.qty||''} onChange={e => updateCheckQty(p.prize_id, e.target.value)}
                        placeholder="倉庫数量" className="w-24 bg-surface2 border border-border rounded-lg px-2 py-1 text-sm text-text" />
                      <input type="text" value={ci.note||''} onChange={e => updateCheckNote(p.prize_id, e.target.value)}
                        placeholder="メモ" className="flex-1 bg-surface2 border border-border rounded-lg px-2 py-1 text-sm text-text" />
                    </div>
                  )}
                </div>
              )
            })}
            {activePrizes.length === 0 && <div className="text-center text-muted py-8">有効な景品がありません</div>}
          </div>

          {/* 保存ボタン */}
          <button onClick={saveCheck} disabled={saving || Object.values(checkItems).filter(v=>v.checked).length === 0}
            className="w-full bg-accent text-black font-bold rounded-xl py-3 disabled:opacity-30 text-sm">
            {saving ? '保存中...' : '棚卸し記録を保存'}
          </button>

          {/* 直近の棚卸し履歴 */}
          {inventoryChecks.filter(ic => ic.check_id).length > 0 && (
            <div className="mt-6">
              <div className="text-muted text-xs font-bold uppercase tracking-wider mb-2">直近の棚卸し履歴</div>

              {/* 編集フォーム */}
              {editingInventory && (
                <div className="bg-surface border-2 border-blue-500 rounded-xl p-3 mb-3">
                  <div className="font-bold text-sm mb-2">{editingInventory.prize_name} を編集</div>
                  <div className="flex gap-2 mb-2">
                    <div>
                      <div className="text-[10px] text-muted mb-0.5">数量</div>
                      <input type="number" min="0" value={editingInventory.warehouse_qty}
                        onChange={e => setEditingInventory(prev => ({...prev, warehouse_qty: e.target.value}))}
                        className="w-20 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-sm text-text" />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted mb-0.5">確認者</div>
                      <input type="text" value={editingInventory.checked_by}
                        onChange={e => setEditingInventory(prev => ({...prev, checked_by: e.target.value}))}
                        className="w-24 bg-surface2 border border-border rounded-lg px-2 py-1.5 text-sm text-text" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-muted mb-0.5">メモ</div>
                      <input type="text" value={editingInventory.note || ''}
                        onChange={e => setEditingInventory(prev => ({...prev, note: e.target.value}))}
                        className="w-full bg-surface2 border border-border rounded-lg px-2 py-1.5 text-sm text-text" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      setSaving(true)
                      try {
                        await updateInventoryCheck(editingInventory._row, editingInventory)
                        setMsg('棚卸しデータを更新しました')
                        setEditingInventory(null)
                        await loadData()
                      } catch (e) { setMsg('更新エラー: ' + e.message) }
                      setSaving(false)
                    }} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm">保存</button>
                    <button onClick={() => setEditingInventory(null)}
                      className="flex-1 bg-surface2 border border-border text-text py-2 rounded-lg text-sm">キャンセル</button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {inventoryChecks.filter(ic => ic.check_id).slice(-10).reverse().map((ic, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg p-2 flex justify-between items-center text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-text font-bold">{ic.prize_name}</span>
                      <span className="text-muted ml-2">x{ic.warehouse_qty}</span>
                      <span className="text-muted ml-2">{ic.check_date} {ic.checked_by && `/ ${ic.checked_by}`}</span>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button onClick={() => setEditingInventory({
                        _row: ic._row, prize_name: ic.prize_name,
                        warehouse_qty: ic.warehouse_qty, checked_by: ic.checked_by, note: ic.note
                      })} className="text-blue-400 hover:text-blue-300 px-1">✏️</button>
                      <button onClick={async () => {
                        if (!confirm(`${ic.prize_name} の棚卸し記録を削除しますか？`)) return
                        setSaving(true)
                        try {
                          await deleteInventoryCheck(ic._row)
                          setMsg('棚卸しデータを削除しました')
                          await loadData()
                        } catch (e) { setMsg('削除エラー: ' + e.message) }
                        setSaving(false)
                      }} className="text-accent2 hover:text-red-400 px-1">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 車在庫 ===== */}
      {tab === 'vehicle' && (
        <>
          <div className="flex gap-2 mb-4">
            <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text">
              <option value="">全担当者</option>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={startAddVehicle} className="bg-accent text-black font-bold rounded-lg px-3 py-2 text-sm whitespace-nowrap">
              + 追加
            </button>
          </div>

          {/* 合計サマリ */}
          <div className="bg-surface2 rounded-xl p-3 mb-4">
            <div className="text-sm">
              <span className="text-muted">合計品目: </span>
              <span className="text-accent font-bold">{filteredVehicle.length}</span>
              <span className="text-muted ml-3">合計数量: </span>
              <span className="text-accent font-bold">
                {filteredVehicle.reduce((sum, v) => sum + (parseInt(v.quantity)||0), 0)}
              </span>
            </div>
          </div>

          {/* 担当者別グループ表示 */}
          {Object.keys(vehicleByStaff).length === 0 ? (
            <div className="text-center text-muted py-8">車在庫がありません</div>
          ) : (
            Object.entries(vehicleByStaff).map(([staff, items]) => (
              <div key={staff} className="mb-4">
                <div className="text-xs text-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>🚗</span>
                  <span>{staff}</span>
                  <span className="text-accent">({items.length}品目)</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(v => (
                    <div key={v.stock_id} className="bg-surface border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-text font-bold text-sm truncate block">{v.prize_name}</span>
                          <div className="text-muted text-xs mt-0.5 flex gap-2">
                            <span>数量: <span className="text-accent">{v.quantity}</span></span>
                            {v.note && <span>{v.note}</span>}
                            {v.updated_at && <span>{v.updated_at.slice(0,10)}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => startEditVehicle(v)}
                            className="text-xs px-2 py-1 rounded-lg bg-surface2 text-muted hover:text-accent transition-colors">
                            編集
                          </button>
                          <button onClick={() => removeVehicleItem(v)}
                            className="text-xs px-2 py-1 rounded-lg bg-surface2 text-muted hover:text-accent2 transition-colors">
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

function Field({ label, k, type='text', placeholder='', required, form, setForm }) {
  return (
    <div>
      <label className="block text-muted text-sm mb-1">{label}{required && <span className="text-accent2 ml-1">*</span>}</label>
      <input type={type} value={form[k]||''} onChange={e => setForm(p=>({...p, [k]:e.target.value}))}
        placeholder={placeholder}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent" />
    </div>
  )
}
