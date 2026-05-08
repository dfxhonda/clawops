import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../components/NumpadField'
import Tooltip from '../components/Tooltip'
import PrizeNameAutocomplete from '../components/PrizeNameAutocomplete'
import { useFieldNavigation } from '../hooks/useFieldNavigation'
import {
  savePatrolReading,
  getLastReadingForBooth,
  classifyEntryType,
} from '../../services/patrolCore'

// ─── tooltip texts ────────────────────────────────────────
const TT = {
  in_meter:     '機械正面のINメーター数値、左から大きい桁。集金時に必ず読む。',
  out_meter:    '機械正面のOUTメーター数値。景品が落ちた回数の累計。',
  prize_stock:  'ブース内に残ってる景品の個数。今数えた数。',
  prize_restock:'今回追加で入れた景品の個数。0なら空欄でOK。',
  prize_name:   '景品マスタから候補が出る。新景品は手入力で追加。',
  prize_cost:   '1個あたりの仕入れ価格(円)。景品マスタ選択で自動入る。',
  set_a:        'クレーン爪の力。数値で記録。',
  set_c:        'コア設定。数値で記録。',
  set_l:        '左側設定。数値で記録。',
  set_r:        '右側設定。数値で記録。',
  set_o:        '自由メモ。何でも書いてOK、書かなくてもOK。',
  collection:   '集金日のみ表示。チェックすると集金記録として保存される。',
}

// ─── entry_type バッジ ─────────────────────────────────────
const ENTRY_BADGES = {
  patrol:     { label: '通常巡回',      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' },
  replace:    { label: '入替/設定変更', cls: 'bg-amber-500/20 text-amber-400 border-amber-400/30' },
  collection: { label: '集金',          cls: 'bg-blue-500/20 text-blue-400 border-blue-400/30' },
}

function EntryTypeBadge({ type }) {
  const b = ENTRY_BADGES[type] ?? ENTRY_BADGES.patrol
  return (
    <span
      data-testid="entry-type-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-bold ${b.cls}`}
    >
      {b.label}
    </span>
  )
}

// ─── 前回値行 ────────────────────────────────────────────────
function PrevReadingRow({ prev }) {
  if (!prev) return null
  const date = prev.patrol_date ?? prev.read_time?.slice(0, 10) ?? '—'
  return (
    <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/60 border border-border text-xs text-muted">
      <span className="font-bold mr-2">前回</span>
      <span>{date}</span>
      <span className="mx-2">|</span>
      <span>IN {prev.in_meter ?? '—'}</span>
      <span className="mx-1">/</span>
      <span>OUT {prev.out_meter ?? '—'}</span>
      <span className="mx-2">|</span>
      <span>在庫 {prev.prize_stock_count ?? '—'}</span>
      <span className="mx-1">補充 {prev.prize_restock_count ?? '—'}</span>
      {prev.prize_name && <><span className="mx-2">|</span><span>{prev.prize_name}</span></>}
    </div>
  )
}

function TheoryRow({ prev }) {
  if (!prev) return null
  const payout = prev.payout_rate
  const payoutLabel =
    payout == null || payout === ''
      ? '—'
      : Number(payout) <= 1 && Number(payout) > 0
        ? `${(Number(payout) * 100).toFixed(1)}%`
        : `${payout}%`
  return (
    <div
      data-testid="theory-row"
      className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/40 border border-border/80 text-xs text-muted"
    >
      <span className="font-bold text-text/90 mr-2">理論・出率（前回記録）</span>
      <span>出率 {payoutLabel}</span>
      <span className="mx-2">|</span>
      <span data-testid="theoretical-stock-label">
        理論在庫 {prev.theoretical_stock != null ? prev.theoretical_stock : '—'}
      </span>
    </div>
  )
}

// ─── フィールド行（full-width / compact grid 兼用） ─────────────
function FieldRow({
  label, fieldId, value, onChange, onTouched,
  allowDecimal = false, compact = false,
  dataTabindex, inputClassName, onNext, tooltip,
  testId, inputPlaceholder,
}) {
  const numpad = (
    <NumpadField
      id={fieldId}
      value={value}
      onChange={v => { onTouched?.(); onChange(v) }}
      label={label}
      allowDecimal={allowDecimal}
      dataTabindex={dataTabindex}
      inputClassName={inputClassName}
      onNext={onNext}
      testId={testId ?? fieldId}
      inputPlaceholder={inputPlaceholder}
      style={compact ? { fontSize: 16, width: '100%' } : { width: 120, fontSize: 16 }}
    />
  )

  if (compact) {
    return (
      <div className="flex flex-col px-3 py-2 border-b border-border last:border-b-0">
        <div className="flex items-center gap-1 mb-1">
          <label htmlFor={fieldId} className="text-[11px] text-muted font-bold">{label}</label>
          {tooltip && <Tooltip id={`tt-${fieldId}`} content={tooltip} />}
        </div>
        {numpad}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1 w-28 shrink-0">
        <label htmlFor={fieldId} className="text-sm text-muted font-bold">{label}</label>
        {tooltip && <Tooltip id={`tt-${fieldId}`} content={tooltip} />}
      </div>
      <div className="flex-1 flex justify-end">
        {numpad}
      </div>
    </div>
  )
}

// ─── テキスト入力フィールド行 ───────────────────────────────────
function TextFieldRow({ label, fieldId, value, onChange, placeholder, testId, dataTabindex, inputClassName, onNext, tooltip }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1 w-28 shrink-0">
        <label htmlFor={fieldId} className="text-sm text-muted font-bold">{label}</label>
        {tooltip && <Tooltip id={`tt-${fieldId}`} content={tooltip} />}
      </div>
      <input
        id={fieldId}
        type="text"
        inputMode="text"
        data-testid={testId}
        data-tabindex={dataTabindex}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onNext?.() } }}
        placeholder={placeholder}
        className={`flex-1 bg-transparent text-right text-base outline-none placeholder:text-gray-500 ${inputClassName ?? 'text-text'}`}
        style={{ WebkitAppearance: 'none', fontSize: 16 }}
      />
    </div>
  )
}

