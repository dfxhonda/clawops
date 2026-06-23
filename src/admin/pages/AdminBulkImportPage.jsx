import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import ErrorBanner from '../../components/ErrorBanner'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../services/permissions'
import { getPatrolMachines } from '../../services/patrol'
import { generateExcelTemplate } from '../lib/excelTemplate'
import { parseAndValidateExcel } from '../lib/excelImport'
import { bulkInsertMeterReadings } from '../lib/bulkInsertMeterReadings'
import { logger } from '../../lib/logger'
import { ERR } from '../../lib/errorCodes'

export default function AdminBulkImportPage() {
  const navigate = useNavigate()
  const { staffRole, staffId, loading } = useAuth()

  const [stores,         setStores]         = useState([])
  const [selectedStore,  setSelectedStore]  = useState(null)
  const [machines,       setMachines]       = useState([])
  const [machinesLoading, setMachinesLoading] = useState(false)

  const [validatedRows, setValidatedRows] = useState(null)
  const [fileName,      setFileName]      = useState('')

  const [saveState,    setSaveState]    = useState('idle') // idle | loading | success | error
  const [errCode,      setErrCode]      = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [successCount, setSuccessCount] = useState(0)

  useEffect(() => {
    supabase
      .from('stores')
      .select('store_code, store_name')
      .eq('is_active', true)
      .order('store_name')
      .then(({ data }) => setStores(data ?? []))
  }, [])

  useEffect(() => {
    if (!selectedStore) { setMachines([]); return }
    setMachinesLoading(true)
    getPatrolMachines(selectedStore.store_code)
      .then(m => { setMachines(m); setMachinesLoading(false) })
  }, [selectedStore])

  if (loading) return null
  if (!isAdmin(staffRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-amber-400 font-bold">権限なし</p>
      </div>
    )
  }

  const totalBooths = machines.flatMap(m => m.booths).length

  async function handleDownloadTemplate() {
    if (!selectedStore || !machines.length) return
    try {
      await generateExcelTemplate({
        storeCode: selectedStore.store_code,
        storeName: selectedStore.store_name,
        machines,
      })
    } catch (e) {
      setErrCode(ERR.IMPORT_001)
      setErrorMsg('雛形生成エラー: ' + (e?.message ?? ''))
    }
  }

  function resetImport() {
    setValidatedRows(null)
    setFileName('')
    setSaveState('idle')
    setErrCode('')
    setErrorMsg('')
    setSuccessCount(0)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    resetImport()
    setFileName(file.name)
    try {
      const rows = await parseAndValidateExcel(file)
      setValidatedRows(rows)
    } catch (e) {
      setErrCode(ERR.IMPORT_001)
      setErrorMsg(e?.message ?? 'ファイル読み込みエラー')
      logger.error(ERR.IMPORT_001, { message: e?.message })
    }
  }

  const hasErrors  = validatedRows?.some(r => r.status === 'error')
  const canImport  = !!(validatedRows?.length > 0 && !hasErrors && saveState === 'idle')

  async function handleBulkImport() {
    if (!canImport) return
    setSaveState('loading')
    setErrCode('')
    setErrorMsg('')
    try {
      const result = await bulkInsertMeterReadings({ validatedRows, staffId })
      if (result.ok) {
        setSuccessCount(result.insertedCount)
        setSaveState('success')
        setValidatedRows(null)
      } else {
        setErrCode(result.errCode ?? ERR.IMPORT_003)
        setErrorMsg(result.message ?? '取込エラー')
        setSaveState('error')
      }
    } catch (e) {
      setErrCode(ERR.IMPORT_003)
      setErrorMsg(e?.message ?? '予期しないエラー')
      setSaveState('error')
    }
  }

  return (
    <>
      {/* iPad+ */}
      <div className="hidden md:block min-h-screen bg-bg">
        <PageHeader title="Excel一括取込" hideHome={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-5">

          {/* Step 1: template download */}
          <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-base font-bold text-text">① 雛形ダウンロード</h2>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <label className="text-sm text-muted mb-1 block">店舗選択</label>
                <select
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text"
                  value={selectedStore?.store_code ?? ''}
                  onChange={e => {
                    const s = stores.find(x => x.store_code === e.target.value) ?? null
                    setSelectedStore(s)
                    resetImport()
                  }}
                >
                  <option value="">-- 店舗を選択 --</option>
                  {stores.map(s => (
                    <option key={s.store_code} value={s.store_code}>
                      {s.store_name}（{s.store_code}）
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDownloadTemplate}
                disabled={!selectedStore || machinesLoading || totalBooths === 0}
                className="shrink-0 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-40"
              >
                {machinesLoading ? '読込中…' : '雛形DL (.xlsx)'}
              </button>
            </div>
            {selectedStore && !machinesLoading && (
              <p className="text-sm text-muted">ブース数: {totalBooths} 件</p>
            )}
          </section>

          {/* Step 2: upload + preview */}
          <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-base font-bold text-text">② Excelアップロード → プレビュー</h2>
            {(saveState === 'idle' || saveState === 'error') && errCode && (
              <ErrorBanner
                errCode={errCode}
                message={errorMsg}
                onClose={() => { setErrCode(''); setErrorMsg('') }}
              />
            )}
            <div>
              <label className="text-sm text-muted mb-1 block">取込ファイル (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'block' }}
                className="text-sm text-text"
              />
              {fileName && <p className="text-sm text-muted mt-1">{fileName}</p>}
            </div>

            {validatedRows && validatedRows.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-bg">
                      <tr>
                        {['行', 'ブースコード', '巡回日', 'IN', 'OUT', '景品名', 'ステータス'].map(h => (
                          <th key={h} className="border border-border px-2 py-1 text-left text-muted font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validatedRows.map(r => (
                        <tr key={r.rowIndex} className={r.status === 'error' ? 'bg-red-950/30' : ''}>
                          <td className="border border-border px-2 py-1 text-center text-muted">{r.rowIndex}</td>
                          <td className="border border-border px-2 py-1 font-mono">{r.boothCode}</td>
                          <td className="border border-border px-2 py-1">{r.patrolDate}</td>
                          <td className="border border-border px-2 py-1 text-right">{r.inMeter ?? ''}</td>
                          <td className="border border-border px-2 py-1 text-right">{r.outMeter ?? ''}</td>
                          <td className="border border-border px-2 py-1 truncate max-w-[120px]">{r.prizeName ?? ''}</td>
                          <td className="border border-border px-2 py-1">
                            {r.status === 'ok'
                              ? <span className="text-green-400 font-bold">○</span>
                              : <span className="text-red-400 text-xs">× {r.errors.join(' / ')}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted">
                  合計 {validatedRows.length} 行 ／ エラー {validatedRows.filter(r => r.status === 'error').length} 行
                </p>
              </>
            )}
          </section>

          {/* Step 3: bulk import */}
          <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-base font-bold text-text">③ 一括取込</h2>

            {saveState === 'error' && errCode && (
              <ErrorBanner
                errCode={errCode}
                message={errorMsg}
                onClose={() => { setSaveState('idle'); setErrCode(''); setErrorMsg('') }}
                onRetry={handleBulkImport}
              />
            )}
            {saveState === 'success' && (
              <div className="text-green-400 font-bold text-sm">
                {successCount} 行の取込が完了しました
              </div>
            )}

            <button
              onClick={handleBulkImport}
              disabled={!canImport}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-base disabled:opacity-40 active:bg-green-700"
            >
              {saveState === 'loading'
                ? '取込中…'
                : `全 ${validatedRows?.filter(r => r.status === 'ok').length ?? 0} 行を取込`}
            </button>

            {hasErrors && (
              <p className="text-sm text-red-400 text-center">エラー行があります。修正して再アップロードしてください。</p>
            )}
          </section>

        </div>
      </div>

      {/* Mobile: not supported */}
      <div className="block md:hidden min-h-screen bg-bg">
        <PageHeader title="Excel一括取込" hideHome={true} />
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-base font-bold text-text">iPad以上の画面で開いてください</p>
            <p className="text-sm text-muted mt-2">Excel一括取込は iPad (768px+) 以上に対応しています</p>
          </div>
        </div>
      </div>
    </>
  )
}
