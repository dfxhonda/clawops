// J-DEV-ASSET-HANDOFF-01: dev_assets テーブル + 'dev-assets' private Storage bucket のアクセス層。
// 開発資産 (PNG / xlsx / pdf 等) を bytes 完全保持で受け渡しする目的の管理 UI 用。
// forbidden (per spec):
//   - NO byte transform on upload (raw File をそのまま upload、再エンコード禁止)
//   - NO org_id filter (RLS で admin/manager 制御済み、anon フィルタは付けない)
// DB と bucket は commander が事前作成済み、code only。

import { supabase } from '../lib/supabase'

/**
 * 端末で SHA-256 を計算 (Web Crypto API)。
 * @param {File|Blob|ArrayBuffer} input
 * @returns {Promise<string>} lowercase hex (64 chars)
 */
export async function computeSha256(input) {
  let buf
  if (input instanceof ArrayBuffer) buf = input
  else if (typeof input?.arrayBuffer === 'function') buf = await input.arrayBuffer()
  else throw new Error('computeSha256: unsupported input')
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(hashBuf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

// Storage path: '{yyyy-mm-dd-JST}/{uuid-stamp}/{original_filename}'
// JST 日付は toLocaleDateString('sv-SE', timeZone: 'Asia/Tokyo') で得る (toISOString JST 禁止 per spec)。
function makeStoragePath(originalFilename) {
  const jstDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) // yyyy-mm-dd
  const stamp = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const safe = String(originalFilename || 'file.bin').replace(/[^\w.\-]+/g, '_')
  return `${jstDate}/${stamp}/${safe}`
}

/**
 * 1 ファイル upload + dev_assets row insert。
 * raw File を変換せず Storage に upsert なしで put (再エンコード禁止 spec)。
 * @returns {Promise<{ data:{id,storage_path,sha256}|null, error:Error|null }>}
 */
// fix-01: staffName → staffId に置換。dev_assets.uploaded_by の FK は staff(staff_id) text。
//   display name (staffName) を渡していた DIAG-01 の root cause を解消、canonical な useAuth().staffId を使う。
export async function uploadDevAsset({ file, label, fileType, purpose, staffId }) {
  if (!file || !label) return { data: null, error: new Error('uploadDevAsset: missing file or label') }
  const sha = await computeSha256(file)
  const path = makeStoragePath(file.name)
  const { error: upErr } = await supabase.storage.from('dev-assets').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })
  if (upErr) return { data: null, error: upErr }
  const { data: row, error: insErr } = await supabase.from('dev_assets').insert({
    label: String(label),
    file_type: fileType || null,
    purpose: purpose || null,
    storage_path: path,
    original_filename: file.name || null,
    mime_type: file.type || null,
    byte_size: file.size ?? null,
    sha256: sha,
    uploaded_by: staffId || null, // fix-01: staff.staff_id FK (NOT staff name)、未解決時は null (DB nullable)
  }).select('id, storage_path, sha256').single()
  if (insErr) {
    // orphan 掃除 (best-effort)
    await supabase.storage.from('dev-assets').remove([path]).catch(() => {})
    return { data: null, error: insErr }
  }
  return { data: row, error: null }
}

/** 一覧 fetch (新しい順、RLS で admin/manager のみ row 返却)。 */
export async function listDevAssets() {
  const { data, error } = await supabase.from('dev_assets')
    .select('id, label, file_type, purpose, original_filename, mime_type, byte_size, sha256, status, uploaded_by, created_at, storage_path')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

/** 署名付き DL URL (private bucket、expires は秒単位、default 60s)。 */
export async function getDevAssetSignedUrl(storagePath, expiresInSec = 60) {
  if (!storagePath) return { data: null, error: new Error('getDevAssetSignedUrl: missing path') }
  const { data, error } = await supabase.storage.from('dev-assets').createSignedUrl(storagePath, expiresInSec)
  return { data, error }
}

/** Storage object + dev_assets row 削除。Storage 失敗時でも DB 行は試行的に削除する。 */
export async function deleteDevAsset({ id, storagePath }) {
  if (!id) return { error: new Error('deleteDevAsset: missing id') }
  if (storagePath) {
    await supabase.storage.from('dev-assets').remove([storagePath]).catch(() => {})
  }
  const { error } = await supabase.from('dev_assets').delete().eq('id', id)
  return { error }
}
