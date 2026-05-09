import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField, { NumpadFooterPanel } from '../components/NumpadField'
import Tooltip from '../components/Tooltip'
import PrizeNameAutocomplete from '../components/PrizeNameAutocomplete'
import BoothHistoryList from '../components/BoothHistoryList'
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
  prize_cost:   '景品 1個あたりの仕入れ価格(円)。景品マスタ選択で自動入る。',
  set_a:        'クレーン爪の力。数値で記録。',
  set_c:        'コア設定。数値で記録。',
  set_l:        '左側設定。数値で記録。',
  set_r:        '右側設定。数値で記録。',
  set_o:        '自由メモ。何でも書いてOK、書かなくてもOK。',
  collection:   '集金日のみ表示。チェックすると集金記録として保存される。',
  diff:         '前回保存値からの差分。上段=IN差分(集金額相当)、下段=OUT差分(出回数)。打ち間違い検知用。',
}

function diffDisplay(diff) {
  if (diff === null) return { text: '--', cls: 'text-gray-400' }
  if (diff === 0)    return { text: '0',  cls: 'text-gray-400' }
  if (diff > 0)      return { text: `+${diff}`, cls: 'text-green-600' }
  return               { text: String(diff),  cls: 'text-red-600' }
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-base border font-bold ${b.cls}`}
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
    <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/60 border border-border text-base text-muted">
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
      className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/40 border border-border/80 text-base text-muted"
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

// ─── compact セル (label上 / numpad下) ─────────────────────────
function CompactCell({
  ttId, ttContent, label,
  fieldId, value, onChange, onTouched,
  allowDecimal = false, dataTabindex,
  inputClassName, onNext, testId, inputPlaceholder, onRegister,
  isActive = false, className = '',
}) {
  return (
    <div className={`flex flex-row items-center gap-1 p-1 rounded transition-all duration-200 ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${className}`}>
      <div className={`shrink-0 ${isActive ? '[&_button]:text-blue-600' : ''}`}>
        <Tooltip id={ttId} content={ttContent} label={label} />
      </div>
      <div className="flex-1 min-w-0">
        <NumpadField
          id={fieldId}
          value={value}
          onChange={v => { onTouched?.(); onChange(v) }}
          label={label}
          allowDecimal={allowDecimal}
          dataTabindex={dataTabindex}
          inputClassName={isActive ? '' : (inputClassName ?? '')}
          onNext={onNext}
          testId={testId ?? fieldId}
          inputPlaceholder={inputPlaceholder}
          style={{ fontSize: 16, width: '100%' }}
          onRegister={onRegister}
          isActive={isActive}
        />
      </div>
    </div>
  )
}

// ─── compact テキストセル (label上 / テキスト入力下) ─────────────
function CompactTextCell({
  ttId, ttContent, label,
  fieldId, value, onChange, placeholder,
  testId, dataTabindex, inputClassName, onNext,
  isActive = false, className = '',
}) {
  return (
    <div className={`flex flex-col p-1 rounded transition-all duration-200 ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${className}`}>
      <div className={isActive ? '[&_button]:text-blue-600' : ''}>
        <Tooltip id={ttId} content={ttContent} label={label} />
      </div>
      <input
        id={fieldId}
        type="text"
        inputMode="text"
        data-testid={testId}
        data-tabindex={dataTabindex}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onNext?.() } }}
        placeholder={placeholder}
        className={isActive ? '' : (inputClassName ?? 'text-text')}
        style={{
          cursor: 'text',
          border: isActive ? '1px solid #3b82f6' : '1px solid #2a2a44',
          background: isActive ? '#eff6ff' : '#0a0a14',
          borderRadius: 4,
          padding: '0.4em 0.35em',
          fontFamily: "'Courier New', Courier, monospace",
          fontWeight: 'bold',
          textAlign: 'right',
          outline: 'none',
          boxSizing: 'border-box',
          WebkitAppearance: 'none',
          fontSize: 16,
          width: '100%',
          ...(isActive ? { color: '#1e3a5f' } : {}),
        }}
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
  const { navigateNext, currentField, registerField } = useFieldNavigation()
  const activeTabindex = currentField?.dataTabindex ?? null

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
    } catch {
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

  const inDiff = touched.inMeter && prev != null && inMeter !== ''
    ? Number(inMeter) - Number(prev.in_meter ?? 0)
    : null
  const outDiff = touched.outMeter1 && prev != null && outMeter1 !== ''
    ? Number(outMeter1) - Number(prev.out_meter ?? 0)
    : null
  const inDiffDisp  = diffDisplay(inDiff)
  const outDiffDisp = diffDisplay(outDiff)

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={boothLabel}
        variant="compact"
        onBack={() => navigate(-1)}
      />

      <div className="px-4 flex items-center gap-2">
        <EntryTypeBadge type={entryType} />
      </div>
      <PrevReadingRow prev={prev} />
      <TheoryRow prev={prev} />

      <div data-testid="booth-input-upper" className="flex-1 overflow-y-auto pb-[300px]">
        <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">

          {/* Row 1: IN + OUT(s) + 差 + 残 + 補 — flex比率 IN5/OUT5/差3/残4/補2 */}
          <div data-testid="meter-row" className="flex gap-1 p-1 border-b border-border">
            <CompactCell
              className="flex-[3] min-w-0"
              ttId="tt-field-in-meter" ttContent={TT.in_meter} label="IN"
              fieldId="field-in-meter" value={inMeter} onChange={setIn} onTouched={touch('inMeter')}
              allowDecimal dataTabindex={1}
              inputClassName={!touched.inMeter ? 'text-gray-400' : ''}
              onNext={() => navigateNext(1)}
              onRegister={registerField}
              isActive={activeTabindex === 1}
            />
            {outMeterCount === 1 ? (
              <CompactCell
                className="flex-[3] min-w-0"
                ttId="tt-field-out-meter" ttContent={TT.out_meter} label="OUT"
                fieldId="field-out-meter" value={outMeter1} onChange={setOut1} onTouched={touch('outMeter1')}
                allowDecimal dataTabindex={2}
                inputClassName={!touched.outMeter1 ? 'text-gray-400' : ''}
                onNext={() => navigateNext(2)}
                onRegister={registerField}
                isActive={activeTabindex === 2}
              />
            ) : (
              outFields.map((f, i) => (
                <CompactCell
                  key={f.id}
                  className="flex-[3] min-w-0"
                  ttId={`tt-${f.id}`} ttContent={TT.out_meter} label={`OUT${i + 1}`}
                  fieldId={f.id} value={f.val} onChange={f.set} onTouched={touch(f.key)}
                  allowDecimal dataTabindex={f.tab}
                  inputClassName={!touched[f.key] ? 'text-gray-400' : ''}
                  onNext={() => navigateNext(f.tab)}
                  onRegister={registerField}
                  isActive={activeTabindex === f.tab}
                />
              ))
            )}
            {/* 差 cell — IN差分(上) / OUT差分(下) */}
            <div className="flex flex-row items-center gap-1 p-1 flex-[2] min-w-0">
              <div className="shrink-0"><Tooltip id="tt-field-diff" content={TT.diff} label="差" /></div>
              <div
                data-testid="diff-cell"
                className="flex flex-col items-end justify-center flex-1 min-h-[2rem]"
              >
                <div data-testid="in-diff"  className={`font-mono text-xs font-bold ${inDiffDisp.cls}`}>{inDiffDisp.text}</div>
                <div data-testid="out-diff" className={`font-mono text-xs font-bold ${outDiffDisp.cls}`}>{outDiffDisp.text}</div>
              </div>
            </div>

            <CompactCell
              className="flex-[3] min-w-0"
              ttId="tt-field-stock" ttContent={TT.prize_stock} label="残"
              fieldId="field-stock" value={stock} onChange={setStk} onTouched={touch('stock')}
              dataTabindex={5}
              inputClassName={!touched.stock ? 'text-gray-400' : ''}
              onNext={() => navigateNext(5)}
              onRegister={registerField}
              isActive={activeTabindex === 5}
            />
            <CompactCell
              className="flex-[2] min-w-0"
              ttId="tt-field-restock" ttContent={TT.prize_restock} label="補"
              fieldId="field-restock" value={restock} onChange={setRst} onTouched={touch('restock')}
              dataTabindex={6}
              inputClassName={!touched.restock ? 'text-gray-400' : ''}
              onNext={() => navigateNext(6)}
              onRegister={registerField}
              isActive={activeTabindex === 6}
            />
          </div>

          {/* Row 2: 景 + @ */}
          <div className="flex gap-1 p-1 border-b border-border">
            <div className="flex-[4] min-w-0 flex flex-row items-center gap-1 p-1">
              <div className="shrink-0"><Tooltip id="tt-field-prize-name" content={TT.prize_name} label="景" /></div>
              <div className="flex-1 min-w-0">
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
            </div>
            <CompactCell
              className="flex-[1] min-w-0"
              ttId="tt-field-prize-cost" ttContent={TT.prize_cost} label="@"
              fieldId="field-prize-cost" value={prizeCost} onChange={setCost} onTouched={touch('prizeCost')}
              allowDecimal={false} dataTabindex={8}
              testId="field-prize-cost"
              inputPlaceholder=""
              inputClassName={!touched.prizeCost ? 'text-gray-400' : ''}
              onNext={() => navigateNext(8)}
              onRegister={registerField}
              isActive={activeTabindex === 8}
            />
          </div>

          {/* Row 3+4: 設定ACLR + O — single flex row to stay within 07d height budget */}
          <div className="flex gap-1 p-1 border-b border-border">
            {[
              { tab: 9,  id: 'field-set-a', testId: 'field-set-a', label: 'A', val: setA, set: setSetA, touchKey: 'setA'  },
              { tab: 10, id: 'field-set-c', testId: 'field-set-c', label: 'C', val: setC, set: setSetC, touchKey: 'setC'  },
              { tab: 11, id: 'field-set-l', testId: 'field-set-l', label: 'L', val: setL, set: setSetL, touchKey: 'setL'  },
              { tab: 12, id: 'field-set-r', testId: 'field-set-r', label: 'R', val: setR, set: setSetR, touchKey: 'setR'  },
            ].map(f => (
              <div
                key={f.id}
                className={`flex-1 min-w-0 rounded transition-all duration-200${activeTabindex === f.tab ? ' ring-2 ring-blue-500 bg-blue-50' : ''}`}
              >
                <NumpadField
                  id={f.id}
                  value={f.val}
                  onChange={v => { touch(f.touchKey)(); f.set(v) }}
                  label={f.label}
                  dataTabindex={f.tab}
                  testId={f.testId}
                  inputPlaceholder={f.label}
                  inputClassName={!touched[f.touchKey] ? 'text-gray-400' : ''}
                  onNext={() => navigateNext(f.tab)}
                  onRegister={registerField}
                  isActive={activeTabindex === f.tab}
                  style={{ fontSize: 16, width: '100%', padding: '0.1em 0.35em' }}
                />
              </div>
            ))}
            <div className={`flex-[6] min-w-0 rounded transition-all duration-200${activeTabindex === 13 ? ' ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <input
                id="field-set-o"
                type="text"
                inputMode="text"
                data-testid="field-set-o"
                data-tabindex={13}
                value={setO}
                onChange={e => { touch('setO')(); setSetO(e.target.value) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); navigateNext(13) } }}
                placeholder="メモ"
                style={{
                  cursor: 'text',
                  border: activeTabindex === 13 ? '1px solid #3b82f6' : '1px solid #2a2a44',
                  background: activeTabindex === 13 ? '#eff6ff' : '#0a0a14',
                  borderRadius: 4,
                  padding: '0.1em 0.35em',
                  fontFamily: "'Courier New', Courier, monospace",
                  fontWeight: 'bold',
                  textAlign: 'right',
                  outline: 'none',
                  boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  fontSize: 16,
                  width: '100%',
                  ...(activeTabindex === 13 ? { color: '#1e3a5f' } : {}),
                }}
              />
            </div>
          </div>

          {/* 集金 row */}
          {isCollectionDay && (
            <div
              data-testid="collection-checkbox-label"
              className="flex items-center gap-3 p-2 border-b border-border"
            >
              <Tooltip id="tt-collection" content={TT.collection} label="集" />
              <input
                data-testid="collection-checkbox"
                type="checkbox"
                checked={isCollection}
                onChange={e => setIsColl(e.target.checked)}
                className="w-5 h-5 accent-blue-500"
              />
              {isCollection && <span className="text-base text-blue-400">集金記録として保存</span>}
            </div>
          )}

          {/* 保存ボタン */}
          <div className="px-4 py-1">
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

        </div>

        <BoothHistoryList
          boothCode={boothCode}
          meterUnitPrice={machine?.machine_models?.meter_unit_price ?? 100}
          storeCode={storeCode}
          machine={machine}
          booth={booth}
        />
      </div>

      <NumpadFooterPanel currentField={currentField} />
    </div>
  )
}
