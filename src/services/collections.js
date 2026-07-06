// J-COLLECTION-02: 集金データアクセス層 (J-COLLECTION-01全面置換)
import { supabase } from '../lib/supabase'
import { Sentry } from '../lib/sentry'
import { DFX_ORG_ID, CHANGE_ORG_ID } from '../lib/auth/orgConstants'
import { genCollectionId, boothTotal } from '../collection/lib/collectionCalc'

// SPEC-ANOMALY-METER-P1-COLLECTION-AUDIT-01: 集金保存成功後に単価乖離監査RPCを非同期実行。
// fire-and-forget。RPC失敗は集金保存を絶対にブロック/ロールバックしない (Sentry記録のみ)。
// サーバ側集計 (fn_audit_collection_meters) のみ、クライアント集計禁止。
export async function auditCollectionMeters(collectionId) {
  try {
    const { error } = await supabase.rpc('fn_audit_collection_meters', { p_collection_id: collectionId })
    if (error) throw error
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'collection-meter-audit' }, extra: { collectionId } })
  }
}

// アクティブ店舗 (is_active=true)
export async function getActiveStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('store_code, store_name, store_name_official')
    .eq('is_active', true)
    .order('store_name')
  return { data: data ?? [], error }
}

// 店舗のアクティブブース一覧 + 表示名 + 集金日<=meter_readings 最新プリフィル + 直前confirmed集金からprevプリフィル
// J-COLLECTION-04 fix_1/2/3/4:
//   - rental_code = machine_number ?? '' (NULL=空欄)
//   - booth_name = booth_label ?? `${machine_code末尾}-B{nn}` (例 M04-B02)
//   - in_meter_current_default = patrol_date <= collectedAt の meter_readings最新
//   - in_meter_prev_default    = 当該店舗の直前confirmed cash_collection_booths.in_meter_current
export async function getActiveBoothsForStore(storeCode, collectedAt, prevDate) {
  const { data: booths, error } = await supabase
    .from('booths')
    .select('booth_code, machine_code, booth_number, booth_label, is_active')
    .eq('store_code', storeCode)
    .eq('is_active', true)
    .order('machine_code')
    .order('booth_code')
  if (error) return { data: null, error }
  if (!booths || booths.length === 0) return { data: [], error: null }

  const boothCodes = booths.map(b => b.booth_code)
  const machineCodes = [...new Set(booths.map(b => b.machine_code))]

  // meter_readings は patrol_date <= collectedAt に限定 (集金日基準)
  let mrQuery = supabase.from('meter_readings')
    .select('booth_code, in_meter, out_meter, patrol_date, created_at')
    .in('booth_code', boothCodes)
    .eq('entry_type', 'patrol')
  if (collectedAt) mrQuery = mrQuery.lte('patrol_date', collectedAt)
  mrQuery = mrQuery.order('patrol_date', { ascending: false }).order('created_at', { ascending: false })

  const [{ data: machines }, { data: readings }, prevMap] = await Promise.all([
    supabase.from('machines').select('machine_code, machine_name, machine_number, type_id, billing_order').in('machine_code', machineCodes),
    mrQuery,
    getPrevMeterAfterDate(storeCode, boothCodes, prevDate),
  ])
  const mMap = Object.fromEntries((machines ?? []).map(m => [m.machine_code, m]))

  // COLLECTION-EXCLUDE-CHANGER-01 R1+R2: type_id==='changer'の機械のブースを集金リストから除外(表示のみ)
  const changerMcs = new Set((machines ?? []).filter(m => m.type_id === 'changer').map(m => m.machine_code))

  const latestPerBooth = {}
  for (const r of readings ?? []) {
    if (!latestPerBooth[r.booth_code]) latestPerBooth[r.booth_code] = r
  }

  const rows = booths.filter(b => !changerMcs.has(b.machine_code)).map(b => {
    const r = latestPerBooth[b.booth_code]
    const m = mMap[b.machine_code] || {}
    const mcTail = b.machine_code?.split('-').pop() ?? b.machine_code
    return {
      booth_code: b.booth_code,
      machine_code: b.machine_code,
      // fix_1: rental_code = machine_number ?? '' (NULL=空欄、表示はboothで補完)
      rental_code: m.machine_number ?? '',
      machine_name: m.machine_name || b.machine_code || '機械不明',
      // fix_2: booth_name = booth_label(上書き優先) ?? `${machine_code末尾}-B{nn}` 例 M04-B02
      booth_name: b.booth_label
        || (b.booth_number != null ? `${mcTail}-B${String(b.booth_number).padStart(2, '0')}` : b.booth_code),
      booth_number: b.booth_number,
      in_meter_current_default: r?.in_meter ?? null,
      out_meter_current_default: r?.out_meter ?? null,
      // fix_3: prev = 当該店舗の直前confirmed cash_collection の in_meter_current
      in_meter_prev_default: prevMap?.[b.booth_code] ?? null,
    }
  })
  rows.sort((a, b) => {
    const aBO = mMap[a.machine_code]?.billing_order ?? 9999
    const bBO = mMap[b.machine_code]?.billing_order ?? 9999
    if (aBO !== bBO) return aBO - bBO
    return a.booth_code < b.booth_code ? -1 : a.booth_code > b.booth_code ? 1 : 0
  })
  return { data: rows, error: null }
}

