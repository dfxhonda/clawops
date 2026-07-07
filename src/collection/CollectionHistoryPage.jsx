import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCollectionHistory, getCollectionDetail, saveSignedPdf, uploadCustomerSignature } from '../services/collections'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import { fetchAsDataURL } from './lib/imageUtil'
import SignatureCanvas from './components/SignatureCanvas'

// J-COLLECTION-09 fix_2 / J-COLLECTION-11: cash_collections.staff_signature_url および
// customer_signature_url を fetch → dataURL → buildCollectionSlip に渡す。
// 失敗時は null フォールバック (PDF生成は継続、署名なし枠で出力)。
async function fetchStaffSigDataUrl(url) {
  if (!url) return null
  try { return await fetchAsDataURL(url) } catch { return null }
}
async function fetchCustomerSigDataUrl(url) {
  if (!url) return null
  try { return await fetchAsDataURL(url) } catch { return null }
}

// J-COLLECTION-06: 集金履歴一覧 + 先方タッチ署名+署名済PDF自動保存。
//   fix_1 PDFダウンロード async修正、fix_3 先方署名モーダル+保存フロー
const yen = n => Number(n || 0).toLocaleString()

export default function CollectionHistoryPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [signing, setSigning] = useState(null) // { collectionId, pdfBlobUrl, detail }
  const [toast, setToast] = useState(null)
  // J-COLLECTION-11 fix_B: PDF生成 二度押しガード。
  //   generatingId (state) = UI 表示用 / generatingRef (ref) = React state コミット待ちの間も
  //   同期的に再入を遮断するための真ロック。state だけでは batching でクロージャ stale により
  //   連打が通り抜ける (実機/test ともに再現)。
  const [generatingId, setGeneratingId] = useState(null)
  const generatingRef = useRef(null)

  useEffect(() => { reload() }, [])
  async function reload() {
    setLoading(true)
    const { data, error: e } = await getCollectionHistory()
    if (e) setError(`ERR-COLLECTION-001: ${e.message}`)
    else setRows(data ?? [])
    setLoading(false)
  }

  // J-COLLECTION-06 fix_1: buildCollectionSlip は async(J-COLLECTION-05)。await を付ける。
  // J-COLLECTION-09 fix_2 / J-COLLECTION-11: 弊社+先方署名 URL を dataURL に変換して embed。
  // J-COLLECTION-11 fix_B: 再入ロック (generatingId)。即時 disabled+spinner で連打吸収。
  // SPEC-COLLECTION-SIGNED-PDF-REUSE-01: 署名済+signed_pdf_urlあり → stored PDF を直接 open (再生成せず)。
  //   signed_pdf_url なし (過渡期) or 未署名 → 既存の buildCollectionSlip 生成パス。
  async function downloadPdf(id) {
    if (generatingRef.current) return // 同期 ref ロック (state batching を待たない)
    generatingRef.current = id
    setError(null)
    setGeneratingId(id)
    try {
      const { data, error: e } = await getCollectionDetail(id)
      if (e) throw e
      const col = data?.collection
      if (col?.customer_signed_at && col?.signed_pdf_url) {
        // 署名済 + stored PDF あり → 証拠性保全のため再生成せず直接 open
        window.open(col.signed_pdf_url, '_blank', 'noopener')
        return
      }
      // 未署名 or 署名済+URL欠損 (過渡期 SMD01 等) → 既存生成パス
      await ensureJpFont()
      const [staffSig, customerSig] = await Promise.all([
        fetchStaffSigDataUrl(col?.staff_signature_url),
        fetchCustomerSigDataUrl(col?.customer_signature_url),
      ])
      const doc = await buildCollectionSlip({
        ...data,
        staffSignatureDataUrl: staffSig,
        customerSignatureDataUrl: customerSig,
      })
      doc.save(slipFileName(id))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    } finally {
      generatingRef.current = null
      setGeneratingId(null)
    }
  }

  // J-COLLECTION-06 fix_3: 先方署名モーダルを開く
  // J-COLLECTION-09 fix_2 / J-COLLECTION-11: detail に弊社+先方署名 dataURL を埋め込み、両枠 fill。
  // J-COLLECTION-11 fix_B: 同期 ref ロックで再入不能。
  async function openSigning(id) {
    if (generatingRef.current) return
    generatingRef.current = id
    setError(null)
    setGeneratingId(id)
    try {
      const { data, error: e } = await getCollectionDetail(id)
      if (e) throw e
      await ensureJpFont()
      const [staffSig, customerSig] = await Promise.all([
        fetchStaffSigDataUrl(data?.collection?.staff_signature_url),
        fetchCustomerSigDataUrl(data?.collection?.customer_signature_url),
      ])
      const detail = {
        ...data,
        staffSignatureDataUrl: staffSig,
        customerSignatureDataUrl: customerSig,
      }
      const doc = await buildCollectionSlip(detail) // 元PDF (両枠 filled、ユーザーは新規署名を上書き可能)
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      setSigning({ collectionId: id, pdfBlobUrl: url, detail })
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    } finally {
      generatingRef.current = null
      setGeneratingId(null)
    }
  }
  function closeSigning() {
    if (signing?.pdfBlobUrl) URL.revokeObjectURL(signing.pdfBlobUrl)
    setSigning(null)
  }

  return (
    <div data-testid="collection-history" className="flex flex-col" style={{ height: '100svh' }}>
      <div className="flex-shrink-0 p-3 border-b border-border">
        <button onClick={() => navigate('/collection/input')} className="text-sm text-gray-400 hover:text-white min-h-[44px] flex items-center gap-1 mb-2">← 集金入力</button>
        <h1 className="text-base font-bold text-text">集金履歴</h1>
      </div>

      {error && <p className="text-red-400 text-sm px-3 py-1">{error}</p>}
      {toast && <p data-testid="signed-toast" className="text-green-400 text-sm px-3 py-1">{toast}</p>}

      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading && <p className="text-center text-muted text-base py-8">読込中…</p>}
        {!loading && rows.length === 0 && <p className="text-center text-muted text-base py-8">集金履歴がありません</p>}
        <div className="space-y-2">
          {rows.map(r => {
            // SPEC-COLLECTION-HISTORY-SIGN-BUTTON-FIX-07: customer_signed_at を判定軸に変更
            // signed_pdf_url は新フロー(経路A)では書かれないため判定対象外
            const signed = !!r.customer_signed_at
            // J-COLLECTION-11 fix_B: PDF生成中は両ボタン disabled + 即時 active 色 + spinner 化。
            const busy = generatingId === r.collection_id
            const anyBusy = !!generatingId
            return (
              <div
                key={r.collection_id}
                data-testid="collection-history-row"
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-text truncate">{r.store_name}</div>
                  <div className="text-xs text-muted">{r.collected_at} ・ {r.collection_id}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-base font-bold text-text tabular-nums">{yen(r.total)}円</div>
                  <div className="flex gap-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                      {r.status === 'confirmed' ? '確定' : '下書'}
                    </span>
                    {signed && (
                      <span data-testid={`signed-badge-${r.collection_id}`} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">署名済</span>
                    )}
                  </div>
                </div>
                <button
                  data-testid={`download-pdf-${r.collection_id}`}
                  onClick={() => downloadPdf(r.collection_id)}
                  disabled={anyBusy}
                  aria-busy={busy || undefined}
                  className={`text-base px-2 min-h-[44px] rounded disabled:opacity-50 ${busy ? 'bg-blue-900/40 text-white' : ''}`}
                  title="PDFダウンロード"
                >{busy ? '⏳' : '📄'}</button>
                <button
                  data-testid={`sign-btn-${r.collection_id}`}
                  onClick={() => openSigning(r.collection_id)}
                  disabled={anyBusy}
                  aria-busy={busy || undefined}
                  className={`text-xs font-bold rounded px-2 min-h-[44px] disabled:opacity-50 ${signed ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white'} ${busy ? 'ring-2 ring-blue-300' : ''}`}
                >{busy ? '生成中…' : (signed ? '再署名' : '先方署名')}</button>
              </div>
            )
          })}
        </div>
      </div>

      {signing && (
        <CustomerSignModal
          collectionId={signing.collectionId}
          detail={signing.detail}
          pdfBlobUrl={signing.pdfBlobUrl}
          onClose={closeSigning}
          onSaved={async (publicUrl) => {
            closeSigning()
            setToast('保存完了')
            setTimeout(() => setToast(null), 2500)
            await reload()
          }}
          onError={e => setError(e.message)}
        />
      )}
    </div>
  )
}

