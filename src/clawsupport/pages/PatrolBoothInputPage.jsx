import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../components/NumpadField'
import PrizeNameAutocomplete from '../components/PrizeNameAutocomplete'
import {
  savePatrolReading,
  getLastReadingForBooth,
  classifyEntryType,
} from '../../services/patrolCore'

// ─── entry_type バッジ ─────────────────────────────────
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

// ─── 前回値行 ──────────────────────────────────────────
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

/** 前回レコードの理論値・出率（参照のみ） */
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

// ─── 数値フィールド行 ───────────────────────────────────
function FieldRow({ label, fieldId, value, onChange, allowDecimal = false }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <label htmlFor={fieldId} className="w-28 shrink-0 text-sm text-muted font-bold">
        {label}
      </label>
      <div className="flex-1 flex justify-end">
        <NumpadField
          id={fieldId}
          value={value}
          onChange={onChange}
          label={label}
          allowDecimal={allowDecimal}
          style={{ width: 120, fontSize: 18 }}
        />
      </div>
    </div>
  )
}

// ─── テキスト入力フィールド行（景品名・設定値・原価） ──────────
function TextFieldRow({ label, fieldId, value, onChange, placeholder, testId }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <label htmlFor={fieldId} className="w-28 shrink-0 text-sm text-muted font-bold">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="text"
        data-testid={testId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-right text-sm text-text outline-none placeholder:text-gray-500"
        style={{ WebkitAppearance: 'none' }}
      />
    </div>
  )
}

// ─── メインコンポーネント ────────────────────────────────
const EMPTY_TOUCHED = {
  prizeName: false,
  prizeCost: false,
  setA: false,
  setC: false,
  setL: false,
  setR: false,
  setO: false,
}

export default function PatrolBoothInputPage() {
  const { boothCode } = useParams()
  const { state }    = useLocation()
  const navigate     = useNavigate()
  const { staffId }  = useAuth()
  const { enabled: patrolEnabled } = useFeatureFlag('patrol_core')

  const { machine, booth, storeCode } = state ?? {}
  const resolvedStoreCode = storeCode ?? machine?.store_code ?? null

  const [prev,           setPrev]   = useState(null)
  const [inMeter,        setIn]     = useState('')
  const [outMeter,       setOut]    = useState('')
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

  useEffect(() => {
    getLastReadingForBooth(boothCode).then(setPrev)
  }, [boothCode])

  useEffect(() => {
    setTouched({ ...EMPTY_TOUCHED })
  }, [boothCode])

  useEffect(() => {
    if (!prev) return
    setIn(prev.in_meter != null ? String(prev.in_meter) : '')
    setOut(prev.out_meter != null ? String(prev.out_meter) : '')
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
    if (!resolvedStoreCode) {
      setIsCollectionDay(false)
      return
    }
    let cancel = false
    supabase
      .from('stores')
      .select('is_collection_day')
      .eq('store_code', resolvedStoreCode)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setIsCollectionDay(!!data?.is_collection_day)
      })
    return () => { cancel = true }
  }, [resolvedStoreCode])

  useEffect(() => {
    if (!isCollectionDay) setIsColl(false)
  }, [isCollectionDay])

  const recordAsCollection = isCollectionDay && isCollection

  const entryType = useMemo(
    () => classifyEntryType({
      prev,
      next: {
        inMeter,
        outMeter,
        prizeName,
        setA,
        setC,
        setL,
        setR,
        setO,
      },
      isCollection: recordAsCollection,
    }),
    [prev, inMeter, outMeter, prizeName, setA, setC, setL, setR, setO, recordAsCollection],
  )

  const canSave = inMeter !== '' && outMeter !== '' && stock !== ''

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
        outMeter,
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

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="clawsupport"
        title={boothLabel}
        variant="compact"
        onBack={() => navigate(-1)}
      />

      {/* entry_type バッジ + 前回値 */}
      <div className="px-4 pb-1 flex items-center gap-2">
        <EntryTypeBadge type={entryType} />
      </div>
      <PrevReadingRow prev={prev} />
      <TheoryRow prev={prev} />

      {/* 入力フォーム */}
      <div data-testid="booth-input-upper" className="flex-1 overflow-y-auto pb-[33vh]">
        <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">
          {/* 4必須値（業務動線: IN → OUT → 在庫 → 補充） */}
          <FieldRow label="INメーター"  fieldId="field-in-meter"  value={inMeter}  onChange={setIn}  allowDecimal />
          <FieldRow label="OUTメーター" fieldId="field-out-meter" value={outMeter} onChange={setOut} allowDecimal />
          <FieldRow label="景品在庫"    fieldId="field-stock"     value={stock}    onChange={setStk} />
          <FieldRow label="補充数"      fieldId="field-restock"   value={restock}  onChange={setRst} />

          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <label htmlFor="field-prize-name" className="w-28 shrink-0 text-sm text-muted font-bold">
              景品名
            </label>
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
          <TextFieldRow
            label="原価"
            fieldId="field-prize-cost"
            testId="field-prize-cost"
            value={prizeCost}
            onChange={v => { setTouched(t => ({ ...t, prizeCost: true })); setCost(v) }}
            placeholder="円"
          />
          <TextFieldRow
            label="設定A"
            fieldId="field-set-a"
            testId="field-set-a"
            value={setA}
            onChange={v => { setTouched(t => ({ ...t, setA: true })); setSetA(v) }}
            placeholder="クレーン爪"
          />
          <TextFieldRow
            label="設定C"
            fieldId="field-set-c"
            testId="field-set-c"
            value={setC}
            onChange={v => { setTouched(t => ({ ...t, setC: true })); setSetC(v) }}
            placeholder="コア"
          />
          <TextFieldRow
            label="設定L"
            fieldId="field-set-l"
            testId="field-set-l"
            value={setL}
            onChange={v => { setTouched(t => ({ ...t, setL: true })); setSetL(v) }}
            placeholder="左"
          />
          <TextFieldRow
            label="設定R"
            fieldId="field-set-r"
            testId="field-set-r"
            value={setR}
            onChange={v => { setTouched(t => ({ ...t, setR: true })); setSetR(v) }}
            placeholder="右"
          />
          <TextFieldRow
            label="設定O"
            fieldId="field-set-o"
            testId="field-set-o"
            value={setO}
            onChange={v => { setTouched(t => ({ ...t, setO: true })); setSetO(v) }}
            placeholder="その他"
          />
        </div>

        {/* 集金（stores.is_collection_day のときのみ） */}
        {isCollectionDay && (
          <label
            data-testid="collection-checkbox-label"
            className="flex items-center gap-3 mx-4 mt-3 px-4 py-3 rounded-2xl bg-surface/30 border border-border cursor-pointer"
          >
            <input
              data-testid="collection-checkbox"
              type="checkbox"
              checked={isCollection}
              onChange={e => setIsColl(e.target.checked)}
              className="w-5 h-5 accent-blue-500"
            />
            <span className="text-sm text-text font-bold">集金あり</span>
            {isCollection && <span className="text-xs text-blue-400 ml-1">集金記録として保存</span>}
          </label>
        )}

        {/* 保存ボタン */}
        <div className="px-4 pt-4 pb-8">
          <button
            data-testid="save-button"
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
    </div>
  )
}
