import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCollectionHistory, getCollectionDetail, saveSignedPdf } from '../services/collections'
import { buildCollectionSlip, slipFileName, ensureJpFont } from './lib/collectionPdf'
import SignatureCanvas from './components/SignatureCanvas'

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

  useEffect(() => { reload() }, [])
  async function reload() {
    setLoading(true)
    const { data, error: e } = await getCollectionHistory()
    if (e) setError(`ERR-COLLECTION-001: ${e.message}`)
    else setRows(data ?? [])
    setLoading(false)
  }

  // J-COLLECTION-06 fix_1: buildCollectionSlip は async(J-COLLECTION-05)。await を付ける。
  async function downloadPdf(id) {
    setError(null)
    try {
      const { data, error: e } = await getCollectionDetail(id)
      if (e) throw e
      await ensureJpFont()
      const doc = await buildCollectionSlip(data)
      doc.save(slipFileName(id))
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    }
  }

  // J-COLLECTION-06 fix_3: 先方署名モーダルを開く
  async function openSigning(id) {
    setError(null)
    try {
      const { data, error: e } = await getCollectionDetail(id)
      if (e) throw e
      await ensureJpFont()
      const doc = await buildCollectionSlip(data) // 元PDF (署名なし)
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      setSigning({ collectionId: id, pdfBlobUrl: url, detail: data })
    } catch (e) {
      setError(`ERR-COLLECTION-003: ${e.message}`)
    }
  }
  function closeSigning() {
    if (signing?.pdfBlobUrl) URL.revokeObjectURL(signing.pdfBlobUrl)
    setSigning(null)
  }

  return (
    <div data-testid="collection-history" className="flex flex-col" style={{ height: '100dvh' }}>
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
            const signed = !!r.signed_pdf_url
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
                  className="text-base px-2 min-h-[44px]"
                  title="PDFダウンロード"
                >📄</button>
                <button
                  data-testid={`sign-btn-${r.collection_id}`}
                  onClick={() => openSigning(r.collection_id)}
                  className={`text-xs font-bold rounded px-2 min-h-[44px] ${signed ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white'}`}
                >{signed ? '再署名' : '先方署名'}</button>
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

  async function handleSave() {
    if (!signatureData) return
    setSaving(true)
    try {
      // 署名付きPDFを再生成 → Blob化
      const doc = await buildCollectionSlip({ ...detail, customerSignatureDataUrl: signatureData })
      const blob = doc.output('blob')
      const { data, error: e } = await saveSignedPdf({ collectionId, fileBlob: blob })
      if (e) throw e
      onSaved?.(data?.url)
    } catch (e) {
      const msg = `ERR-COLLECTION-008: ${e.message}`
      localErr.current = msg
      onError?.(new Error(msg))
    } finally {
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
