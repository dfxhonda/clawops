import { useEffect, useState, useRef, useCallback } from 'react'
import { getStores, getMachines, getBooths, getLastReadingsMap, getAllMeterReadings, parseNum, saveReading, clearCache } from '../services/sheets'

const DRAFT_KEY = 'clawops_drafts_v2'
function getDrafts() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'{}') } catch { return {} } }
function setDrafts(d) { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) }

export default function MainInput() {
  // マスタデータ
  const [stores, setStores] = useState([])
  const [machines, setMachines] = useState([])
  const [booths, setBooths] = useState([])
  const [readingsMap, setReadingsMap] = useState({})
  const [allReadings, setAllReadings] = useState([])

  // 選択状態
  const [storeId, setStoreId] = useState(null)
  const [machineId, setMachineId] = useState(null)
  const [readDate, setReadDate] = useState(() => new Date().toISOString().slice(0,10))

  // 入力データ (boothId -> { in_meter, out_meter, prize_stock, prize_restock, ... })
  const [inputs, setInputs] = useState({})

  // UI状態
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [expandedSettings, setExpandedSettings] = useState({})

  // refs
  const refsMap = useRef({})
  const getRef = useCallback((boothId, field) => {
    if (!refsMap.current[boothId]) refsMap.current[boothId] = {}
    return (el) => { refsMap.current[boothId][field] = el }
  }, [])

  // 初回ロード: 店舗一覧
  useEffect(() => {
    getStores().then(s => {
      setStores(s)
      if (s.length > 0) setStoreId(s[0].store_id)
      setLoading(false)
    }).catch(e => { console.error(e); setLoading(false) })
  }, [])

  // 店舗変更時: 機械一覧取得
  useEffect(() => {
    if (!storeId) return
    setMachines([])
    setBooths([])
    getMachines(storeId).then(ms => {
      setMachines(ms)
      if (ms.length > 0) setMachineId(ms[0].machine_id)
      else setMachineId(null)
    })
    // 全readings取得（店舗集計用）
    getAllMeterReadings().then(r => setAllReadings(r))
  }, [storeId])

  // 機械変更時: ブース＋最新読み取り取得
  useEffect(() => {
    if (!machineId) return
    setBooths([])
    async function load() {
      const bs = await getBooths(machineId)
      setBooths(bs)
      const map = await getLastReadingsMap(bs.map(b => b.booth_id))
      setReadingsMap(map)
      // ドラフト復元
      const drafts = getDrafts()
      const restored = {}
      for (const b of bs) {
        if (drafts[b.booth_id]) restored[b.booth_id] = drafts[b.booth_id]
      }
      setInputs(restored)
    }
    load()
  }, [machineId])

  // 入力更新
  function setInp(boothId, key, val) {
    setInputs(prev => {
      const next = { ...prev, [boothId]: { ...(prev[boothId]||{}), [key]: val } }
      // ドラフト自動保存
      const drafts = getDrafts()
      drafts[boothId] = next[boothId]
      setDrafts(drafts)
      return next
    })
  }

  // Enter → 次フィールド (IN → OUT → 残 → 補 → 次ブースIN)
  const FIELD_ORDER = ['in_meter', 'out_meter', 'prize_stock', 'prize_restock']
  function handleKeyDown(e, boothId, field) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const bIdx = booths.findIndex(b => b.booth_id === boothId)
    const fIdx = FIELD_ORDER.indexOf(field)
    if (fIdx < FIELD_ORDER.length - 1) {
      const next = FIELD_ORDER[fIdx + 1]
      refsMap.current[boothId]?.[next]?.focus()
    } else if (bIdx < booths.length - 1) {
      const nextBooth = booths[bIdx + 1].booth_id
      refsMap.current[nextBooth]?.['in_meter']?.focus()
      refsMap.current[nextBooth]?.['in_meter']?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // 保存
  async function handleSave() {
    const toSave = []
    for (const booth of booths) {
      const inp = inputs[booth.booth_id] || {}
      const { latest } = readingsMap[booth.booth_id] || {}
      if (!inp.in_meter) continue
      toSave.push({
        read_date: readDate,
        booth_id: booth.booth_id,
        full_booth_code: booth.full_booth_code,
        in_meter: inp.in_meter,
        out_meter: inp.out_meter || '',
        prize_restock_count: inp.prize_restock || '',
        prize_stock_count: inp.prize_stock || '',
        prize_name: inp.prize_name || latest?.prize_name || '',
        note: '',
        set_a: inp.set_a || latest?.set_a || '',
        set_c: inp.set_c || latest?.set_c || '',
        set_l: inp.set_l || latest?.set_l || '',
        set_r: inp.set_r || latest?.set_r || '',
        set_o: inp.set_o || latest?.set_o || '',
      })
    }
    if (toSave.length === 0) { showToast('まだINメーターが入力されていません。ブースのIN欄に売上メーター値を入力してください。', 'error'); return }
    setSaving(true)
    try {
      for (const r of toSave) await saveReading(r)
      // ドラフトクリア（保存済みブースのみ）
      const drafts = getDrafts()
      for (const r of toSave) delete drafts[r.booth_id]
      setDrafts(drafts)
      // 入力クリア
      setInputs(prev => {
        const next = { ...prev }
        for (const r of toSave) delete next[r.booth_id]
        return next
      })
      showToast(`${toSave.length}件保存しました`, 'success')
      // readings更新
      const fresh = await getAllMeterReadings(true)
      setAllReadings(fresh)
      const map = await getLastReadingsMap(booths.map(b => b.booth_id))
      setReadingsMap(map)
    } catch (e) {
      showToast('保存に失敗しました。通信状態を確認してリトライしてください。(' + e.message + ')', 'error')
    }
    setSaving(false)
  }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ===== 集計計算 =====
  const currentMachine = machines.find(m => m.machine_id === machineId)
  const defaultPrice = currentMachine ? parseNum(currentMachine.default_price) || 100 : 100

  function calcBoothStats(booth) {
    const inp = inputs[booth.booth_id] || {}
    const { latest, last } = readingsMap[booth.booth_id] || {}
    const price = parseNum(booth.play_price || defaultPrice)
    const prevIn = latest?.in_meter ? parseNum(latest.in_meter) : null
    const prevOut = latest?.out_meter ? parseNum(latest.out_meter) : null
    const inVal = inp.in_meter ? parseNum(inp.in_meter) : null
    const outVal = inp.out_meter ? parseNum(inp.out_meter) : null
    const inDiff = inVal !== null && prevIn !== null ? inVal - prevIn : null
    const outDiff = outVal !== null && prevOut !== null ? outVal - prevOut : null
    const sales = inDiff !== null && inDiff >= 0 ? inDiff * price : null
    const payoutRate = outDiff !== null && inDiff !== null && inDiff > 0
      ? ((outDiff / inDiff) * 100).toFixed(1) : null
    return { price, prevIn, prevOut, inVal, outVal, inDiff, outDiff, sales, payoutRate }
  }

  // 機械小計
  function getMachineSubtotal() {
    let totalSales = 0, prevTotalSales = 0, count = 0
    for (const booth of booths) {
      const s = calcBoothStats(booth)
      if (s.sales !== null && s.sales >= 0) { totalSales += s.sales; count++ }
      // 前回差分（latest vs last）
      const { latest, last } = readingsMap[booth.booth_id] || {}
      if (latest && last) {
        const d = parseNum(latest.in_meter) - parseNum(last.in_meter)
        if (!isNaN(d) && d >= 0) prevTotalSales += d * s.price
      }
    }
    return { totalSales, prevTotalSales, diff: totalSales - prevTotalSales, count }
  }

  // 店舗合計（全機械）
  function getStoreTotals() {
    if (!storeId || machines.length === 0) return null
    let total = 0, prevTotal = 0, inputCount = 0, totalBooths = 0
    // 全ブースのIDを集める
    for (const m of machines) {
      const mBooths = allReadings.filter(r => {
        const code = r.full_booth_code || ''
        const storeCode = stores.find(s => s.store_id === storeId)?.store_code
        return storeCode && code.startsWith(storeCode)
      })
      // 簡易集計: 各ブースの最新2件から差分計算
    }
    // 簡易版: 現在の機械の情報のみ使う（正確な全店舗集計はAPI追加後）
    return null
  }

  const inputCount = booths.filter(b => inputs[b.booth_id]?.in_meter).length
  const machineSub = getMachineSubtotal()
  const currentStore = stores.find(s => s.store_id === storeId)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-32">
      {/* ===== トップバー ===== */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border">
        {/* 店舗チップ */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 overflow-x-auto" style={{scrollbarWidth:'none'}}>
          {stores.map(s => (
            <button key={s.store_id} onClick={() => setStoreId(s.store_id)}
              className={`shrink-0 px-3 py-1 rounded-2xl text-xs font-semibold border transition-all
                ${s.store_id === storeId
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-surface border-border text-muted'}`}>
              {s.store_name}
            </button>
          ))}
          <div className="shrink-0 ml-auto pl-2 text-xs text-blue-400 font-bold">{readDate.slice(5)}</div>
        </div>

        {/* 機械タブ */}
        {machines.length > 0 && (
          <div className="flex gap-1 px-2.5 pb-1.5 overflow-x-auto" style={{scrollbarWidth:'none'}}>
            {machines.map(m => {
              const active = m.machine_id === machineId
              return (
                <button key={m.machine_id} onClick={() => setMachineId(m.machine_id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all
                    ${active
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                      : 'bg-surface border-border text-muted/70'}`}>
                  {m.machine_code} {m.machine_name?.slice(0,6)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== 4ブース入力エリア ===== */}
      <div className="px-2 pt-1.5">
        {booths.map((booth, bIdx) => {
          const s = calcBoothStats(booth)
          const inp = inputs[booth.booth_id] || {}
          const { latest } = readingsMap[booth.booth_id] || {}
          const hasInput = !!inp.in_meter
          const expanded = expandedSettings[booth.booth_id]

          return (
            <div key={booth.booth_id} className="mb-1.5">
              {/* メイン入力行: コード | IN | OUT | 残 | 補 */}
              <div className={`grid grid-cols-[38px_1fr_1fr_56px_56px] gap-1 items-end p-1.5 rounded-lg border
                ${hasInput ? 'bg-surface border-green-800/50' : 'bg-surface border-border'}`}>

                {/* ブースコード */}
                <div className="text-center">
                  <div className="text-[13px] font-extrabold text-blue-400">{booth.booth_code}</div>
                  <div className="text-[7px] text-muted/50 truncate">{latest?.prize_name?.slice(0,4) || ''}</div>
                </div>

                {/* IN */}
                <div>
                  <div className="flex justify-between px-0.5 mb-0.5">
                    <span className="text-[9px] text-muted font-bold">IN（売上）</span>
                    <span className="text-[8px] text-muted/50">{s.prevIn !== null ? s.prevIn.toLocaleString() : ''}</span>
                  </div>
                  <input ref={getRef(booth.booth_id, 'in_meter')}
                    type="number" inputMode="numeric"
                    className={`w-full p-2 text-[16px] font-semibold text-center rounded-md border outline-none transition-colors
                      bg-bg text-text
                      ${hasInput ? 'border-green-700/60' : 'border-border'}
                      focus:border-blue-500`}
                    placeholder={s.prevIn !== null ? String(s.prevIn) : '売上メーター値'}
                    value={inp.in_meter || ''}
                    onChange={e => setInp(booth.booth_id, 'in_meter', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_id, 'in_meter')}
                  />
                  {s.inDiff !== null && (
                    <div className={`text-[9px] font-bold text-center mt-0.5
                      ${s.inDiff < 0 || s.inDiff > 50000 ? 'text-accent2' : 'text-green-400'}`}>
                      +{s.inDiff.toLocaleString()} ¥{s.sales?.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* OUT */}
                <div>
                  <div className="flex justify-between px-0.5 mb-0.5">
                    <span className="text-[9px] text-muted font-bold">OUT（払出）</span>
                    <span className="text-[8px] text-muted/50">{s.prevOut !== null ? s.prevOut.toLocaleString() : ''}</span>
                  </div>
                  <input ref={getRef(booth.booth_id, 'out_meter')}
                    type="number" inputMode="numeric"
                    className={`w-full p-2 text-[16px] font-semibold text-center rounded-md border outline-none transition-colors
                      bg-bg text-text border-border focus:border-blue-500
                      ${inp.out_meter ? 'border-green-700/60' : ''}`}
                    placeholder={s.prevOut !== null ? String(s.prevOut) : '払出メーター値'}
                    value={inp.out_meter || ''}
                    onChange={e => setInp(booth.booth_id, 'out_meter', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_id, 'out_meter')}
                  />
                  {s.outDiff !== null && (
                    <div className={`text-[9px] font-bold text-center mt-0.5
                      ${s.outDiff < 0 ? 'text-accent2' : 'text-green-400'}`}>
                      +{s.outDiff.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* 残 */}
                <div>
                  <div className="text-[9px] text-muted font-bold text-center mb-0.5" title="景品の残り個数">残</div>
                  <input ref={getRef(booth.booth_id, 'prize_stock')}
                    type="number" inputMode="numeric"
                    className="w-full p-2 text-[14px] font-semibold text-center rounded-md border border-border bg-bg text-text outline-none focus:border-blue-500"
                    placeholder={latest?.prize_stock_count || '0'}
                    title="景品残数"
                    value={inp.prize_stock || ''}
                    onChange={e => setInp(booth.booth_id, 'prize_stock', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_stock')}
                  />
                </div>

                {/* 補 */}
                <div>
                  <div className="text-[9px] text-muted font-bold text-center mb-0.5" title="景品の補充数">補</div>
                  <input ref={getRef(booth.booth_id, 'prize_restock')}
                    type="number" inputMode="numeric"
                    className="w-full p-2 text-[14px] font-semibold text-center rounded-md border border-border bg-bg text-text outline-none focus:border-blue-500"
                    placeholder="0"
                    title="景品補充数"
                    value={inp.prize_restock || ''}
                    onChange={e => setInp(booth.booth_id, 'prize_restock', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_id, 'prize_restock')}
                  />
                </div>
              </div>

              {/* 自動計算行 + A設定 + 展開ボタン */}
              <div className="flex items-center gap-2 px-2 py-0.5 text-[10px]">
                <span className="text-muted/60">
                  {s.sales !== null ? `¥${s.sales.toLocaleString()}` : '---'}
                </span>
                {s.payoutRate !== null && (
                  <span className={`px-1.5 py-0.5 rounded-md font-bold
                    ${Number(s.payoutRate) > 30 ? 'bg-red-900/20 text-accent2' :
                      Number(s.payoutRate) < 5 ? 'bg-blue-900/20 text-blue-400' :
                      'bg-green-900/20 text-green-400'}`}>
                    {s.payoutRate}%
                  </span>
                )}
                <div className="flex items-center gap-1 ml-1" title="アシスト回数（A設定）">
                  <span className="text-purple-400 font-bold text-[10px]">A<span className="text-[7px] text-purple-400/60 ml-0.5">ｱｼｽﾄ</span></span>
                  <input
                    className="w-7 p-0.5 text-[10px] text-center rounded border border-border bg-bg text-purple-300 outline-none focus:border-purple-400"
                    placeholder={latest?.set_a || '-'}
                    value={inp.set_a || ''}
                    onChange={e => setInp(booth.booth_id, 'set_a', e.target.value)}
                    title="アシスト回数"
                  />
                </div>
                <button onClick={() => setExpandedSettings(prev => ({...prev, [booth.booth_id]: !prev[booth.booth_id]}))}
                  className="ml-auto text-muted/40 hover:text-muted transition-colors">
                  {expanded ? '設定 ▲' : 'C/L/R/O ▼'}
                </button>
              </div>

              {/* 展開: C/L/R/O + 景品名 */}
              {expanded && (
                <div className="flex gap-1.5 px-2 pb-1.5 items-end">
                  {[
                    { key: 'set_c', label: 'C', fullName: 'ｷｬｯﾁ', title: 'キャッチ時パワー' },
                    { key: 'set_l', label: 'L', fullName: 'ﾕﾙ', title: '緩和時パワー' },
                    { key: 'set_r', label: 'R', fullName: 'ﾘﾀｰﾝ', title: '復帰時パワー' },
                    { key: 'set_o', label: 'O', fullName: 'ｿﾉ他', title: '固有設定' },
                  ].map(s => (
                    <div key={s.key} className="w-10 text-center" title={s.title}>
                      <div className="text-[8px] text-purple-400 font-bold">{s.label}<span className="text-[6px] text-purple-400/60 block">{s.fullName}</span></div>
                      <input
                        className="w-full p-1 text-[11px] text-center rounded border border-border bg-bg text-text outline-none focus:border-purple-400"
                        type={s.key === 'set_o' ? 'text' : 'number'}
                        inputMode={s.key === 'set_o' ? 'text' : 'numeric'}
                        placeholder={latest?.[s.key] || '-'}
                        value={inp[s.key] || ''}
                        onChange={e => setInp(booth.booth_id, s.key, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="flex-1">
                    <div className="text-[8px] text-muted font-bold">景品名</div>
                    <input
                      className="w-full p-1 text-[11px] rounded border border-border bg-bg text-text outline-none focus:border-blue-500"
                      placeholder={latest?.prize_name || '景品名'}
                      value={inp.prize_name || ''}
                      onChange={e => setInp(booth.booth_id, 'prize_name', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== 集計パネル（下部）===== */}
      {booths.length > 0 && (
        <div className="mx-2 mt-2 bg-surface border-t-2 border-border rounded-lg p-2.5">
          {/* 機械小計 */}
          <div className="text-[10px] text-muted font-bold mb-1.5 flex items-center gap-2">
            {currentMachine?.machine_code} {currentMachine?.machine_name} ({booths.length}ブース)
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <StatBox label="今回売上" value={machineSub.totalSales > 0 ? `¥${fmtK(machineSub.totalSales)}` : '---'}
              sub={`${machineSub.count}ブース入力済`} positive={machineSub.totalSales > 0} />
            <StatBox label="前回比"
              value={machineSub.diff !== 0 && machineSub.prevTotalSales > 0 ? `${machineSub.diff > 0 ? '+' : ''}¥${fmtK(machineSub.diff)}` : '---'}
              sub={machineSub.prevTotalSales > 0 ? `${((machineSub.diff / machineSub.prevTotalSales) * 100).toFixed(0)}%` : ''}
              positive={machineSub.diff > 0} negative={machineSub.diff < 0} />
          </div>
        </div>
      )}

      {/* ===== 送信バー ===== */}
      <div className="fixed bottom-10 left-0 right-0 bg-bg/95 backdrop-blur border-t border-border px-3 py-2 z-[90]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-blue-400">{inputCount}/{booths.length}</span>
          <button onClick={handleSave} disabled={saving || inputCount === 0}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all min-h-[48px]
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] text-white
              ${inputCount > 0 && inputCount >= booths.length
                ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? '保存中...'
              : inputCount >= booths.length ? `全${inputCount}件を保存`
              : inputCount > 0 ? `${inputCount}件を保存`
              : '入力してください'}
          </button>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub, positive, negative }) {
  return (
    <div className="bg-bg border border-border rounded-md p-1.5 text-center">
      <div className="text-[8px] text-muted">{label}</div>
      <div className={`text-[13px] font-extrabold mt-0.5
        ${positive ? 'text-green-400' : negative ? 'text-accent2' : 'text-text'}`}>
        {value}
      </div>
      {sub && <div className="text-[8px] text-muted/50 mt-0.5">{sub}</div>}
    </div>
  )
}

function fmtK(n) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}