// J-COLLECTION-05 fix_E: prev_date 以降の最古 meter_readings.in_meter を booth単位で返す。
//   prev_date 未指定時は当該店舗の直前confirmed cash_collections.collected_at を自動採用。
//   meter_readings 0件なら 直前confirmed cash_collection_booths.in_meter_current にフォールバック。
async function getPrevMeterAfterDate(storeCode, boothCodes, prevDate) {
  if (!storeCode || !boothCodes || boothCodes.length === 0) return {}

  // 1) effective prev_date を決める
  let effectivePrev = prevDate || null
  let latestCol = null
  if (!effectivePrev) {
    const { data } = await supabase.from('cash_collections')
      .select('collection_id, collected_at')
      .eq('store_code', storeCode).eq('status', 'confirmed')
      .order('collected_at', { ascending: false }).limit(1).maybeSingle()
    if (data) { effectivePrev = data.collected_at; latestCol = data }
  }
  if (!effectivePrev) return {}

  // 2) patrol_date >= effectivePrev の最古 in_meter を booth毎に取得
  const map = {}
  const { data: mr } = await supabase.from('meter_readings')
    .select('booth_code, in_meter, patrol_date, created_at')
    .in('booth_code', boothCodes)
    .eq('entry_type', 'patrol')
    .gte('patrol_date', effectivePrev)
    .order('patrol_date', { ascending: true })
    .order('created_at', { ascending: true })
  for (const r of mr ?? []) {
    if (!(r.booth_code in map) && r.in_meter != null) map[r.booth_code] = r.in_meter
  }

  // 3) fallback: meter_readings 0件のboothは confirmed cash_collection_booths.in_meter_current
  const remaining = boothCodes.filter(c => !(c in map))
  if (remaining.length > 0) {
    let colId = latestCol?.collection_id
    if (!colId) {
      const { data: c } = await supabase.from('cash_collections')
        .select('collection_id').eq('store_code', storeCode).eq('status', 'confirmed')
        .order('collected_at', { ascending: false }).limit(1).maybeSingle()
      colId = c?.collection_id
    }
    if (colId) {
      const { data: bts } = await supabase.from('cash_collection_booths')
        .select('booth_code, in_meter_current').eq('collection_id', colId).in('booth_code', remaining)
      for (const b of bts ?? []) {
        if (b.in_meter_current != null) map[b.booth_code] = b.in_meter_current
      }
    }
  }
  return map
}