function CustomerSignModal({ collectionId, detail, pdfBlobUrl, onClose, onSaved, onError }) {
  const [signatureData, setSignatureData] = useState(null)
  const [saving, setSaving] = useState(false)
  const localErr = useRef(null)
  const savingRef = useRef(false) // J-COLLECTION-11 fix_B: state batching を待たない同期ロック

  // J-COLLECTION-11 fix_A + fix_B:
  //   先方署名を Storage に upload → cash_collections.customer_signature_url/path UPDATE
  //   → 署名付きPDF再生成→ saveSignedPdf (Storage + signed_pdf_* + customer_signed_at + customer_sig)
  // 二度押しガード: savingRef===true で早期return (React state batching でも再入物理的に不能)。
  async function handleSave() {
    if (!signatureData) return
    if (savingRef.current) return // 同期 ref ロック
    savingRef.current = true
    setSaving(true)
    try {
      // (A) 先方署名 PNG を Storage へ upload (失敗時は致命扱いせず PDF生成は続ける)
      let customerSigUrl = null, customerSigPath = null
      const { data: sigData, error: sigErr } = await uploadCustomerSignature({
        collectionId, dataUrl: signatureData,
      })
      if (sigErr) {
        // J-COLLECTION-09 fix_3 思想を踏襲: 致命扱いせず PDF生成は継続。
        // ただし署名persistence はDBに残らないので、後続 download PDF では空枠になる。
        console.warn('uploadCustomerSignature failed:', sigErr.message)
      } else {
        customerSigUrl = sigData?.url ?? null
        customerSigPath = sigData?.path ?? null
      }
      // 署名付きPDFを再生成 → Blob化
      const doc = await buildCollectionSlip({ ...detail, customerSignatureDataUrl: signatureData })
      const blob = doc.output('blob')
      const { data, error: e } = await saveSignedPdf({
        collectionId, fileBlob: blob,
        customerSigUrl, customerSigPath, // J-COLLECTION-11 fix_A: DB に永続化
      })
      if (e) throw e
      onSaved?.(data?.url)
    } catch (e) {
      const msg = `ERR-COLLECTION-008: ${e.message}`
      localErr.current = msg
      onError?.(new Error(msg))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div data-testid="customer-sign-modal" className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-bg border-b border-border" style={{ minHeight: 48 }}>
        <span className="text-base font-bold text-text flex-1">先方様 ご署名</span>
        <button data-testid="customer-sign-close" onClick={onClose} className="text-base text-muted min-h-[44px] px-3">閉じる</button>
      </div>
      <div className="flex-1 overflow-hidden bg-gray-200">
        <iframe
          data-testid="customer-sign-pdf"
          title="signed-pdf-preview"
          src={pdfBlobUrl}
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
        />
      </div>
      <div className="flex-shrink-0 p-3 border-t border-border bg-bg space-y-2">
        <span className="text-xs text-muted">下の枠に先方ご担当者様のご署名をお願いします</span>
        <SignatureCanvas value={signatureData} onChange={setSignatureData} height={140} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 min-h-[48px] rounded-xl border border-border text-base text-muted">キャンセル</button>
          <button
            data-testid="customer-sign-save"
            onClick={handleSave}
            disabled={!signatureData || saving}
            className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-bold disabled:opacity-50"
          >{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}
