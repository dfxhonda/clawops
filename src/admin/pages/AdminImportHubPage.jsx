import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHierarchicalBack } from '../../shared/nav/hierarchicalBack' // J-NAV-BACK-HIERARCHICAL-01
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import ErrorBanner from '../../components/ErrorBanner'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../services/permissions'
import { logger } from '../../lib/logger'
import { ERR } from '../../lib/errorCodes'
import { previewPchImport, executePchImport, MANUAL_MARKER } from '../lib/pchImport'

// 行状態 → 表示スタイル
const STATE_STYLE = {
  insert:   { label: 'INSERT',  cls: 'text-green-400',  row: '' },
  update:   { label: 'UPDATE',  cls: 'text-amber-400',  row: 'bg-amber-950/20' },
  skip:     { label: 'skip',    cls: 'text-muted',      row: 'opacity-60' },
  cancel:   { label: 'cancel',  cls: 'text-orange-400', row: 'bg-orange-950/20' },
  conflict: { label: 'CONFLICT',cls: 'text-red-400',    row: 'bg-red-950/30' },
  shipping: { label: '送料',    cls: 'text-blue-400',   row: 'bg-blue-950/20' },
}

function rowFlags(r) {
  const f = []
  if (r.calcMismatch) f.push('⚠️')
  if (r.nonNumericPieces) f.push('📦')
  if (r.unresolved) f.push('🔴')
  return f.join('')
}