// 前回集金日選択時: 当該店舗の指定日の集金から各ブースのprevメーターを取得
export async function getPrevCollectionMeters(storeCode, prevDate) {
  if (!storeCode || !prevDate) return { data: {}, error: null }
  const { data: col, error: e1 } = await supabase
    .from('cash_collections')
    .select('collection_id')
    .eq('store_code', storeCode)
    .eq('collected_at', prevDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e1) return { data: null, error: e1 }
  if (!col) return { data: {}, error: null } // 該当日の集金なし

  const { data: bts, error: e2 } = await supabase
    .from('cash_collection_booths')
    .select('booth_code, in_meter_current, out_meter_current')
    .eq('collection_id', col.collection_id)
  if (e2) return { data: null, error: e2 }

  const map = {}
  for (const b of bts ?? []) {
    map[b.booth_code] = { in_meter_prev: b.in_meter_current, out_meter_prev: b.out_meter_current }
  }
  return { data: map, error: null }
}

// 確定保存 (status=confirmed)。advance_payment / prev_collection_date 対応。
// J-COLLECTION-05: collectionId をUI側で事前生成して渡せるように対応(レシートupload pathと一致させる)。
// J-COLLECTION-09: 弊社署名 Storage URL/path を payload に追加 (cash_collections.staff_signature_url/path に保存)。
export async function saveCollection({
  storeCode, collectedAt, prevCollectionDate, collectedBy, collectedByName, booths, rowData, notes,
  collectionId: providedId,
  staffSignatureUrl: providedSigUrl, staffSignaturePath: providedSigPath,
  customerSignatureUrl: providedCustomerSigUrl,
  customerSignaturePath: providedCustomerSigPath,
  customerSignedAt: providedCustomerSignedAt,
}) {
  let collectionId = providedId
  if (!collectionId) {
    const { count } = await supabase.from('cash_collections')
      .select('collection_id', { count: 'exact', head: true })
      .eq('store_code', storeCode).eq('collected_at', collectedAt)
    const seq = (count ?? 0) + 1
    collectionId = genCollectionId(storeCode, collectedAt, seq)
  }
  const now = new Date().toISOString()

  const { error: e1 } = await supabase.from('cash_collections').insert({
    collection_id: collectionId,
    store_code: storeCode,
    collected_by: collectedBy || null,
    collected_at: collectedAt,
    prev_collection_date: prevCollectionDate || null,
    status: 'confirmed',
    notes: notes || null,
    organization_id: CHANGE_ORG_ID,
    created_at: now,
    updated_at: now,
    updated_by: collectedByName || null,
    // J-COLLECTION-09 fix_1: 弊社担当者署名 Storage URL/Path
    staff_signature_url: providedSigUrl || null,
    staff_signature_path: providedSigPath || null,
    // COLLECTION-SIGNATURE-REDESIGN-01 R1: 先方サイン (確定時同時保存)
    customer_signature_url: providedCustomerSigUrl || null,
    customer_signature_path: providedCustomerSigPath || null,
    customer_signed_at: providedCustomerSignedAt || null,
  })
  if (e1) return { data: null, error: e1 }

  const boothRows = booths.map(b => {
    const d = rowData[b.booth_code] || {}
    const c = d.counts || {}
    return {
      id: `${collectionId}-${b.booth_code}`,
      collection_id: collectionId,
      booth_code: b.booth_code,
      machine_code: b.machine_code,
      store_code: storeCode,
      bill_10000: Number(c.bill_10000) || 0,
      bill_5000: Number(c.bill_5000) || 0,
      bill_1000: Number(c.bill_1000) || 0,
      coin_500: Number(c.coin_500) || 0,
      coin_100: Number(c.coin_100) || 0,
      coin_50: Number(c.coin_50) || 0,
      in_meter_prev: d.in_meter_prev ?? null,
      in_meter_current: d.in_meter_current === '' || d.in_meter_current == null ? null : Number(d.in_meter_current),
      out_meter_prev: d.out_meter_prev ?? null,
      out_meter_current: d.out_meter_current === '' || d.out_meter_current == null ? null : Number(d.out_meter_current),
      advance_payment: Number(d.advance_payment) || 0,
      notes: d.notes && String(d.notes).trim() !== '' ? String(d.notes).trim() : null,
      receipt_photo_url: d.receipt_photo_url || null,
      receipt_photo_path: d.receipt_photo_path || null,
      created_at: now,
    }
  })
  const { error: e2 } = await supabase.from('cash_collection_booths').insert(boothRows)
  if (e2) return { data: null, error: e2 }

  // SPEC-ANOMALY-METER-P1-COLLECTION-AUDIT-01: 両 insert commit 後に fire-and-forget で監査。
  // await しない (保存応答をブロックしない)。auditCollectionMeters は内部で例外を握り潰す。
  auditCollectionMeters(collectionId)

  return { data: { collectionId }, error: null }
}

