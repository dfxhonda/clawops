// SPEC-STAFF-INVITE-S3-TOKEN-RECEIVE-01: verify-invite Edge Function (stage 3/5)
// token生値はログ出力禁止。SHA-256ハッシュのみでDB照合。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(raw: string): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { token } = body as { token?: string }
    if (!token) return json({ error: 'token required' }, 400)

    const tokenHash = await sha256Hex(token)

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // token生値はこのスコープ内にのみ存在。hashのみでDB照合。
    const { data: invite, error: inviteErr } = await db
      .from('staff_invites')
      .select('id, staff_id, expires_at, consumed_at')
      .eq('token_hash', tokenHash)
      .single()

    // 不在 / 照合エラー → 一律401 (列挙攻撃防止: 理由を区別しない)
    if (inviteErr || !invite) {
      return json({ error: 'invalid_or_expired' }, 401)
    }

    // 消費済み
    if (invite.consumed_at !== null) {
      return json({ error: 'invalid_or_expired' }, 401)
    }

    // 期限切れ
    const now = new Date()
    const expiresAt = new Date(invite.expires_at)
    if (now > expiresAt) {
      return json({ error: 'invalid_or_expired' }, 401)
    }

    // staff情報取得 (pin_hash / pin は含めない)
    const { data: staffRow, error: staffErr } = await db
      .from('staff')
      .select('staff_id, name, name_kana, email, phone, role, store_code, joined_at, has_pin, is_active')
      .eq('staff_id', invite.staff_id)
      .single()

    if (staffErr || !staffRow) {
      console.error('[ERR-VERIFY-INVITE] staff not found:', staffErr?.message)
      return json({ error: 'invalid_or_expired' }, 401)
    }

    // session発行禁止 / consumed_at更新禁止。staff情報のみ返却。
    return json({ ok: true, staff: staffRow, staff_id: invite.staff_id })
  } catch (e) {
    console.error('[ERR-VERIFY-INVITE] unexpected:', (e as Error).message)
    return json({ error: 'Internal error' }, 500)
  }
})
