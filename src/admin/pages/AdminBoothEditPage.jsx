import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import { NumpadFooterPanel } from '../../clawsupport/components/NumpadField'
import BoothInputForm, { ALL_TOUCHED } from '../../clawsupport/components/BoothInputForm'
import { useFieldNavigation } from '../../clawsupport/hooks/useFieldNavigation'
import { isAdmin } from '../../services/permissions'
import { logger } from '../../lib/logger'
import {
  getFullReading,
  updateMeterReading,
  deleteMeterReading,
  insertAuditLog,
  insertPastDateReading,
  fetchAdminBoothHistory,
} from '../../services/adminMeterEdit'

function UnauthorizedView() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/clawsupport', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div data-testid="unauthorized-toast" className="text-amber-400 text-base font-bold px-4 py-3 border border-amber-400/40 rounded-xl">
        権限なし
      </div>
    </div>
  )
}

const ENTRY_TYPE_LABEL = {
  patrol:     '通常巡回',
  replace:    '入替/設定変更',
  collection: '集金',
}

const ENTRY_BADGE = {
  patrol:        { label: '巡回', cls: 'bg-blue-600 text-white' },
  replace:       { label: '入替', cls: 'bg-purple-600 text-white' },
  collection:    { label: '集金', cls: 'bg-green-600 text-white' },
  carry_forward: { label: '繰越', cls: 'bg-gray-500 text-white' },
}

function fmtCreatedAt(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day:   '2-digit',
    hour:  '2-digit',
    minute: '2-digit',
  })
}

function fmtDiff(val) {
  if (val == null) return '—'
  return val >= 0 ? `+${val}` : String(val)
}

