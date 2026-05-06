import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import { PageHeader } from '../../shared/ui/PageHeader'
import NumpadField from '../components/NumpadField'
import { upsertPatrolReading, getLastReadingForBooth } from '../../services/patrolCore'

function PrevReadingRow({ prev }) {
  if (!prev) return null
  const date = prev.patrol_date ?? prev.read_time?.slice(0, 10) ?? '—'
  return (
    <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-surface/60 border border-border text-xs text-muted">
      <span className="font-bold mr-2">前回</span>
      <span>{date}</span>
      <span className="mx-2">|</span>
      <span>IN {prev.in_meter ?? '—'}</span>
      <span className="mx-1">/</span>
      <span>OUT {prev.out_meter ?? '—'}</span>
      <span className="mx-2">|</span>
      <span>在庫 {prev.prize_stock_count ?? '—'}</span>
      <span className="mx-1">補充 {prev.prize_restock_count ?? '—'}</span>
    </div>
  )
}

function FieldRow({ label, fieldId, value, onChange, onNext, allowDecimal = false }) {
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
          onNext={onNext}
          label={label}
          allowDecimal={allowDecimal}
          style={{ width: 120, fontSize: 18 }}
        />
      </div>
    </div>
  )
}

export default function PatrolBoothInputPage() {
  const { boothCode } = useParams()
  const { state }    = useLocation()
  const navigate     = useNavigate()
  const { staffId }  = useAuth()
  const { enabled: patrolEnabled } = useFeatureFlag('patrol_core')

  const { machine, booth, storeCode } = state ?? {}

  const [prev, setPrev]     = useState(null)
  const [inMeter,  setIn]   = useState('')
  const [outMeter, setOut]  = useState('')
  const [stock,    setStk]  = useState('')
  const [restock,  setRst]  = useState('')
  const [saving,   setSaving] = useState(false)
  const [result,   setResult] = useState(null) // 'saved' | 'skipped' | 'error'

  useEffect(() => {
    getLastReadingForBooth(boothCode).then(setPrev)
  }, [boothCode])

  const canSave = inMeter !== '' && outMeter !== '' && stock !== ''

  async function handleSave() {
    if (!patrolEnabled) {
      alert('patrol_core フラグが無効です。管理者に連絡してください。')
      return
    }
    if (!canSave) return
    setSaving(true)
    try {
      const res = await upsertPatrolReading({
        boothCode,
        storeCode:   storeCode  ?? machine?.store_code,
        machineCode: machine?.machine_code,
        inMeter,
        outMeter,
        prizeStock:   stock,
        prizeRestock: restock,
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

      {/* 前回値 */}
      <PrevReadingRow prev={prev} />

      {/* 4値入力（業務動線順: IN → OUT → 在庫 → 補充） */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-surface/30 rounded-2xl mx-4 border border-border overflow-hidden">
          <FieldRow
            label="INメーター"
            fieldId="field-in-meter"
            value={inMeter}
            onChange={setIn}
            allowDecimal
          />
          <FieldRow
            label="OUTメーター"
            fieldId="field-out-meter"
            value={outMeter}
            onChange={setOut}
            allowDecimal
          />
          <FieldRow
            label="景品在庫"
            fieldId="field-stock"
            value={stock}
            onChange={setStk}
          />
          <FieldRow
            label="補充数"
            fieldId="field-restock"
            value={restock}
            onChange={setRst}
          />
        </div>

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
