// SPEC-STAFF-INVITE-S2-SEND-EDGE-01: send-invite Edge Function (stage 2/5)
// token生値はレスポンス/DB/ログ一切禁止。SHA-256ハッシュのみ保存。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GMAIL_SMTP_USER = Deno.env.get('GMAIL_SMTP_USER') ?? ''
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
const INVITE_BASE_URL = 'https://dfx.round-0.com/invite'

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

async function generateToken(): Promise<{ raw: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return { raw, hash }
}

// sendInviteEmail: 着脱可能に隔離。将来 Gmail API / 外部リレーに差し替え可。
async function sendInviteEmail(email: string, link: string, staffName: string): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 587,
      tls: true,
      auth: { username: GMAIL_SMTP_USER, password: GMAIL_APP_PASSWORD },
    },
  })
  await client.send({
    from: GMAIL_SMTP_USER,
    to: email,
    subject: 'Round-0 スタッフ招待',
    content: `${staffName} さん\n\nRound-0 スタッフとして招待されました。\n以下のリンクからPINを設定してください（7日間有効）。\n\n${link}\n\nこのメールに心当たりがない場合は無視してください。`,
  })
  await client.close()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // verify_jwt=true でSupabaseがJWT検証済み。ユーザー情報を取得。
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    // admin限定(招待発行は管理者のみ)
    const role = (user.user_metadata?.role ?? user.app_metadata?.role) as string | undefined
    if (role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const { staff_id } = body as { staff_id?: string }
    if (!staff_id) return json({ error: 'staff_id required' }, 400)

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // staff SELECT (email取得)
    const { data: staffRow, error: staffErr } = await db
      .from('staff')
      .select('staff_id, name, email')
      .eq('staff_id', staff_id)
      .single()
    if (staffErr || !staffRow) return json({ error: 'staff not found' }, 400)
    if (!staffRow.email) return json({ error: 'email未登録' }, 400)

    const callerStaffId = (user.user_metadata?.staff_id ?? null) as string | null

    // token生成 — 生値は本スコープ内にのみ存在、外部流出禁止
    const { raw: tokenRaw, hash: tokenHash } = await generateToken()

    // 同一staffの既存未消費招待を失効(二重有効防止)
    const { error: expireErr } = await db
      .from('staff_invites')
      .update({ consumed_at: new Date().toISOString() })
      .eq('staff_id', staff_id)
      .is('consumed_at', null)
    if (expireErr) {
      console.error('[ERR-SEND-INVITE] expire old invites:', expireErr.message)
    }

    // staff_invites INSERT
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error: insertErr } = await db
      .from('staff_invites')
      .insert({ staff_id, token_hash: tokenHash, expires_at: expiresAt, created_by: callerStaffId })
    if (insertErr) {
      console.error('[ERR-SEND-INVITE] insert failed:', insertErr.message)
      return json({ error: 'DB error' }, 500)
    }

    // メール送信 — link に生値tokenを埋め込み、sendInviteEmail 外に出さない
    const link = `${INVITE_BASE_URL}?token=${tokenRaw}`
    try {
      await sendInviteEmail(staffRow.email as string, link, staffRow.name as string)
    } catch (mailErr) {
      // SMTP失敗 → INSERTしたtokenを即失効(有効なtokenを宙ぶらりにしない)
      console.error('[ERR-SEND-INVITE] smtp error:', (mailErr as Error).message)
      await db
        .from('staff_invites')
        .update({ consumed_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
      return json({ error: 'メール送信失敗' }, 500)
    }

    // token生値はレスポンスに含めない
    return json({ ok: true })
  } catch (e) {
    console.error('[ERR-SEND-INVITE] unexpected:', (e as Error).message)
    return json({ error: 'Internal error' }, 500)
  }
})
