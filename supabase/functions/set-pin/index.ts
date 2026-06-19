// SPEC-STAFF-INVITE-S4-PIN-SETUP-01: set-pin Edge Function (stage 4/5)
// pin生値/token生値はログ出力禁止。pgcrypto crypt()はDB側RPC経由。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_AUTH_SALT = Deno.env.get('APP_AUTH_SALT')

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

// verify-pinと同一のpassword導出ロジック
async function derivePassword(staffId: string, createdAt: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${staffId}:${createdAt}:${salt}`)
  )
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

function legacyPassword(staffId: string, serviceKey: string): string {
  return `clawops_${staffId}_${serviceKey.slice(-8)}`
}

async function issueSession(db: ReturnType<typeof createClient>, email: string, password: string) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    throw error ?? new Error('[set-pin] session null after signInWithPassword')
  }
  return { session: data.session, user: data.user }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { token, pin, name, phone } = body as {
      token?: string; pin?: string; name?: string; phone?: string
    }

    // Step 1: バリデーション (pin生値はここ以降ログ禁止)
    if (!token) return json({ error: 'token required' }, 400)
    if (!pin || !/^\d{4}$/.test(pin)) return json({ error: 'pin must be 4 digits' }, 400)

    const tokenHash = await sha256Hex(token)
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Step 2: token照合 (verify-inviteと同一判定、列挙攻撃防止で一律401)
    const { data: invite, error: inviteErr } = await db
      .from('staff_invites')
      .select('id, staff_id, expires_at, consumed_at')
      .eq('token_hash', tokenHash)
      .single()

    if (inviteErr || !invite) return json({ error: 'invalid_or_expired' }, 401)
    if (invite.consumed_at !== null) return json({ error: 'invalid_or_expired' }, 401)
    if (new Date() > new Date(invite.expires_at)) return json({ error: 'invalid_or_expired' }, 401)

    const staffId = invite.staff_id as string

    // Step 3: pgcrypto crypt()でpin_hash保存 (DB側RPCでハッシュ化、pin生値は関数外に出ない)
    const { error: pinUpdateErr } = await db.rpc('set_staff_pin', {
      p_staff_id: staffId,
      p_pin: pin,
    })
    if (pinUpdateErr) {
      console.error('[ERR-SET-PIN] pin update failed:', pinUpdateErr.message)
      return json({ error: 'pin update failed' }, 500)
    }

    // Step 4: name/phone のみ UPDATE (R4 readonly項目は一切書かない)
    {
      const updates: Record<string, string> = {}
      if (typeof name === 'string' && name.trim()) updates.name = name.trim()
      if (typeof phone === 'string') updates.phone = phone.trim()
      if (Object.keys(updates).length > 0) {
        const { error: profileErr } = await db.from('staff').update(updates).eq('staff_id', staffId)
        if (profileErr) {
          console.error('[ERR-SET-PIN] profile update failed:', profileErr.message)
          // non-fatal: pin保存済みなので続行
        }
      }
    }

    // Step 5: consumed_at セット (session発行より前。token再使用禁止優先)
    await db.from('staff_invites')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Step 6: staff情報取得 (sessionのpassword導出にcreated_atが必要)
    const { data: staffRow, error: staffErr } = await db
      .from('staff')
      .select('staff_id, name, name_kana, role, operator_id, store_code, created_at')
      .eq('staff_id', staffId)
      .single()

    if (staffErr || !staffRow) {
      console.error('[ERR-SET-PIN] staff fetch failed:', staffErr?.message)
      return json({ error: 'staff fetch failed' }, 500)
    }

    const email = `${staffId.toLowerCase()}@clawops.local`
    const newMeta = {
      staff_id: staffRow.staff_id,
      name: staffRow.name,
      role: staffRow.role,
      operator_id: staffRow.operator_id,
      store_code: staffRow.store_code,
    }

    // Step 7: session発行 (verify-pinと同一方式: APP_AUTH_SALT優先、なければlegacy)
    let session: any = null

    if (APP_AUTH_SALT && staffRow.created_at) {
      const newPassword = await derivePassword(staffId, staffRow.created_at, APP_AUTH_SALT)
      try {
        const { session: s, user } = await issueSession(db, email, newPassword)
        session = s
        const existingMeta = user?.user_metadata || {}
        const metaChanged = existingMeta.role !== newMeta.role || existingMeta.name !== newMeta.name
        if (metaChanged) {
          await db.auth.admin.updateUserById(user.id, {
            user_metadata: newMeta,
            app_metadata: { staff_id: staffId, role: staffRow.role, salt_version: 'v2' },
          })
          const { session: fresh } = await issueSession(db, email, newPassword)
          session = fresh
        }
      } catch {
        // auth.user未存在(新規スタッフ)→createUser
        const { error: createErr } = await db.auth.admin.createUser({
          email,
          password: newPassword,
          email_confirm: true,
          user_metadata: newMeta,
          app_metadata: { staff_id: staffId, role: staffRow.role, salt_version: 'v2' },
        })
        if (createErr) {
          console.error('[ERR-SET-PIN] createUser failed:', createErr.message)
          return json({ error: 'session issuance failed' }, 500)
        }
        const { session: fresh } = await issueSession(db, email, newPassword)
        session = fresh
      }
    } else {
      const password = legacyPassword(staffId, SERVICE_ROLE_KEY)
      try {
        const { session: s } = await issueSession(db, email, password)
        session = s
      } catch {
        const { error: createErr } = await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: newMeta,
          app_metadata: { staff_id: staffId, role: staffRow.role },
        })
        if (createErr) {
          console.error('[ERR-SET-PIN] createUser (legacy) failed:', createErr.message)
          return json({ error: 'session issuance failed' }, 500)
        }
        const { session: fresh } = await issueSession(db, email, password)
        session = fresh
      }
    }

    if (!session?.access_token) {
      console.error('[ERR-SET-PIN] session.access_token falsy')
      return json({ error: 'session issuance failed' }, 500)
    }

    return json({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
      staff: {
        staff_id: staffRow.staff_id,
        name: staffRow.name,
        role: staffRow.role,
      },
    })
  } catch (e) {
    console.error('[ERR-SET-PIN] unexpected:', (e as Error).message)
    return json({ error: 'Internal error' }, 500)
  }
})
