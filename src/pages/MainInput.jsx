import { useNavigate } from 'react-router-dom'
import { useMainInput } from '../hooks/useMainInput'
import { useToast } from '../hooks/useToast'
import LogoutButton from '../components/LogoutButton'

export default function MainInput() {
  const navigate = useNavigate()
  const { showToast, Toast } = useToast()
  const {
    stores, machines, booths, readingsMap, inputs,
    storeId, setStoreId, machineId, setMachineId, readDate, setReadDate,
    loading, saving, expandedSettings, setExpandedSettings,
    setInp, handleKeyDown, handleSave, getRef, switchMachine,
    calcBoothStats, machineSub, inputCount, currentMachine, currentStore,
  } = useMainInput()

  async function onSave() {
    const result = await handleSave()
    showToast(result.ok ? `${result.count}件保存しました` : result.message, result.ok ? 'success' : 'error')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-muted text-sm">読み込み中...</p>
      </div>
    </div>
  )

  const machineIdx = machines.findIndex(m => m.machine_code === machineId)

  return (
    <div className="min-h-screen pb-32"
      onTouchStart={e => { e.currentTarget._sx = e.touches[0].clientX; e.currentTarget._sy = e.touches[0].clientY }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - (e.currentTarget._sx || 0)
        const dy = e.changedTouches[0].clientY - (e.currentTarget._sy || 0)
        if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return
        if (dx < 0) switchMachine('next')
        if (dx > 0) switchMachine('prev')
      }}>
      {/* ===== トップバー ===== */}
      <div className="sticky top-0 z-50 bg-bg border-b border-border">
        <div className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1">
          <select value={storeId || ''} onChange={e => setStoreId(e.target.value)}
            className="bg-surface2 border border-border text-text text-xs font-bold px-2 py-1.5 rounded-lg outline-none focus:border-blue-500 max-w-[160px] truncate [color-scheme:dark]">
            <option value="">店舗を選択</option>
            {stores.map(s => (
              <option key={s.store_code} value={s.store_code}>{s.store_name}</option>
            ))}
          </select>
          <input type="date" value={readDate} onChange={e => setReadDate(e.target.value)}
            className="bg-surface2 border border-border text-text text-xs px-1.5 py-1.5 rounded-lg [color-scheme:dark] w-[115px]" />
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => navigate('/admin')}
              className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-surface border border-border text-muted active:scale-95">
              ☰
            </button>
            <LogoutButton />
            <button onClick={() => {
                const mid = machines[0]?.machine_code
                if (storeId && mid) navigate(`/booth/${mid}`, { state: { storeId, storeName: currentStore?.store_name } })
                else navigate('/patrol')
              }}
              className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white active:scale-95">
              巡回
            </button>
            <button onClick={() => navigate('/patrol')}
              className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-surface border border-border text-muted active:scale-95">
              QR
            </button>
            {storeId && (
              <button onClick={() => navigate(`/ranking/${storeId}`)}
                className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-surface border border-border text-muted active:scale-95">
                順位
              </button>
            )}
          </div>
        </div>

        {/* 機械切替 */}
        {machines.length > 0 && (() => {
          const cur = machines[machineIdx] || machines[0]
          return (
            <div className="flex items-center px-2.5 pb-1.5 gap-2"
              onTouchStart={e => { e.currentTarget._sx = e.touches[0].clientX }}
              onTouchEnd={e => {
                const dx = e.changedTouches[0].clientX - (e.currentTarget._sx || 0)
                if (Math.abs(dx) < 40) return
                if (dx < 0) switchMachine('next')
                if (dx > 0) switchMachine('prev')
              }}>
              <button onClick={() => switchMachine('prev')}
                className={`text-lg px-1 ${machineIdx > 0 ? 'text-blue-400' : 'text-muted/20'}`}>◀</button>
              <div className="flex-1 text-center">
                <div className="text-sm font-bold text-blue-400">{cur.machine_code} {cur.machine_name?.slice(0, 8)}</div>
                <div className="flex justify-center gap-1 mt-0.5">
                  {machines.map((m, i) => (
                    <div key={m.machine_code}
                      onClick={() => setMachineId(m.machine_code)}
                      className={`w-1.5 h-1.5 rounded-full cursor-pointer ${i === machineIdx ? 'bg-blue-400' : 'bg-muted/30'}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => switchMachine('next')}
                className={`text-lg px-1 ${machineIdx < machines.length - 1 ? 'text-blue-400' : 'text-muted/20'}`}>▶</button>
            </div>
          )
        })()}
      </div>

      {/* ===== ブース入力エリア ===== */}
      {!storeId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🏪</div>
          <div className="text-lg font-bold text-muted mb-2">店舗を選択してください</div>
          <div className="text-xs text-muted/60">上のドロップダウンから巡回する店舗を選んでください</div>
        </div>
      ) : null}
      <div className="px-2 pt-1.5" style={{ display: storeId ? 'block' : 'none' }}>
        {booths.map((booth) => {
          const s = calcBoothStats(booth)
          const inp = inputs[booth.booth_code] || {}
          const { latest } = readingsMap[booth.booth_code] || {}
          const hasInput = !!inp.in_meter
          const expanded = expandedSettings[booth.booth_code]

          return (
            <div key={booth.booth_code} className="mb-1.5">
              {/* 1行目: ブース番号 + 景品名 */}
              <div className={`flex items-center gap-2 px-2 pt-1.5 pb-1 rounded-t-lg border-x border-t
                ${hasInput ? 'bg-surface border-green-800/50' : 'bg-surface border-border'}`}>
                <span className="text-[13px] font-extrabold text-blue-400 shrink-0">
                  {booth.booth_number != null ? `B${String(booth.booth_number).padStart(2,'0')}` : booth.booth_code}
                </span>
                <input
                  className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/50 truncate"
                  placeholder={latest?.prize_name || '景品名'}
                  value={inp.prize_name || ''}
                  onChange={e => setInp(booth.booth_code, 'prize_name', e.target.value)}
                />
                {s.payoutRate !== null && (
                  <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded
                    ${Number(s.payoutRate) > 30 ? 'bg-red-900/20 text-accent2' :
                      Number(s.payoutRate) < 5 ? 'bg-blue-900/20 text-blue-400' :
                      'bg-green-900/20 text-green-400'}`}>
                    {s.payoutRate}%
                  </span>
                )}
              </div>

              {/* メイン入力行: IN | OUT | 残 | 補 */}
              <div className={`grid grid-cols-[1fr_1fr_60px_60px] gap-1.5 items-end px-1.5 pb-1.5 border-x border-b
                ${hasInput ? 'bg-surface border-green-800/50' : 'bg-surface border-border'}`}>

                {/* IN */}
                <div>
                  <div className="flex justify-between px-0.5 mb-0.5">
                    <span className="text-[9px] text-muted font-bold">IN（売上）</span>
                    {s.inDiff !== null
                      ? <span className={`text-[9px] font-bold ${s.inDiff < 0 || s.inDiff > 50000 ? 'text-accent2' : 'text-green-400'}`}>
                          +{s.inDiff.toLocaleString()} ¥{s.sales?.toLocaleString()}
                        </span>
                      : <span className="text-[8px] text-muted/50">{s.prevIn !== null ? s.prevIn.toLocaleString() : ''}</span>
                    }
                  </div>
                  <input ref={getRef(booth.booth_code, 'in_meter')}
                    type="number" inputMode="numeric"
                    className={`w-full py-1 px-2 text-[14px] font-semibold text-center rounded-md border outline-none transition-colors
                      bg-bg text-text
                      ${hasInput ? 'border-green-700/60' : 'border-border'}
                      focus:border-blue-500`}
                    placeholder={s.prevIn !== null ? String(s.prevIn) : '売上メーター'}
                    value={inp.in_meter || ''}
                    onChange={e => setInp(booth.booth_code, 'in_meter', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_code, 'in_meter')}
                  />
                </div>

                {/* OUT */}
                <div>
                  <div className="flex justify-between px-0.5 mb-0.5">
                    <span className="text-[9px] text-muted font-bold">OUT（払出）</span>
                    {s.outDiff !== null
                      ? <span className={`text-[9px] font-bold ${s.outDiff < 0 ? 'text-accent2' : 'text-green-400'}`}>
                          +{s.outDiff.toLocaleString()}
                        </span>
                      : <span className="text-[8px] text-muted/50">{s.prevOut !== null ? s.prevOut.toLocaleString() : ''}</span>
                    }
                  </div>
                  <input ref={getRef(booth.booth_code, 'out_meter')}
                    type="number" inputMode="numeric"
                    className={`w-full py-1 px-2 text-[14px] font-semibold text-center rounded-md border outline-none transition-colors
                      bg-bg text-text border-border focus:border-blue-500
                      ${inp.out_meter ? 'border-green-700/60' : ''}`}
                    placeholder={s.prevOut !== null ? String(s.prevOut) : '払出メーター'}
                    value={inp.out_meter || ''}
                    onChange={e => setInp(booth.booth_code, 'out_meter', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_code, 'out_meter')}
                  />
                </div>

                {/* 残 */}
                <div>
                  <div className="text-[9px] text-muted font-bold text-center mb-0.5" title="景品の残り個数">残数</div>
                  <input ref={getRef(booth.booth_code, 'prize_stock')}
                    type="number" inputMode="numeric"
                    className="w-full py-1 px-1 text-[12px] font-semibold text-center rounded-md border border-border bg-bg text-text outline-none focus:border-blue-500"
                    placeholder={latest?.prize_stock_count || '0'}
                    title="景品残数"
                    value={inp.prize_stock || ''}
                    onChange={e => setInp(booth.booth_code, 'prize_stock', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_code, 'prize_stock')}
                  />
                </div>

                {/* 補 */}
                <div>
                  <div className="text-[9px] text-muted font-bold text-center mb-0.5" title="景品の補充数">補充</div>
                  <input ref={getRef(booth.booth_code, 'prize_restock')}
                    type="number" inputMode="numeric"
                    className="w-full py-1 px-1 text-[12px] font-semibold text-center rounded-md border border-border bg-bg text-text outline-none focus:border-blue-500"
                    placeholder="0"
                    title="景品補充数"
                    value={inp.prize_restock || ''}
                    onChange={e => setInp(booth.booth_code, 'prize_restock', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, booth.booth_code, 'prize_restock')}
                  />
                </div>
              </div>


              {/* ACLRO設定値 */}
              <div className="flex gap-1.5 px-2 pb-1.5 items-end">
                {[
                  { key: 'set_a', label: 'A', title: 'アシスト回数',  w: 'w-[46px]' },
                  { key: 'set_c', label: 'C', title: 'キャッチ時パワー', w: 'w-[34px]' },
                  { key: 'set_l', label: 'L', title: '緩和時パワー',   w: 'w-[34px]' },
                  { key: 'set_r', label: 'R', title: '復帰時パワー',   w: 'w-[34px]' },
                  { key: 'set_o', label: 'O', title: '固有設定',       w: 'flex-1'   },
                ].map(st => (
                  <div key={st.key} className={`flex items-center gap-0.5 ${st.w}`} title={st.title}>
                    <span className="text-[8px] text-purple-400 font-bold shrink-0">{st.label}</span>
                    <input
                      className="w-full p-1 text-[11px] text-center rounded border border-border bg-bg text-text outline-none focus:border-purple-400"
                      type={st.key === 'set_o' ? 'text' : 'number'}
                      inputMode={st.key === 'set_o' ? 'text' : 'numeric'}
                      placeholder={latest?.[st.key] || '-'}
                      value={inp[st.key] || ''}
                      onChange={e => setInp(booth.booth_code, st.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 集計パネル ===== */}
      {booths.length > 0 && (
        <div className="mx-2 mt-2 bg-surface border-t-2 border-border rounded-lg p-2.5">
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
          <button onClick={onSave} disabled={saving || inputCount === 0}
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

      <Toast />
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