// 履歴一覧 (CollectionHistoryPage 用、変更なし)
export async function getCollectionHistory() {
  const { data: cols, error } = await supabase.from('cash_collections')
    .select('collection_id, store_code, collected_at, status, collected_by, signed_pdf_url, customer_signed_at')
    .order('collected_at', { ascending: false })
  if (error) return { data: null, error }
  const ids = (cols ?? []).map(c => c.collection_id)
  let totals = {}
  let storeNames = {}
  if (ids.length) {
    const { data: bts } = await supabase.from('cash_collection_booths')
      .select('collection_id, total').in('collection_id', ids)
    for (const b of bts ?? []) totals[b.collection_id] = (totals[b.collection_id] || 0) + Number(b.total || 0)
    const codes = [...new Set((cols ?? []).map(c => c.store_code))]
    const { data: stores } = await supabase.from('stores').select('store_code, store_name').in('store_code', codes)
    storeNames = Object.fromEntries((stores ?? []).map(s => [s.store_code, s.store_name]))
  }
  const rows = (cols ?? []).map(c => ({
    ...c,
    store_name: storeNames[c.store_code] || c.store_code,
    total: totals[c.collection_id] || 0,
  }))
  return { data: rows, error: null }
}

// PDF再表示用 詳細 (advance_payment / prev_collection_date 込み)
export async function getCollectionDetail(collectionId) {
  const { data: col, error } = await supabase.from('cash_collections')
    .select('*').eq('collection_id', collectionId).single()
  if (error) return { data: null, error }
  const { data: booths, error: e2 } = await supabase.from('cash_collection_booths')
    .select('*').eq('collection_id', collectionId)
  if (e2) return { data: null, error: e2 }

  // J-COLLECTION-13: 発行元を DB から resolve するため store.billing_entity_id を併取得
  const { data: store } = await supabase.from('stores')
    .select('store_name, store_name_official, billing_entity_id').eq('store_code', col.store_code).single()
  // 発行元 entity (company_name は NOT NULL、zip/address/tel/seal_image_path は NULL 許容)。
  // billing_entity_id が NULL の店舗は issuer なし扱い (fallback: PDF 側で company_name 行 skip まで含めて空ヘッダ)。
  // RLS 厳守、anon フィルタに organization_id を付けない (spec forbidden)。
  let issuer = null
  if (store?.billing_entity_id) {
    const { data: ent } = await supabase.from('billing_entities')
      .select('id, company_name, zip, address, tel, seal_image_path')
      .eq('id', store.billing_entity_id)
      .maybeSingle()
    issuer = ent ?? null
  }
  const codes = [...new Set((booths ?? []).map(b => b.machine_code))]
  const { data: machineData } = await supabase.from('machines')
    .select('machine_code, machine_name, machine_number').in('machine_code', codes.length ? codes : ['__none__'])
  const mMap = Object.fromEntries((machineData ?? []).map(m => [m.machine_code, m]))

  // ブース表示名 (booth_label / booth_number) 補完
  const boothCodes = (booths ?? []).map(b => b.booth_code)
  const { data: boothMaster } = await supabase.from('booths')
    .select('booth_code, booth_label, booth_number').in('booth_code', boothCodes.length ? boothCodes : ['__none__'])
  const bName = Object.fromEntries((boothMaster ?? []).map(b => [
    b.booth_code,
    b.booth_label || (b.booth_number != null ? `B${String(b.booth_number).padStart(2, '0')}` : b.booth_code),
  ]))

  const boothRows = (booths ?? []).map(b => {
    const m = mMap[b.machine_code] || {}
    return {
      ...b,
      machine_name: m.machine_name || b.machine_code,
      booth_name: bName[b.booth_code] || b.booth_code,
      // J-COLLECTION-03: rental_code = machine_number ?? machine_code 末尾セグメント
      rental_code: m.machine_number || (b.machine_code?.split('-').pop() ?? b.machine_code),
    }
  })
  const total = boothRows.reduce((s, b) => s + Number(b.total || 0), 0)
  const advanceTotal = boothRows.reduce((s, b) => s + Number(b.advance_payment || 0), 0)
  return {
    data: { collection: col, store: store ?? {}, booths: boothRows, total, advanceTotal, issuer },
    error: null,
  }
}