// ─── touched 初期値 ────────────────────────────────────────────
const EMPTY_TOUCHED = {
  inMeter: false, outMeter1: false, outMeter2: false, outMeter3: false,
  stock: false, restock: false,
  prizeName: false, prizeCost: false,
  setA: false, setC: false, setL: false, setR: false, setO: false,
}

// ─── メインコンポーネント ───────────────────────────────────────
export default function PatrolBoothInputPage() {
  const { boothCode } = useParams()
  const { state }    = useLocation()
  const navigate     = useNavigate()
  const { staffId }  = useAuth()
  const { enabled: patrolEnabled } = useFeatureFlag('patrol_core')
  const { navigateNext } = useFieldNavigation()

  const { machine, booth, storeCode } = state ?? {}
  const resolvedStoreCode = storeCode ?? machine?.store_code ?? null
  const outMeterCount = machine?.machine_models?.out_meter_count ?? 1

  const [prev,           setPrev]   = useState(null)
  const [inMeter,        setIn]     = useState('')
  const [outMeter1,      setOut1]   = useState('')
  const [outMeter2,      setOut2]   = useState('')
  const [outMeter3,      setOut3]   = useState('')
  const [stock,          setStk]    = useState('')
  const [restock,        setRst]    = useState('')
  const [prizeName,      setPrize]  = useState('')
  const [prizeCost,      setCost]   = useState('')
  const [setA,           setSetA]   = useState('')
  const [setC,           setSetC]   = useState('')
  const [setL,           setSetL]   = useState('')
  const [setR,           setSetR]   = useState('')
  const [setO,           setSetO]   = useState('')
  const [touched,        setTouched] = useState(() => ({ ...EMPTY_TOUCHED }))
  const [selectedPrizeId, setSelectedPrizeId] = useState(null)
  const [isCollectionDay, setIsCollectionDay] = useState(false)
  const [isCollection,   setIsColl] = useState(false)
  const [saving,         setSaving] = useState(false)
  const [result,         setResult] = useState(null)

  const touch = key => () => setTouched(t => ({ ...t, [key]: true }))

  useEffect(() => {
    getLastReadingForBooth(boothCode).then(setPrev)
  }, [boothCode])

  useEffect(() => {
    setTouched({ ...EMPTY_TOUCHED })
  }, [boothCode])

  useEffect(() => {
    if (!prev) return
    setIn(prev.in_meter != null ? String(prev.in_meter) : '')
    setOut1(prev.out_meter != null ? String(prev.out_meter) : '')
    setOut2(prev.out_meter_2 != null ? String(prev.out_meter_2) : '')
    setOut3(prev.out_meter_3 != null ? String(prev.out_meter_3) : '')
    setStk(prev.prize_stock_count != null ? String(prev.prize_stock_count) : '')
    setRst(prev.prize_restock_count != null ? String(prev.prize_restock_count) : '')
    setPrize(prev.prize_name ?? '')
    const pc = prev.prize_cost ?? prev.prize_cost_1
    setCost(pc != null && pc !== '' ? String(pc) : '')
    setSetA(prev.set_a ?? '')
    setSetC(prev.set_c ?? '')
    setSetL(prev.set_l ?? '')
    setSetR(prev.set_r ?? '')
    setSetO(prev.set_o ?? '')
    setSelectedPrizeId(null)
  }, [prev?.reading_id, boothCode])

  useEffect(() => {
    if (!resolvedStoreCode) { setIsCollectionDay(false); return }
    let cancel = false
    supabase
      .from('stores')
      .select('is_collection_day')
      .eq('store_code', resolvedStoreCode)
      .maybeSingle()
      .then(({ data }) => { if (!cancel) setIsCollectionDay(!!data?.is_collection_day) })
    return () => { cancel = true }
  }, [resolvedStoreCode])

  useEffect(() => {
    if (!isCollectionDay) setIsColl(false)
  }, [isCollectionDay])

  // feature 4: theoretical stock autofill
  useEffect(() => {
    if (touched.stock || !prev || outMeter1 === '') return
    const out_diff = Number(outMeter1) - Number(prev.out_meter ?? 0)
    const theoretical = (prev.prize_stock_count ?? 0) + (prev.prize_restock_count ?? 0) - out_diff
    if (theoretical >= 0) setStk(String(theoretical))
  }, [outMeter1, prev, touched.stock])

  const recordAsCollection = isCollectionDay && isCollection

  const entryType = useMemo(
    () => classifyEntryType({
      prev,
      next: { inMeter, outMeter: outMeter1, prizeName, setA, setC, setL, setR, setO },
      isCollection: recordAsCollection,
    }),
    [prev, inMeter, outMeter1, prizeName, setA, setC, setL, setR, setO, recordAsCollection],
  )

  const canSave = inMeter !== '' && outMeter1 !== '' && stock !== ''

  function buildOptionalPatch() {
    const patch = {}
    if (touched.prizeName) patch.prize_name = prizeName.trim() || null
    if (touched.prizeName && selectedPrizeId != null) patch.prize_id = selectedPrizeId
    if (touched.prizeCost) {
      const t = prizeCost.trim()
      if (t === '') patch.prize_cost = null
      else {
        const n = parseInt(t, 10)
        patch.prize_cost = Number.isFinite(n) ? n : null
      }
    }
    if (touched.setA) patch.set_a = setA.trim() || null
    if (touched.setC) patch.set_c = setC.trim() || null
    if (touched.setL) patch.set_l = setL.trim() || null
    if (touched.setR) patch.set_r = setR.trim() || null
    if (touched.setO) patch.set_o = setO.trim() || null
    if (touched.outMeter2) patch.out_meter_2 = outMeter2 !== '' ? parseFloat(outMeter2) : null
    if (touched.outMeter3) patch.out_meter_3 = outMeter3 !== '' ? parseFloat(outMeter3) : null
    return patch
  }

  async function handleSave() {
    if (!patrolEnabled) {
      alert('patrol_core フラグが無効です。管理者に連絡してください。')
      return
    }
    if (!canSave) return
    setSaving(true)
    try {
      const res = await savePatrolReading({
        boothCode,
        storeCode:   storeCode ?? machine?.store_code,
        machineCode: machine?.machine_code,
        inMeter,
        outMeter:     outMeter1,
        prizeStock:   stock,
        prizeRestock: restock,
        entryType,
        staffId,
        optionalPatch: buildOptionalPatch(),
        defaultsFromPrev: prev,
      })
      if (res.skipped) {
        setResult('skipped')
        setTimeout(() => navigate(-1), 1000)
      } else {
        setResult('saved')
        setTimeout(() => navigate(-1), 800)
      }
    } catch (e) {
      console.error(e)
      setResult('error')
    } finally {
      setSaving(false)
    }
  }

  const boothLabel = booth
    ? `${machine?.machine_name ?? ''} ブース ${booth.booth_number}`
    : boothCode

  // OUT fields config
  const outFields = [
    { key: 'outMeter1', val: outMeter1, set: setOut1, tab: 2, id: 'field-out-meter' },
    { key: 'outMeter2', val: outMeter2, set: setOut2, tab: 3, id: 'field-out-meter-2' },
    { key: 'outMeter3', val: outMeter3, set: setOut3, tab: 4, id: 'field-out-meter-3' },
  ].slice(0, outMeterCount)

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={boothLabel}
        variant="compact"
        onBack={() => navigate(-1)}
      />

      <div className="px-4 pb-1 flex items-center gap-2">
        <EntryTypeBadge type={entryType} />
      </div>
      <PrevReadingRow prev={prev} />
      <TheoryRow prev={prev} />

      <div data-testid="booth-input-upper" className="flex-1 overflow-y-auto pb-[33vh]">
        <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">

          {/* IN — full width */}
          <FieldRow
            label="INメーター" fieldId="field-in-meter"
            value={inMeter} onChange={setIn} onTouched={touch('inMeter')}
            allowDecimal dataTabindex={1}
            inputClassName={!touched.inMeter ? 'text-gray-400' : ''}
            onNext={() => navigateNext(1)} tooltip={TT.in_meter}
          />

          {/* OUT fields */}
          {outMeterCount === 1 ? (
            <FieldRow
              label="OUTメーター" fieldId="field-out-meter"
              value={outMeter1} onChange={setOut1} onTouched={touch('outMeter1')}
              allowDecimal dataTabindex={2}
              inputClassName={!touched.outMeter1 ? 'text-gray-400' : ''}
              onNext={() => navigateNext(2)} tooltip={TT.out_meter}
            />
          ) : (
            <div className="grid grid-cols-2 divide-x divide-border">
              {outFields.map((f, i) => (
                <FieldRow
                  key={f.id}
                  label={`OUT${i + 1}`} fieldId={f.id} compact
                  value={f.val} onChange={f.set} onTouched={touch(f.key)}
                  allowDecimal dataTabindex={f.tab}
                  inputClassName={!touched[f.key] ? 'text-gray-400' : ''}
                  onNext={() => navigateNext(f.tab)} tooltip={TT.out_meter}
                />
              ))}
            </div>
          )}

          {/* 在庫 + 補充 — grid-cols-2 */}
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <FieldRow
              label="景品在庫" fieldId="field-stock" compact
              value={stock} onChange={setStk} onTouched={touch('stock')}
              dataTabindex={5}
              inputClassName={!touched.stock ? 'text-gray-400' : ''}
              onNext={() => navigateNext(5)} tooltip={TT.prize_stock}
            />
            <FieldRow
              label="補充数" fieldId="field-restock" compact
              value={restock} onChange={setRst} onTouched={touch('restock')}
              dataTabindex={6}
              inputClassName={!touched.restock ? 'text-gray-400' : ''}
              onNext={() => navigateNext(6)} tooltip={TT.prize_restock}
            />
          </div>

          {/* 集金 */}
          {isCollectionDay && (
            <label
              data-testid="collection-checkbox-label"
              className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer"
            >
              <input
                data-testid="collection-checkbox"
                type="checkbox"
                checked={isCollection}
                onChange={e => setIsColl(e.target.checked)}
                className="w-5 h-5 accent-blue-500"
              />
              <span className="text-sm text-text font-bold flex items-center gap-2">
                集金あり
                <Tooltip id="tt-collection" content={TT.collection} />
              </span>
              {isCollection && <span className="text-xs text-blue-400 ml-1">集金記録として保存</span>}
            </label>
          )}

          {/* 保存ボタン — 上半分に固定 */}
          <div className="px-4 py-3 border-b border-border">
            <button
              data-testid="save-button"
              data-tabindex={14}
              onClick={handleSave}
              disabled={!canSave || saving}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
                canSave && !saving
                  ? 'bg-accent text-bg active:scale-[0.98]'
                  : 'bg-surface text-muted opacity-40'
              }`}
            >
              {saving
                ? '保存中...'
                : result === 'saved'
                ? '✓ 保存しました'
                : result === 'skipped'
                ? '変化なし — 戻ります'
                : result === 'error'
                ? 'エラー — 再試行'
                : '保存する'}
            </button>
          </div>

          {/* 景品名 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-1 w-28 shrink-0">
              <label htmlFor="field-prize-name" className="text-sm text-muted font-bold">景品名</label>
              <Tooltip id="tt-field-prize-name" content={TT.prize_name} />
            </div>
            <PrizeNameAutocomplete
              value={prizeName}
              onChange={v => {
                setTouched(t => ({ ...t, prizeName: true }))
                setPrize(v)
                setSelectedPrizeId(null)
              }}
              onSelect={({ prize_id, prize_name, original_cost }) => {
                setPrize(prize_name)
                setSelectedPrizeId(prize_id)
                setCost(original_cost != null ? String(original_cost) : '')
                setTouched(t => ({ ...t, prizeName: true, prizeCost: true }))
              }}
              placeholder="前回値から補完（変更時のみ差分送信）"
              fieldId="field-prize-name"
              testId="field-prize-name"
            />
          </div>

          {/* 原価 */}
          <FieldRow
            label="原価" fieldId="field-prize-cost"
            value={prizeCost} onChange={setCost} onTouched={touch('prizeCost')}
            allowDecimal={false} dataTabindex={8}
            inputClassName={!touched.prizeCost ? 'text-gray-400' : ''}
            onNext={() => navigateNext(8)} tooltip={TT.prize_cost}
          />

          {/* 設定 A/C/L/R — grid-cols-2 */}
          <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
            <FieldRow
              label="設定A" fieldId="field-set-a" compact
              value={setA} onChange={setSetA} onTouched={touch('setA')}
              dataTabindex={9}
              inputClassName={!touched.setA ? 'text-gray-400' : ''}
              onNext={() => navigateNext(9)} tooltip={TT.set_a}
              inputPlaceholder="クレーン爪"
            />
            <FieldRow
              label="設定C" fieldId="field-set-c" compact
              value={setC} onChange={setSetC} onTouched={touch('setC')}
              dataTabindex={10}
              inputClassName={!touched.setC ? 'text-gray-400' : ''}
              onNext={() => navigateNext(10)} tooltip={TT.set_c}
              inputPlaceholder="コア"
            />
            <FieldRow
              label="設定L" fieldId="field-set-l" compact
              value={setL} onChange={setSetL} onTouched={touch('setL')}
              dataTabindex={11}
              inputClassName={!touched.setL ? 'text-gray-400' : ''}
              onNext={() => navigateNext(11)} tooltip={TT.set_l}
              inputPlaceholder="左"
            />
            <FieldRow
              label="設定R" fieldId="field-set-r" compact
              value={setR} onChange={setSetR} onTouched={touch('setR')}
              dataTabindex={12}
              inputClassName={!touched.setR ? 'text-gray-400' : ''}
              onNext={() => navigateNext(12)} tooltip={TT.set_r}
              inputPlaceholder="右"
            />
          </div>

          {/* 設定O — text input */}
          <TextFieldRow
            label="設定O" fieldId="field-set-o" testId="field-set-o"
            value={setO} onChange={v => { setTouched(t => ({ ...t, setO: true })); setSetO(v) }}
            placeholder="その他" dataTabindex={13}
            inputClassName={!touched.setO ? 'text-gray-400' : undefined}
            onNext={() => navigateNext(13)} tooltip={TT.set_o}
          />

        </div>
      </div>
    </div>
  )
}
