import { useState } from 'react'
import CustomNumpad from '../../clawsupport/components/CustomNumpad'
import { DENOMINATIONS, boothTotal } from '../lib/collectionCalc'
import { isIPhone } from '../../shared/lib/device'

// J-COLLECTION-01: ブース金種入力ドロワー (bottom sheet + カスタムテンキー)
// 金種行をタップでフォーカス、下部テンキーで枚数編集。小計リアルタイム。メーターは巡回データ表示。

const yen = n => Number(n || 0).toLocaleString()

export default function DenominationDrawer({ booth, counts, onChange, onClose }) {
  const [active, setActive] = useState(DENOMINATIONS[0].key)
  const c = counts || {}
  const native = !isIPhone() // iPhone以外は各行 native input (iPad=システムKB / PC=物理KB)

  function handleKey(k) {
    const cur = Number(c[active]) || 0
    let next
    if (k === '⌫') next = Math.floor(cur / 10)
    else next = Math.min(cur * 10 + Number(k), 99999)
    onChange({ ...c, [active]: next })
  }

  const subtotal = boothTotal(c)

  return (
    <div data-testid="denom-drawer" className="fixed inset-0 z-[60] bg-black/60 flex flex-col justify-end"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-bg border-t border-border rounded-t-2xl max-h-[92dvh] flex flex-col">
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-base font-bold text-text flex-1 truncate">
            {booth.machine_name}{booth.booth_number != null && ` / ブース ${booth.booth_number}`}
          </span>
          <button data-testid="denom-done" onClick={onClose} className="text-base font-bold text-blue-400 min-h-[44px] px-3">完了</button>
        </div>

        {/* meter prefill (read-only) */}
        <div className="px-4 py-2 text-xs text-muted flex gap-4 border-b border-border">
          <span>IN {yen(booth.in_meter_prev)}→{yen(booth.in_meter_current)}</span>
          <span>OUT {yen(booth.out_meter_prev)}→{yen(booth.out_meter_current)}</span>
        </div>

        {/* denominations */}
        <div className="overflow-y-auto px-3 py-2 flex-1">
          {DENOMINATIONS.map(d => {
            const cnt = Number(c[d.key]) || 0
            const on = active === d.key
            if (native) {
              return (
                <div key={d.key} data-testid={`denom-row-${d.key}`} className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-lg mb-1 border border-border">
                  <span className="text-base font-bold text-text w-16 text-left">{d.short}</span>
                  <input
                    data-testid={`denom-input-${d.key}`}
                    type="text"
                    inputMode="numeric"
                    value={cnt || ''}
                    placeholder="0"
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5)
                      onChange({ ...c, [d.key]: v === '' ? 0 : Number(v) })
                    }}
                    className="flex-1 min-w-0 text-right text-xl font-bold tabular-nums bg-bg border border-border rounded px-2 min-h-[40px] text-text"
                  />
                  <span className="text-sm text-muted w-24 text-right">{yen(cnt * d.unit)}円</span>
                </div>
              )
            }
            return (
              <button
                key={d.key}
                data-testid={`denom-row-${d.key}`}
                onClick={() => setActive(d.key)}
                className={`w-full flex items-center gap-3 px-3 min-h-[48px] rounded-lg mb-1 border ${on ? 'ring-2 ring-blue-500 bg-blue-500/10 border-transparent' : 'border-border'}`}
              >
                <span className="text-base font-bold text-text w-16 text-left">{d.short}</span>
                <span data-testid={`denom-count-${d.key}`} className="text-xl font-bold text-text flex-1 text-right tabular-nums">{cnt}</span>
                <span className="text-sm text-muted w-24 text-right">{yen(cnt * d.unit)}円</span>
              </button>
            )
          })}
        </div>

        {/* subtotal */}
        <div className="px-4 py-2 flex items-center border-t border-border">
          <span className="text-sm text-muted flex-1">小計</span>
          <span data-testid="denom-subtotal" className="text-xl font-bold text-text tabular-nums">{yen(subtotal)} 円</span>
        </div>

        {/* numpad (iPhoneのみ。iPad/PCは各行のnative inputに委譲) */}
        {!native && (
          <div className="border-t border-border bg-surface/40">
            <CustomNumpad onKey={handleKey} />
          </div>
        )}
      </div>
    </div>
  )
}