export default function AdminBoothEditPage() {
  const { boothCode } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { staffId, staffRole, loading } = useAuth()
  const { navigateNext, currentField, registerField } = useFieldNavigation()
  const activeTabindex = currentField?.dataTabindex ?? null

  const { machine, booth, storeCode } = state ?? {}
  const outMeterCount = machine?.machine_models?.out_meter_count ?? 1

  const [selectedReading, setSelectedReading] = useState(null)
  const [lockTimestamp, setLockTimestamp] = useState(null)
  const [beforeSnapshot, setBeforeSnapshot] = useState(null)

  const [inMeter,    setIn]    = useState('')
  const [outMeter1,  setOut1]  = useState('')
  const [outMeter2,  setOut2]  = useState('')
  const [outMeter3,  setOut3]  = useState('')
  const [stock,      setStk]   = useState('')
  const [restock,    setRst]   = useState('')
  const [prizeName,  setPrize] = useState('')
  const [prizeCost,  setCost]  = useState('')
  const [setA,       setSetA]  = useState('')
  const [setC,       setSetC]  = useState('')
  const [setL,       setSetL]  = useState('')
  const [setR,       setSetR]  = useState('')
  const [setO,       setSetO]  = useState('')
  const [touched,    setTouched] = useState(ALL_TOUCHED)
  const [selectedPrizeId, setSelectedPrizeId] = useState(null)

  const [saving,   setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result,   setResult]  = useState(null)
  const [historyKey, setHistoryKey] = useState(0)

  const [hasUnsaved, setHasUnsaved] = useState(false)

  const [showDatePicker,  setShowDatePicker]  = useState(false)
  const [pickerDate,      setPickerDate]      = useState('')
  const [insertingPast,   setInsertingPast]   = useState(false)

  const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const [historyRows,    setHistoryRows]    = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    if (!boothCode) return
    setHistoryLoading(true)
    fetchAdminBoothHistory(boothCode, 30).then(rows => {
      setHistoryRows(rows)
      setHistoryLoading(false)
    })
  }, [boothCode, historyKey])

  async function handleRowSelect(row) {
    if (hasUnsaved) {
      if (!window.confirm('破棄して切替?')) return
    }
    logger.info('admin_patrol_edit_open_record', { boothCode, patrol_date: row.patrol_date })
    const full = await getFullReading(row.reading_id)
    setSelectedReading(full)
    setLockTimestamp(full.updated_at)
    setBeforeSnapshot({ ...full })

    setIn(full.in_meter != null ? String(full.in_meter) : '')
    setOut1(full.out_meter != null ? String(full.out_meter) : '')
    setOut2(full.out_meter_2 != null ? String(full.out_meter_2) : '')
    setOut3(full.out_meter_3 != null ? String(full.out_meter_3) : '')
    setStk(full.prize_stock_count != null ? String(full.prize_stock_count) : '')
    setRst(full.prize_restock_count != null ? String(full.prize_restock_count) : '')
    setPrize(full.prize_name ?? '')
    setCost(full.prize_cost != null ? String(full.prize_cost) : '')
    setSetA(full.set_a ?? '')
    setSetC(full.set_c ?? '')
    setSetL(full.set_l ?? '')
    setSetR(full.set_r ?? '')
    setSetO(full.set_o ?? '')
    setTouched(ALL_TOUCHED)
    setSelectedPrizeId(null)
    setResult(null)
    setHasUnsaved(false)
  }

  const touch = key => () => {
    logger.info('admin_patrol_field_edited', { field_name: key })
    setTouched(t => ({ ...t, [key]: true }))
    setHasUnsaved(true)
  }

  const canSave = !!selectedReading && inMeter !== '' && outMeter1 !== '' && stock !== ''

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const patch = {
        in_meter:             inMeter !== '' ? Number(inMeter) : null,
        out_meter:            outMeter1 !== '' ? Number(outMeter1) : null,
        out_meter_2:          outMeter2 !== '' ? Number(outMeter2) : null,
        out_meter_3:          outMeter3 !== '' ? Number(outMeter3) : null,
        prize_stock_count:    stock !== '' ? Number(stock) : null,
        prize_restock_count:  restock !== '' ? Number(restock) : null,
        prize_name:           prizeName.trim() || null,
        prize_cost:           prizeCost !== '' ? Number(prizeCost) : null,
        prize_id:             selectedPrizeId,
        set_a:                setA.trim() || null,
        set_c:                setC.trim() || null,
        set_l:                setL.trim() || null,
        set_r:                setR.trim() || null,
        set_o:                setO.trim() || null,
      }

      const afterRow = await updateMeterReading({
        readingId:     selectedReading.reading_id,
        lockTimestamp,
        patch,
        staffId,
        boothCode,
      })

      await insertAuditLog({
        action:    'admin_edit_meter_reading',
        targetId:  selectedReading.reading_id,
        before:    beforeSnapshot,
        after:     afterRow,
        staffId,
        boothCode,
      })

      setLockTimestamp(afterRow.updated_at)
      setBeforeSnapshot({ ...afterRow })
      setSelectedReading(afterRow)
      setHasUnsaved(false)
      setResult('saved')
      setHistoryKey(k => k + 1)
      logger.info('admin_patrol_record_saved')
    } catch (err) {
      if (err.message === 'CONFLICT') {
        setResult('conflict')
      } else {
        setResult('error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedReading) return
    if (!window.confirm('この入力を削除します。取り消せません。続行?')) return
    setDeleting(true)
    try {
      await deleteMeterReading({
        readingId:     selectedReading.reading_id,
        lockTimestamp,
        before:        beforeSnapshot,
        staffId,
        boothCode,
      })
      setSelectedReading(null)
      setLockTimestamp(null)
      setBeforeSnapshot(null)
      setHasUnsaved(false)
      setResult(null)
      setHistoryKey(k => k + 1)
      logger.info('admin_patrol_record_deleted')
    } catch (err) {
      if (err.message === 'CONFLICT') {
        alert('他の操作で変更されています。ページを再読み込みしてください。')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handlePastDateInsert() {
    if (!pickerDate || pickerDate > todayJST || insertingPast) return
    setInsertingPast(true)
    logger.info('admin_patrol_past_date_insert_saved', { selected_date: pickerDate })
    try {
      const newRow = await insertPastDateReading({ boothCode, patrolDate: pickerDate, staffId })
      await insertAuditLog({
        action: 'admin_patrol_past_date_insert',
        targetId: newRow.reading_id,
        before: null,
        after: newRow,
        staffId,
        boothCode,
      })
      setShowDatePicker(false)
      setPickerDate('')
      setHistoryKey(k => k + 1)
      await handleRowSelect(newRow)
    } catch {
      setResult('error')
    } finally {
      setInsertingPast(false)
    }
  }

  if (loading) return null
  if (!isAdmin(staffRole)) return <UnauthorizedView />

  const boothLabel = booth
    ? `${machine?.machine_name ?? ''} ブース ${booth.booth_number} [管理編集]`
    : `${boothCode} [管理編集]`

  return (
    <div className="h-dvh flex flex-col bg-bg text-text">
      <PageHeader
        module="admin"
        title={boothLabel}
        variant="compact"
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Form section — sticky header with its own scroll */}
        <div className="shrink-0 max-h-[55dvh] overflow-y-auto border-b border-border">
          {selectedReading ? (
            <>
              <div data-testid="admin-edit-readonly" className="mx-4 mb-2 px-3 py-2 rounded-xl bg-surface/60 border border-border text-base text-muted space-y-0.5">
                <div className="flex gap-3 flex-wrap">
                  <span>ID: <span className="font-mono text-text/70">{selectedReading.reading_id}</span></span>
                  <span>日: <span className="font-bold text-text/80">{selectedReading.patrol_date}</span></span>
                  <span>種別: <span className={`font-bold ${selectedReading.entry_type === 'replace' ? 'text-amber-400' : selectedReading.entry_type === 'collection' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {ENTRY_TYPE_LABEL[selectedReading.entry_type] ?? selectedReading.entry_type}
                  </span></span>
                </div>
              </div>

              <BoothInputForm
                mode="edit"
                outMeterCount={outMeterCount}
                inMeter={inMeter} setIn={setIn}
                outMeter1={outMeter1} setOut1={setOut1}
                outMeter2={outMeter2} setOut2={setOut2}
                outMeter3={outMeter3} setOut3={setOut3}
                stock={stock} setStk={setStk}
                restock={restock} setRst={setRst}
                prizeName={prizeName} setPrize={setPrize}
                prizeCost={prizeCost} setCost={setCost}
                setA={setA} setSetA={setSetA}
                setC={setC} setSetC={setSetC}
                setL={setL} setSetL={setSetL}
                setR={setR} setSetR={setSetR}
                setO={setO} setSetO={setSetO}
                selectedPrizeId={selectedPrizeId} setSelectedPrizeId={setSelectedPrizeId}
                touched={touched} touch={touch}
                navigateNext={navigateNext} registerField={registerField} activeTabindex={activeTabindex}
                canSave={canSave} saving={saving} result={result} onSave={handleSave}
                onDelete={handleDelete} deleting={deleting}
              />
            </>
          ) : (
            <div className="mx-4 mt-4 px-4 py-8 text-center text-muted text-base rounded-xl bg-surface/30 border border-border">
              履歴から編集対象を選択してください
            </div>
          )}
        </div>

        {/* History section — independent scroll */}
        <div
          data-testid="booth-history-list"
          className="flex-1 overflow-y-auto min-h-[200px] pb-[300px]"
        >
          <div className="sticky top-0 bg-bg z-10 px-4 py-2 border-b border-border flex items-center gap-2">
            <span className="text-sm font-bold text-muted flex-1">巡回履歴</span>
            <button
              type="button"
              onClick={() => { logger.info('admin_patrol_past_date_insert_clicked'); setShowDatePicker(true) }}
              className="text-sm font-bold text-blue-400 border border-blue-400/30 bg-blue-500/10 rounded-lg px-3 min-h-[44px] flex items-center"
            >
              + 過去日追加
            </button>
          </div>
          {historyLoading ? (
            <div className="px-4 py-6 text-center text-muted text-sm">読込中...</div>
          ) : historyRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted text-sm">履歴なし</div>
          ) : (
            historyRows.map(row => {
              const badge = ENTRY_BADGE[row.entry_type] ?? { label: row.entry_type, cls: 'bg-gray-500 text-white' }
              const isSelected = selectedReading?.reading_id === row.reading_id
              return (
                <div
                  key={row.reading_id}
                  data-testid="history-row"
                  onClick={() => handleRowSelect(row)}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b border-border cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-surface/50'
                  }`}
                >
                  <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-base text-text">{row.patrol_date}</span>
                    <span className="ml-2 text-xs text-gray-500">入力: {fmtCreatedAt(row.created_at)}</span>
                  </div>
                  <div className="shrink-0 text-xs text-muted text-right space-x-2">
                    <span>IN {fmtDiff(row.in_diff)}</span>
                    <span>OUT {fmtDiff(row.out_diff)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <NumpadFooterPanel currentField={currentField} />

      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg border border-border rounded-2xl p-6 mx-4 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold mb-4">過去日付で追加</h3>
            <input
              type="date"
              value={pickerDate}
              max={todayJST}
              onChange={e => setPickerDate(e.target.value)}
              className="w-full border-2 border-border rounded-xl px-3 py-3 text-base bg-surface2 text-text mb-4 outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePastDateInsert}
                disabled={!pickerDate || pickerDate > todayJST || insertingPast}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-base disabled:opacity-40"
              >
                {insertingPast ? '追加中...' : '追加する'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDatePicker(false); setPickerDate('') }}
                className="flex-1 py-3 border border-border text-text font-bold rounded-xl text-base"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
