// J-CHANGER-01 Phase 2: 両替機専用入力画面
// 3 イベントタブ: 巡回 (patrol) / 集金 (collection) / 監査 (audit_adjustment)
// 機種マスタの changer_denominations jsonb 駆動で IN/OUT を動的描画 (標準型/高額型両対応)
// 機械直結 (booth 層スキップ)、保存先は coin_changer_events

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const EVENT_TABS = [
  { key: 'patrol',            label: '巡回',   color: 'blue',    desc: 'IN/OUT メーター現在値' },
  { key: 'collection',        label: '集金',   color: 'emerald', desc: '全回収 + リセット + 補充' },
  { key: 'audit_adjustment',  label: '監査',   color: 'amber',   desc: '中間の出し入れ・両替交換' },
]

function todayJST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// SPEC-PATROL-CHANGER-HISTORY-DISPLAY-02 C: 単位 '枚' 全削除のため default '' に。
function DenominationInputGrid({ denominations, values, onChange, label, unit = '' }) {
  if (!denominations || denominations.length === 0) {
    return <p className="text-xs text-muted">{label}: 機種マスタに denomination 未設定</p>
  }
  return (
    <div>
      <label className="block text-sm font-bold text-text mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {denominations.map(denom => (
          <div key={denom} className="bg-surface2 border border-border rounded-lg px-3 py-2">
            <div className="text-xs text-muted">¥{denom.toLocaleString()}</div>
            <input
              type="number"
              inputMode="numeric"
              value={values[denom] ?? ''}
              onChange={e => onChange(denom, e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-text text-base font-bold outline-none"
            />
            {unit && <div className="text-[10px] text-muted">{unit}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// SPEC-PATROL-CHANGER-HISTORY-DISPLAY-02 D: IN(¥1000 + ¥500) + OUT(¥100) の 3 カードを
// 横 1 列 grid-cols-3 に並べる。各カード: ¥{denom} IN/OUT ラベル + 入力欄 1 行。
// IN/OUT セクションヘッダーは削除、390px で 3 等分割でもはみ出さない min-w-0 + truncate 設計。
function MeterRowCompact({ inDenoms, inValues, onInChange, outDenoms, outValues, onOutChange, title }) {
  const cards = [
    ...((inDenoms ?? []).map(d => ({ denom: d, kind: 'IN',  values: inValues,  onChange: onInChange }))),
    ...((outDenoms ?? []).map(d => ({ denom: d, kind: 'OUT', values: outValues, onChange: onOutChange }))),
  ]
  if (cards.length === 0) {
    return <p className="text-xs text-muted">機種マスタに denomination 未設定</p>
  }
  return (
    <div>
      {title && <label className="block text-sm font-bold text-text mb-2">{title}</label>}
      <div className="grid grid-cols-3 gap-1.5">
        {cards.map(({ denom, kind, values, onChange }) => (
          <div key={`${kind}-${denom}`} className="bg-surface2 border border-border rounded-lg px-2 py-2 min-w-0">
            <div className="text-[11px] text-muted truncate">
              <span className={kind === 'IN' ? 'text-blue-400' : 'text-emerald-400'}>{kind}</span>{' '}
              ¥{denom.toLocaleString()}
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={values[denom] ?? ''}
              onChange={e => onChange(denom, e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-text text-base font-bold outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ChangerInputPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { machineCode } = useParams()
  const { staffId } = useAuth()

  const storeName = location.state?.storeName
  const storeId   = location.state?.storeId

  const [machine, setMachine]               = useState(null)
  const [denominations, setDenominations]   = useState(null) // {in:[], out:[], withdraw:[], restock:[]}
  const [organizationId, setOrganizationId] = useState(null)
  const [tab, setTab]                       = useState('patrol')
  const [eventDate, setEventDate]           = useState(todayJST())
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [saveMsg, setSaveMsg]               = useState('')
  const [error, setError]                   = useState('')

  // event-type 別フィールド
  const [inReadings, setInReadings]   = useState({})  // {1000: N, 500: M}
  const [outReadings, setOutReadings] = useState({})
  const [withdrawn, setWithdrawn]     = useState({})
  const [meterResetTime, setMeterResetTime] = useState('')
  const [restocked, setRestocked]     = useState({})
  const [restockSource, setRestockSource]   = useState('')
  const [adjType, setAdjType]         = useState('withdrawal')
  const [exchangeIn, setExchangeIn]   = useState({})
  const [exchangeOut, setExchangeOut] = useState({})
  const [note, setNote]               = useState('')

  // 履歴
  const [recentEvents, setRecentEvents] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const { data: m, error: e } = await supabase
          .from('machines')
          .select('machine_code, machine_name, store_code, organization_id, machine_models!model_id(type_id, model_name, changer_denominations)')
          .eq('machine_code', machineCode)
          .single()
        if (e) throw e
        setMachine(m)
        setOrganizationId(m.organization_id)
        const model = Array.isArray(m.machine_models) ? m.machine_models[0] : m.machine_models
        if (model?.type_id !== 'changer') {
          setError(`この機械は両替機ではありません (type_id=${model?.type_id ?? '未設定'})`)
        }
        setDenominations(model?.changer_denominations ?? null)

        // SPEC-PATROL-CHANGER-HISTORY-DISPLAY-02 A: LIMIT 10 → 11。
        // 11 件目は最古表示行 (rows[9]) の '前回値' として diff 計算のみに使用、表示は slice(0,10)。
        const { data: evs } = await supabase
          .from('coin_changer_events')
          .select('event_id, event_type, event_date, in_meter_readings, out_meter_readings, withdrawn_cash, restocked, adjustment_type, exchanged_in, exchanged_out, note, created_at, created_by')
          .eq('machine_code', machineCode)
          .order('created_at', { ascending: false })
          .limit(11)
        setRecentEvents(evs ?? [])
      } catch (e) {
        console.error('[ERR-CHANGER-LOAD]', e)
        setError(e.message || '機械情報の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [machineCode])

  function updateDenom(setter) {
    return (denom, value) => setter(prev => ({ ...prev, [denom]: value === '' ? undefined : Number(value) }))
  }

  function cleanJsonb(obj) {
    const out = {}
    for (const k in obj) if (obj[k] != null && !Number.isNaN(obj[k])) out[k] = obj[k]
    return Object.keys(out).length === 0 ? null : out
  }

  const canSave = useMemo(() => {
    if (!organizationId || !machineCode || saving) return false
    if (tab === 'patrol') {
      return cleanJsonb(inReadings) || cleanJsonb(outReadings)
    }
    if (tab === 'collection') {
      return !!cleanJsonb(withdrawn)
    }
    return !!cleanJsonb(exchangeIn) || !!cleanJsonb(exchangeOut)
  }, [tab, inReadings, outReadings, withdrawn, exchangeIn, exchangeOut, organizationId, machineCode, saving])

  async function handleSave() {
    setSaving(true); setSaveMsg(''); setError('')
    try {
      const payload = {
        machine_code: machineCode,
        store_code: machine.store_code,
        event_date: eventDate,
        event_type: tab,
        organization_id: organizationId,
        created_by: staffId ?? null,
        note: note.trim() || null,
      }
      if (tab === 'patrol') {
        payload.in_meter_readings  = cleanJsonb(inReadings)
        payload.out_meter_readings = cleanJsonb(outReadings)
      } else if (tab === 'collection') {
        payload.in_meter_readings  = cleanJsonb(inReadings)
        payload.out_meter_readings = cleanJsonb(outReadings)
        payload.withdrawn_cash     = cleanJsonb(withdrawn)
        payload.meter_reset_at     = meterResetTime ? new Date(`${eventDate}T${meterResetTime}:00+09:00`).toISOString() : null
        payload.restocked          = cleanJsonb(restocked)
        payload.restock_source     = restockSource.trim() || null
      } else if (tab === 'audit_adjustment') {
        payload.adjustment_type = adjType
        payload.exchanged_in    = cleanJsonb(exchangeIn)
        payload.exchanged_out   = cleanJsonb(exchangeOut)
      }
      const { error: e } = await supabase.from('coin_changer_events').insert(payload)
      if (e) throw e
      setSaveMsg(`✅ ${tab === 'patrol' ? '巡回' : tab === 'collection' ? '集金' : '監査'} を記録しました`)
      // 入力リセット
      setInReadings({}); setOutReadings({}); setWithdrawn({}); setRestocked({})
      setExchangeIn({}); setExchangeOut({}); setMeterResetTime(''); setRestockSource(''); setNote('')
      // 履歴再ロード (SPEC-PATROL-CHANGER-HISTORY-DISPLAY-02 A: LIMIT 11、diff 計算用)
      const { data: evs } = await supabase
        .from('coin_changer_events')
        .select('event_id, event_type, event_date, in_meter_readings, out_meter_readings, withdrawn_cash, restocked, adjustment_type, exchanged_in, exchanged_out, note, created_at, created_by')
        .eq('machine_code', machineCode)
        .order('created_at', { ascending: false })
        .limit(11)
      setRecentEvents(evs ?? [])
    } catch (e) {
      console.error('[ERR-CHANGER-SAVE]', e)
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">読み込み中…</div>
  }
  if (!machine) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">{error || '機械が見つかりません'}</div>
  }

  const modelName = Array.isArray(machine.machine_models) ? machine.machine_models[0]?.model_name : machine.machine_models?.model_name

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => storeId ? navigate(`/clawsupport/store/${storeId}`) : navigate('/clawsupport')}
          className="text-2xl text-muted hover:text-accent"
          aria-label="戻る"
        >←</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <h1 className="text-lg font-bold truncate">{machine.machine_name}</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 shrink-0">両替機</span>
          </div>
          <p className="text-xs text-muted">{storeName} / {modelName} / {machineCode}</p>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-border px-4 sticky top-[64px] bg-bg z-20">
        {EVENT_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSaveMsg(''); setError('') }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === t.key
                ? `border-${t.color}-500 text-${t.color}-400`
                : 'border-transparent text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <p className="text-xs text-muted">{EVENT_TABS.find(t => t.key === tab)?.desc}</p>

        {/* 日付 */}
        <div>
          <label className="block text-xs text-muted mb-1">対象日</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full bg-surface border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {/* タブ別フィールド
            SPEC-PATROL-CHANGER-HISTORY-DISPLAY-02 D: patrol/collection の IN+OUT を MeterRowCompact で
            横 1 列 (grid-cols-3) に統合。'IN メーター現在値' / 'OUT メーター現在値' のセクションヘッダー削除、
            各カードの ¥{denom} IN/OUT カラーラベルで識別。390px で 3 等分割しても min-w-0 + truncate で
            はみ出さない設計。 */}
        {tab === 'patrol' && (
          <MeterRowCompact
            inDenoms={denominations?.in ?? []}
            inValues={inReadings}
            onInChange={updateDenom(setInReadings)}
            outDenoms={denominations?.out ?? []}
            outValues={outReadings}
            onOutChange={updateDenom(setOutReadings)}
          />
        )}

        {tab === 'collection' && (
          <>
            <MeterRowCompact
              inDenoms={denominations?.in ?? []}
              inValues={inReadings}
              onInChange={updateDenom(setInReadings)}
              outDenoms={denominations?.out ?? []}
              outValues={outReadings}
              onOutChange={updateDenom(setOutReadings)}
              title="リセット前のメーター値"
            />
            <DenominationInputGrid
              denominations={denominations?.withdraw ?? []}
              values={withdrawn}
              onChange={updateDenom(setWithdrawn)}
              label="全回収金種 (機械内から回収した数)"
            />
            <div>
              <label className="block text-xs text-muted mb-1">メーターリセット時刻 (任意)</label>
              <input
                type="time"
                value={meterResetTime}
                onChange={e => setMeterResetTime(e.target.value)}
                className="w-full bg-surface border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <DenominationInputGrid
              denominations={denominations?.restock ?? []}
              values={restocked}
              onChange={updateDenom(setRestocked)}
              label="補充量 (例: 100円玉 4000)"
            />
            <div>
              <label className="block text-xs text-muted mb-1">補充元 (任意: クレーン由来なら machine_code 等)</label>
              <input
                type="text"
                value={restockSource}
                onChange={e => setRestockSource(e.target.value)}
                placeholder="KOS01-M02,KOS01-M09 等"
                className="w-full bg-surface border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </>
        )}

        {tab === 'audit_adjustment' && (
          <>
            <div>
              <label className="block text-xs text-muted mb-1">監査タイプ</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjType('withdrawal')}
                  className={`py-2 rounded-lg text-sm font-bold ${adjType === 'withdrawal' ? 'bg-amber-600 text-white' : 'bg-surface border border-border text-muted'}`}
                >持ち出し</button>
                <button
                  type="button"
                  onClick={() => setAdjType('exchange')}
                  className={`py-2 rounded-lg text-sm font-bold ${adjType === 'exchange' ? 'bg-amber-600 text-white' : 'bg-surface border border-border text-muted'}`}
                >両替交換</button>
              </div>
              <p className="text-[11px] text-muted mt-1">
                {adjType === 'withdrawal' ? '機械から物理的に取り出した金種・数を記録' : '機械内で千円札→100円玉等の等価交換を記録'}
              </p>
            </div>
            <DenominationInputGrid
              denominations={denominations?.withdraw ?? denominations?.in ?? []}
              values={exchangeIn}
              onChange={updateDenom(setExchangeIn)}
              label="入れた金種・量"
            />
            <DenominationInputGrid
              denominations={denominations?.withdraw ?? denominations?.out ?? []}
              values={exchangeOut}
              onChange={updateDenom(setExchangeOut)}
              label="出した金種・量"
            />
          </>
        )}

        {/* メモ (3 タブ共通) */}
        <div>
          <label className="block text-xs text-muted mb-1">メモ (任意)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="特記事項あれば"
            rows={2}
            className="w-full bg-surface border border-border text-text rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {saveMsg && <p className="text-emerald-400 text-sm">{saveMsg}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="changer-save"
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-base active:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>

        {/* 履歴 (直近10件)
            SPEC-PATROL-CHANGER-HISTORY-DISPLAY-01 + 02:
            - LIMIT 11 fetch、表示 slice(0,10)、最古行 (i=9) の diff も rows[10] を前値として計算 (A)
            - text-xs → text-sm (B、行内全体)
            - min-h-[56px] で行高拡大 + py-3 で余裕確保 (E) */}
        {recentEvents.length > 0 && (() => {
          const getOut100 = (ev) => {
            const r = ev?.out_meter_readings
            if (!r) return null
            const v = r[100] ?? r['100']
            return typeof v === 'number' && Number.isFinite(v) ? v : null
          }
          // 全 11 行で out_100 を計算 → 表示は先頭 10 行のみ (rows[10] は diff prev 用にのみ使用)
          const out100s = recentEvents.map(getOut100)
          const displayed = recentEvents.slice(0, 10)
          return (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-muted mb-2">直近10件</h2>
              <div className="space-y-1.5">
                {displayed.map((ev, i) => {
                  const total = out100s[i]
                  const prev = out100s[i + 1]  // i=9 の場合 out100s[10] = 11 行目の値
                  const diff = (total != null && prev != null) ? total - prev : null
                  const diffText = diff == null
                    ? '-'
                    : (diff >= 0 ? `+${diff}` : `${diff}`)
                  const totalText = total != null ? total : '-'
                  return (
                    <div
                      key={ev.event_id}
                      className="bg-surface border border-border rounded-lg px-3 py-3 text-sm min-h-[56px] flex items-center"
                    >
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${ev.event_type === 'patrol' ? 'text-blue-400' : ev.event_type === 'collection' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {ev.event_type === 'patrol' ? '巡回' : ev.event_type === 'collection' ? '集金' : `監査(${ev.adjustment_type === 'withdrawal' ? '持出' : '交換'})`}
                          </span>
                          <span className="text-muted">{ev.event_date}</span>
                          <span
                            data-testid={`changer-history-out100-${ev.event_id}`}
                            className="text-muted ml-auto font-mono"
                          >
                            差: {diffText} | 累計: {totalText}
                          </span>
                        </div>
                        {ev.note && <p className="text-text/70 mt-0.5 text-xs">{ev.note}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