// J-COLLECTION-05: 撮影画像を Storage 'receipts' バケットにupload。upsertで再撮影上書き可。
//   path: '{org_id}/{collection_id}/{booth_code}.jpg'
//   返り値: { data:{path,url}, error }
export async function uploadReceiptPhoto({ collectionId, boothCode, fileBlob }) {
  if (!collectionId || !boothCode || !fileBlob) {
    return { data: null, error: new Error('uploadReceiptPhoto: missing args') }
  }
  const path = `${DFX_ORG_ID}/${collectionId}/${boothCode}.jpg`
  const { error: upErr } = await supabase.storage.from('receipts')
    .upload(path, fileBlob, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) return { data: null, error: upErr }
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
  return { data: { path, url: publicUrl }, error: null }
}

// J-COLLECTION-06: 先方署名済PDFを Storage に upsert + cash_collections の signed_pdf_* / customer_signed_at を UPDATE。
//   path: '{org_id}/{collection_id}/signed.pdf'
// J-COLLECTION-11: 任意で customer_signature_url / customer_signature_path も同 UPDATE で書き込む
//                  (先方署名の永続化、後続 PDF 再生成で署名画像を embed 可能に)。
//   返り値: { data:{path,url}, error }
export async function saveSignedPdf({
  collectionId, fileBlob,
  customerSigUrl: providedCustomerSigUrl,
  customerSigPath: providedCustomerSigPath,
}) {
  if (!collectionId || !fileBlob) {
    return { data: null, error: new Error('saveSignedPdf: missing args') }
  }
  const path = `${DFX_ORG_ID}/${collectionId}/signed.pdf`
  const { error: upErr } = await supabase.storage.from('receipts')
    .upload(path, fileBlob, { upsert: true, contentType: 'application/pdf' })
  if (upErr) return { data: null, error: upErr }
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
  const updatePayload = {
    signed_pdf_url: publicUrl,
    signed_pdf_path: path,
    customer_signed_at: new Date().toISOString(),
  }
  if (providedCustomerSigUrl) updatePayload.customer_signature_url = providedCustomerSigUrl
  if (providedCustomerSigPath) updatePayload.customer_signature_path = providedCustomerSigPath
  const { error: updErr } = await supabase.from('cash_collections')
    .update(updatePayload)
    .eq('collection_id', collectionId)
  if (updErr) return { data: null, error: updErr }

  // J-COLLECTION-FLAG-REDESIGN-01 Phase 2: 先方署名確定で 当該店舗の patrol_date <= collected_at の
  // 未集金 meter_readings を自動で is_collected=true + flagged_at=collected_at に更新。
  // Supabase JS client は cross-table tx 非対応のため sequential update (PDF + cash_collections 成功後)。
  // 失敗してもユーザー操作は続行 (warn only)、後で手動 集金フラグ編集 で復旧可能。
  try {
    const { data: col } = await supabase.from('cash_collections')
      .select('store_code, collected_at')
      .eq('collection_id', collectionId)
      .single()
    if (col?.store_code && col?.collected_at) {
      const collectedDateJst = new Date(col.collected_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      // is_collected IS NOT true (= null or false) のみ更新
      await supabase.from('meter_readings')
        .update({ is_collected: true, flagged_at: col.collected_at })
        .eq('store_code', col.store_code)
        .eq('entry_type', 'patrol')
        .lte('patrol_date', collectedDateJst)
        .or('is_collected.is.null,is_collected.eq.false')
    }
  } catch (autoFlagErr) {
    // 自動フラグ失敗は 署名確定の主成功を打ち消さない (J-COLLECTION-FLAG-REDESIGN-01 spec の許容)
    console.warn('J-COLLECTION-FLAG-REDESIGN-01 auto-flag warn:', autoFlagErr)
  }

  return { data: { path, url: publicUrl }, error: null }
}

// J-COLLECTION-09: 担当者署名(dataURL)を Storage 'receipts' へ PNG として upsert する内部 helper。
// J-COLLECTION-11: 先方署名も同じ経路を再利用するため _uploadSignature に抽出し、
//                  uploadStaffSignature / uploadCustomerSignature は薄い wrapper。
async function _uploadSignature({ collectionId, dataUrl, fileName }) {
  if (!collectionId || !dataUrl || !fileName) {
    return { data: null, error: new Error('_uploadSignature: missing args') }
  }
  // dataURL → Blob (画像圧縮は行わない、署名線が劣化するため raw PNG のまま保存)
  let blob
  try {
    const res = await fetch(dataUrl)
    blob = await res.blob()
  } catch (e) {
    return { data: null, error: e }
  }
  const path = `${DFX_ORG_ID}/${collectionId}/${fileName}`
  const { error: upErr } = await supabase.storage.from('receipts')
    .upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (upErr) return { data: null, error: upErr }
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
  return { data: { path, url: publicUrl }, error: null }
}

// 弊社担当者署名 upload (path: '{org_id}/{collection_id}/staff_sig.png')
export async function uploadStaffSignature({ collectionId, dataUrl }) {
  return _uploadSignature({ collectionId, dataUrl, fileName: 'staff_sig.png' })
}

// J-COLLECTION-11: 先方担当者署名 upload (path: '{org_id}/{collection_id}/customer_sig.png')
// spec forbidden: 別経路新設禁止 → 内部は staff と同一の _uploadSignature を再利用。
export async function uploadCustomerSignature({ collectionId, dataUrl }) {
  return _uploadSignature({ collectionId, dataUrl, fileName: 'customer_sig.png' })
}

// J-COLLECTION-09 fix_4: レシート写真を Storage から削除。
//   path 必須 (cash_collection_booths.receipt_photo_path の値)。
//   返り値: { error } のみ。
export async function deleteReceiptPhoto({ path }) {
  if (!path) return { error: new Error('deleteReceiptPhoto: missing path') }
  const { error } = await supabase.storage.from('receipts').remove([path])
  return { error }
}

// J-COLLECTION-05: 保存前にcollectionIdを先取り(レシートupload pathに必要)
export async function nextCollectionId(storeCode, collectedAt) {
  const { count } = await supabase.from('cash_collections')
    .select('collection_id', { count: 'exact', head: true })
    .eq('store_code', storeCode).eq('collected_at', collectedAt)
  return genCollectionId(storeCode, collectedAt, (count ?? 0) + 1)
}

export { boothTotal }
