import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../components/NumpadField'
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

// ─── テキスト入力フィールド行（景品名・設定値） ──────────
function TextFieldRow({ label, fieldId, value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <label htmlFor={fieldId} className="w-28 shrink-0 text-sm text-muted font-bold">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="none"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-right text-sm text-text outline-none placeholder:text-muted/40"
        style={{ WebkitAppearance: 'none' }}
      />
    </div>
  )
}

// ─── メインコンポーネント ────────────────────────────────
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
  const [setA,           setSetA]   = useState('')
  const [isCollectionDay, setIsCollectionDay] = useState(false)
  const [isCollection,   setIsColl] = useState(false)
  const [saving,         setSaving] = useState(false)
  const [result,         setResult] = useState(null)

  useEffect(() => {
    getLastReadingForBooth(boothCode).then(setPrev)
  }, [boothCode])

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
      next: { inMeter, outMeter, prizeName, setA },
      isCollection: recordAsCollection,
    }),
    [prev, inMeter, outMeter, prizeName, setA, recordAsCollection],
  )

  const canSave = inMeter !== '' && outMeter !== '' && stock !== ''

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
        prizeName:    prizeName || null,
        setA:         setA     || null,
        entryType,
        staffId,
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

      {/* 入力フォーム */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">
          {/* 4必須値（業務動線: IN → OUT → 在庫 → 補充） */}
          <FieldRow label="INメーター"  fieldId="field-in-meter"  value={inMeter}  onChange={setIn}  allowDecimal />
          <FieldRow label="OUTメーター" fieldId="field-out-meter" value={outMeter} onChange={setOut} allowDecimal />
          <FieldRow label="景品在庫"    fieldId="field-stock"     value={stock}    onChange={setStk} />
          <FieldRow label="補充数"      fieldId="field-restock"   value={restock}  onChange={setRst} />

          {/* 入替/設定変更用（任意） */}
          <TextFieldRow
            label="景品名"
            fieldId="field-prize-name"
            value={prizeName}
            onChange={setPrize}
            placeholder="変更する場合のみ入力"
          />
          <TextFieldRow
            label="設定値"
            fieldId="field-set-a"
            value={setA}
            onChange={setSetA}
            placeholder="変更する場合のみ入力"
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
