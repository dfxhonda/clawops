// ロッカー投入ダイアログからのprize_masters即時作成
// SPEC-LOCKER-HIGHVALUE-PHASE1-01: 手入力+画像保存フロー
import { supabase } from '../lib/supabase'
import { CHANGE_ORG_ID } from '../lib/auth/orgConstants'
import { writeAuditLog } from './audit'

/**
 * ロッカー投入ダイアログ内で景品マスタを新規作成する。
 * 画像ファイルが渡された場合は announcements バケットにアップロードし image_url を設定。
 * JANコードは後差し(phase外)のため未設定。
 *
 * @param {{ name: string, value?: number, imageFile?: File|null, staffId?: string|null }} opts
 * @returns {Promise<{ prize_id: string, prize_name: string, original_cost: number, image_url: string|null }>}
 */
export async function createLockerPrizeMaster({ name, value = 0, imageFile = null, staffId = null }) {
  const prizeId = crypto.randomUUID()
  let imageUrl = null

  if (imageFile) {
    const ext = imageFile.type?.includes('png') ? 'png' : 'jpg'
    const path = `locker-prizes/${prizeId}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('announcements')
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type || 'image/jpeg' })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('announcements').getPublicUrl(path)
      imageUrl = publicUrl
    }
  }

  const { data, error } = await supabase
    .from('prize_masters')
    .insert({
      prize_id: prizeId,
      prize_name: name.trim(),
      original_cost: parseInt(value) || 0,
      image_url: imageUrl,
      organization_id: CHANGE_ORG_ID,
      phase: 'active',
    })
    .select('prize_id, prize_name, original_cost, image_url')
    .single()

  if (error) throw new Error('景品マスタ作成エラー: ' + error.message)

  writeAuditLog({
    action: 'master_create',
    target_table: 'prize_masters',
    target_id: prizeId,
    detail: `ロッカー投入時マスタ登録: ${name}`,
    staff_id: staffId || '',
  })

  return data
}