export default function AdminImportHubPage() {
  const navigate = useNavigate()
  const goBack = useHierarchicalBack() // J-NAV-BACK-HIERARCHICAL-01
  const { staffRole, staffId, loading } = useAuth()

  const [fileName, setFileName] = useState('')
  const [preview, setPreview]   = useState(null) // { records, summary, months }
  const [parsing, setParsing]   = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle|loading|success|error
  const [errCode, setErrCode]   = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult]     = useState(null)
  const [sgpCount, setSgpCount] = useState(null)

  useEffect(() => {
    supabase.from('prize_orders').select('order_id', { count: 'exact', head: true })
      .eq('order_source', 'sgp_api')
      .then(({ count }) => setSgpCount(count ?? 0))
      .catch(() => setSgpCount(null))
  }, [])

  if (loading) return null
  if (!isAdmin(staffRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-amber-400 font-bold">権限なし</p>
      </div>
    )
  }

  function reset() {
    setPreview(null); setResult(null); setSaveState('idle')
    setErrCode(''); setErrorMsg('')
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    reset(); setFileName(file.name); setParsing(true)
    try {
      const p = await previewPchImport(file)
      setPreview(p)
    } catch (err) {
      setErrCode(ERR.IMPORT_001)
      setErrorMsg(err?.message ?? 'ファイル読込エラー')
      logger.error(ERR.IMPORT_001, { message: err?.message })
    } finally {
      setParsing(false)
    }
  }

  const canExecute = !!(preview && (preview.summary.insert + preview.summary.update + preview.summary.cancel) > 0 && saveState === 'idle')

  async function handleExecute() {
    if (!canExecute) return
    setSaveState('loading'); setErrCode(''); setErrorMsg('')
    try {
      const res = await executePchImport(preview, { staffId, sourceFile: fileName })
      if (res.ok) { setResult(res); setSaveState('success'); setPreview(null) }
      else { setErrCode(res.errCode ?? ERR.IMPORT_003); setErrorMsg(res.message ?? '取込エラー'); setSaveState('error') }
    } catch (err) {
      setErrCode(ERR.IMPORT_003); setErrorMsg(err?.message ?? '予期しないエラー'); setSaveState('error')
    }
  }

  const backBtn = (
    <button onClick={goBack} className="text-sm text-muted px-2">← 戻る</button>
  )
  const rows = preview?.records ?? []
  const conflicts = rows.filter(r => r.state === 'conflict')

  return (
    <>
      <div className="min-h-screen bg-bg">
        <PageHeader title="取込ハブ" leftSlot={backBtn} />
        <div className="p-4 max-w-5xl mx-auto space-y-5">

          {/* PCH Excel 取込 */}
          <section data-testid="pch-import-card" className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-base font-bold text-text">PCH Excel取込 (Change / ピーチトイ)</h2>
            <p className="text-sm text-muted">メーカー請書Excel(複数月シート)をアップロード。照合して INSERT/UPDATE/cancel/conflict を判定します。</p>

            {(saveState === 'idle' || saveState === 'error') && errCode && (
              <ErrorBanner errCode={errCode} message={errorMsg} onClose={() => { setErrCode(''); setErrorMsg('') }} />
            )}

            <div>
              <label className="text-sm text-muted mb-1 block">取込ファイル (.xlsx)</label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'block' }} className="text-sm text-text" />
              {fileName && <p className="text-sm text-muted mt-1">{fileName}{parsing && ' — 解析中…'}</p>}
            </div>

            {preview && (
              <>
                {/* 内訳サマリ */}
                <div className="flex flex-wrap gap-2 text-sm">
                  {Object.entries(STATE_STYLE).map(([k, s]) => (
                    <span key={k} className={`px-2 py-1 rounded bg-bg border border-border ${s.cls}`}>
                      {s.label}: <b>{preview.summary[k] ?? 0}</b>
                    </span>
                  ))}
                  {preview.summary.unresolved > 0 && (
                    <span className="px-2 py-1 rounded bg-bg border border-red-500/40 text-red-400">🔴配分要確認: <b>{preview.summary.unresolved}</b></span>
                  )}
                </div>

                {/* モバイル(iPhone): カード積み */}
                <div className="md:hidden space-y-2 max-h-[60vh] overflow-y-auto">
                  {rows.map((r, i) => {
                    const s = STATE_STYLE[r.state] ?? {}
                    const dest = r.destination === MANUAL_MARKER ? '要確認' : (r.destination ?? '-')
                    return (
                      <div key={r.rawImportId ?? `m-${i}`} className={`rounded-lg border border-border p-2 ${s.row}`}>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-sm text-text flex-1 break-words">{rowFlags(r)} {r.prizeNameRaw}</span>
                          <span className={`text-sm font-bold shrink-0 ${s.cls}`}>{s.label}</span>
                        </div>
                        <div className="text-sm text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>店舗: {dest}</span>
                          <span>ケース: {r.caseCount ?? '-'}</span>
                          <span>単価: {r.unitCost ?? '-'}</span>
                          {r.expectedDate && <span>出荷: {r.expectedDate}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* iPad+: 表 */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-border max-h-[55vh]">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-bg sticky top-0">
                      <tr>
                        {['商品名', '店舗', 'ケース数', '単価', '出荷予定', '状態'].map(h => (
                          <th key={h} className="border border-border px-2 py-1 text-left text-muted font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const s = STATE_STYLE[r.state] ?? {}
                        const dest = r.destination === MANUAL_MARKER ? '要確認' : (r.destination ?? '-')
                        return (
                          <tr key={r.rawImportId ?? `row-${i}`} className={s.row}>
                            <td className="border border-border px-2 py-1 truncate max-w-[220px]">{rowFlags(r)} {r.prizeNameRaw}</td>
                            <td className="border border-border px-2 py-1">{dest}</td>
                            <td className="border border-border px-2 py-1 text-right">{r.caseCount ?? ''}</td>
                            <td className="border border-border px-2 py-1 text-right">{r.unitCost ?? ''}</td>
                            <td className="border border-border px-2 py-1">{r.expectedDate ?? ''}</td>
                            <td className={`border border-border px-2 py-1 font-bold ${s.cls}`}>{s.label}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {conflicts.length > 0 && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-3">
                    <h3 className="text-sm font-bold text-red-400 mb-1">⚠️ コンフリクト {conflicts.length}件 (arrived済・自動上書きしない、ヒロ手動判断)</h3>
                    <ul className="text-sm text-red-200 space-y-0.5">
                      {conflicts.map((c, i) => (
                        <li key={c.rawImportId ?? i}>{c.prizeNameRaw} / {c.destination} — {c.conflictReason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  data-testid="pch-execute-btn"
                  onClick={handleExecute}
                  disabled={!canExecute}
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-base disabled:opacity-40 active:bg-green-700"
                >
                  {saveState === 'loading' ? '取込中…'
                    : `取込実行 (INSERT ${preview.summary.insert} / UPDATE ${preview.summary.update} / cancel ${preview.summary.cancel})`}
                </button>
              </>
            )}

            {saveState === 'success' && result && (
              <div className="text-green-400 font-bold text-sm" data-testid="pch-result">
                取込完了: INSERT {result.inserted} / UPDATE {result.updated} / cancel {result.cancelled}
              </div>
            )}
          </section>

          {/* change過去CSV取込 (別途 MIGRATION-01) */}
          <section className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-base font-bold text-text">change過去CSV取込</h2>
            <p className="text-sm text-muted mt-1">景品フォーム発注履歴CSV(1230行)の一括移行。別途マイグレーションで対応 (MIGRATION-01)。</p>
            <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-xs font-bold bg-gray-600 text-gray-300">別途対応</span>
          </section>

          {/* SGP状態確認 */}
          <section className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-base font-bold text-text">SGP状態確認</h2>
            <p className="text-sm text-muted mt-1">
              SGP(achieve発注PF)経由の発注: <b className="text-text">{sgpCount == null ? '—' : `${sgpCount} 件`}</b> (order_source=sgp_api、Edge Function自動取込・本画面からは変更しない)
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
