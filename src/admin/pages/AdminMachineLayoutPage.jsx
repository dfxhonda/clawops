import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/ui/PageHeader'

const METER_KEYS = [
  'in','out','out_a','out_b','out_c',
  'yen1000_in','yen500_in','yen100_in',
  'change_in','change_out','capsule_out','prize_out','unknown',
]
const KEY_LABELS = {
  in:'IN', out:'OUT', out_a:'A段', out_b:'B段', out_c:'C段',
  yen1000_in:'¥1000 IN', yen500_in:'¥500 IN', yen100_in:'¥100 IN',
  change_in:'両替IN', change_out:'両替OUT', capsule_out:'CAPSULE OUT',
  prize_out:'PRIZE OUT', unknown:'不明',
}
const PURPOSES = ['revenue','prize_count','dispense_count','inactive']
const PURPOSE_LABELS = { revenue:'売上', prize_count:'景品数', dispense_count:'払出数', inactive:'無効' }

const newMeter = () => ({ key: 'in', label: '', purpose: 'revenue', unit_price: '', active: true })

function autoFormula(meters) {
  const rev = meters.filter(m => m.active && m.purpose === 'revenue' && m.unit_price !== '')
  if (!rev.length) return ''
  return rev.map(m => `${m.key} × ${m.unit_price}円`).join(' + ')
}

const baseInp = 'bg-bg border border-border rounded px-2 py-0.5 text-text text-sm'
const baseSel = 'bg-bg border border-border rounded px-2 py-0.5 text-text text-sm'

export default function AdminMachineLayoutPage() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [manufacturer, setManufacturer] = useState('')
  const [meters, setMeters] = useState([])
  const [formula, setFormula] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    supabase.from('machine_models')
      .select('model_id,model_name,manufacturer,image_url,meter_layout')
      .order('model_name')
      .then(({ data }) => { setModels(data ?? []); setLoading(false) })
  }, [])

  const selected = models.find(m => m.model_id === selectedId)

  function selectModel(m) {
    setSelectedId(m.model_id)
    setManufacturer(m.manufacturer ?? '')
    const layout = m.meter_layout
    if (layout?.meters?.length) {
      setMeters(layout.meters.map(r => ({ ...r, unit_price: r.unit_price ?? '' })))
      setFormula(layout.revenue_formula ?? '')
    } else {
      setMeters([newMeter()])
      setFormula('')
    }
    setSaveMsg('')
  }

  function setMeterField(i, field, val) {
    setMeters(p => p.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }

  async function save() {
    if (!selectedId || saving) return
    setSaving(true)
    setSaveMsg('')
    const layout = {
      meters: meters.map(m => ({
        key: m.key,
        label: m.label || KEY_LABELS[m.key] || m.key,
        purpose: m.purpose,
        unit_price: m.purpose === 'revenue' && m.unit_price !== '' ? Number(m.unit_price) : null,
        active: Boolean(m.active),
      })),
      revenue_formula: formula || autoFormula(meters) || null,
    }
    const { error } = await supabase.from('machine_models')
      .update({ manufacturer: manufacturer || null, meter_layout: layout, updated_at: new Date().toISOString() })
      .eq('model_id', selectedId)
    if (error) {
      setSaveMsg('保存失敗: ' + error.message)
    } else {
      setModels(p => p.map(m => m.model_id === selectedId ? { ...m, manufacturer, meter_layout: layout } : m))
      setSaveMsg('保存しました')
      setTimeout(() => setSaveMsg(''), 2500)
    }
    setSaving(false)
  }

  const filtered = models.filter(m => {
    if (filter === 'blank') return !m.meter_layout?.meters?.length
    if (filter === 'done')  return !!m.meter_layout?.meters?.length
    return true
  })

  return (
    <div className="h-screen bg-bg text-text flex flex-col overflow-hidden">
      <PageHeader module="admin" title="メーターレイアウト設定" hideHome={true}
        rightSlot={<span className="text-sm text-muted">{filtered.length}/{models.length}機種</span>} />

      <div className="flex flex-1 overflow-hidden">
        {/* 左: 一覧 */}
        <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex border-b border-border shrink-0">
            {[['all','全て'],['blank','未入力'],['done','入力済']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`flex-1 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  filter === v ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && <p className="text-sm text-muted p-3">読み込み中...</p>}
            {filtered.map(m => (
              <button key={m.model_id} onClick={() => selectModel(m)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-border/40 transition-colors hover:bg-surface ${
                  selectedId === m.model_id ? 'bg-surface2 text-accent' : ''
                }`}>
                <div className="font-medium truncate">{m.model_name}</div>
                <div className="text-muted text-xs mt-0.5">
                  {m.meter_layout?.meters?.length ? `${m.meter_layout.meters.length}メーター入力済` : '未入力'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 右: 編集パネル */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">左から機種を選択</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl">
            <div>
              <p className="text-xs text-muted mb-1">機種名</p>
              <p className="font-bold text-base">{selected.model_name}</p>
            </div>

            <div>
              <p className="text-xs text-muted mb-1">メーカー</p>
              <input value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                placeholder="例: バンダイナムコ"
                className={baseInp + ' w-full max-w-xs'} />
            </div>

            {selected.image_url && (
              <div>
                <p className="text-xs text-muted mb-1">機械写真</p>
                <img src={selected.image_url} alt={selected.model_name}
                  className="h-28 rounded border border-border object-contain bg-surface" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-muted font-medium">メーター設定</p>
                <button onClick={() => setMeters(p => [...p, newMeter()])}
                  className="text-xs text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent/10">
                  + 追加
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {meters.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 bg-surface rounded p-2 border border-border">
                    <select value={m.key} onChange={e => setMeterField(i, 'key', e.target.value)}
                      className={baseSel + ' w-32'}>
                      {METER_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input value={m.label} onChange={e => setMeterField(i, 'label', e.target.value)}
                      placeholder={KEY_LABELS[m.key] || m.key}
                      className={baseInp + ' w-24'} />
                    <select value={m.purpose} onChange={e => setMeterField(i, 'purpose', e.target.value)}
                      className={baseSel + ' w-24'}>
                      {PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}
                    </select>
                    {m.purpose === 'revenue' && (
                      <input type="number" inputMode="decimal" value={m.unit_price}
                        onChange={e => setMeterField(i, 'unit_price', e.target.value)}
                        placeholder="単価"
                        className={baseInp + ' w-20'} />
                    )}
                    <label className="flex items-center gap-1 text-sm text-muted cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={Boolean(m.active)}
                        onChange={e => setMeterField(i, 'active', e.target.checked)} />
                      有効
                    </label>
                    <button onClick={() => setMeters(p => p.filter((_, j) => j !== i))}
                      className="ml-auto text-accent2 text-sm hover:opacity-70 leading-none">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-1">
                売上計算式
                <span className="ml-1 text-xs text-muted/70">(空欄 = 自動: {autoFormula(meters) || '—'})</span>
              </p>
              <input value={formula} onChange={e => setFormula(e.target.value)}
                placeholder={autoFormula(meters) || '例: in × 100円'}
                className={baseInp + ' w-full'} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={save} disabled={saving}
                style={saving ? {} : { background: '#f0c040', color: '#000' }}
                className={`px-5 py-1.5 rounded text-sm font-bold transition-opacity ${saving ? 'bg-border text-muted cursor-not-allowed' : 'hover:opacity-90'}`}>
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg.startsWith('保存しました') ? 'text-accent3' : 'text-accent2'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
