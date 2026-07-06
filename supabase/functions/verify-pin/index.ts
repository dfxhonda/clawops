import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { throttleDelaySec, isStaffNotFound, failsSinceLastSuccess, writeAuthLog } from "./throttle.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// SPEC-AUTH-VERIFYPIN-TIMELOCK-01: single generic auth-failure message for BOTH wrong-PIN
// and unknown/inactive staff, so the response never leaks staff existence or lock state.
const AUTH_FAIL_MSG = '暗証番号が違います';

// R1: 決定的password導出 — staff_id + created_at + APP_AUTH_SALT (service_role_key非依存)
async function derivePassword(staffId: string, createdAt: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${staffId}:${createdAt}:${salt}`)
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

// R1: 旧方式 (service_role_key末8桁依存) — fallback/migration用
function legacyPassword(staffId: string, serviceKey: string): string {
  return `clawops_${staffId}_${serviceKey.slice(-8)}`;
}

// R2: signInWithPassword を単一ヘルパーに集約 — session null時はthrow
async function issueSession(supabaseAdmin: any, email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw error ?? new Error('[verify-pin] session null after signInWithPassword');
  }
  return { session: data.session, user: data.user };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ウォームアップ用GETリクエスト (cronから呼ばれる)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { staff_id, pin } = await req.json();

    // SPEC-LOGIN-UPDATE-PREFETCH-01: POST warmup識別。auth_logs汚染防止のため即200返し。
    if (staff_id === '__warmup__') {
      return new Response(JSON.stringify({ ok: true, warmup: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!staff_id) {
      return new Response(
        JSON.stringify({ error: 'staff_id は必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceKey = Deno.env.get('CLAWOPS_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const APP_AUTH_SALT = Deno.env.get('APP_AUTH_SALT');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    type VerifyResult = {
      success: boolean;
      staff_id: string;
      name: string;
      role: string;
      operator_id: string;
      store_code: string;
      created_at?: string;
      error?: string;
    };

    let verifyResult: VerifyResult | null = null;

    const { data, error: rpcError } = await supabaseAdmin
      .rpc('verify_staff_pin', { p_staff_id: staff_id, p_pin: pin || '' });

    if (rpcError) {
      console.error('[verify-pin] RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'サーバーエラーが発生しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data?.success) {
      // SPEC-AUTH-VERIFYPIN-TIMELOCK-01
      // Enumeration-safe: unknown / inactive staff -> identical generic 401, NO auth_logs row.
      if (isStaffNotFound(data?.error)) {
        return new Response(
          JSON.stringify({ error: AUTH_FAIL_MSG }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Wrong PIN on an existing staff: rolling-window (60min) failure count since the last
      // login_success -> capped exponential TIME LOCK, enforced in the function runtime on the
      // FAILED path only (a correct PIN is never delayed; throttle slows guessing, not success).
      const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from('auth_logs')
        .select('action, created_at')
        .eq('staff_id', staff_id)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(100);
      const attemptNumber = failsSinceLastSuccess(recent ?? []) + 1;
      const delaySec = throttleDelaySec(attemptNumber);
      if (delaySec > 0) {
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
      }
      // SPEC-AUTH-AUTHLOGS-WAITUNTIL-AWAIT-01: awaited (so the next attempt's rolling-window
      // count includes it) + try/catch inside writeAuthLog (a log failure must not turn the
      // 401 into a 500).
      await writeAuthLog(supabaseAdmin, {
        staff_id: staff_id,
        action: 'login_failed',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
      return new Response(
        JSON.stringify({ error: AUTH_FAIL_MSG }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    verifyResult = data;

    // R1: APP_AUTH_SALT方式使用時はcreated_atを別途取得
    if (APP_AUTH_SALT) {
      const { data: staffRow } = await supabaseAdmin
        .from('staff')
        .select('created_at')
        .eq('staff_id', staff_id)
        .single();
      if (staffRow?.created_at) verifyResult!.created_at = staffRow.created_at;
    }

    const email = `${staff_id.toLowerCase()}@clawops.local`;
    const newMeta = {
      staff_id: verifyResult!.staff_id,
      name: verifyResult!.name,
      role: verifyResult!.role,
      operator_id: verifyResult!.operator_id,
      store_code: verifyResult!.store_code,
    };

    let session: any = null;

    if (APP_AUTH_SALT && verifyResult!.created_at) {
      // R1: APP_AUTH_SALT方式 — service_role_key非依存
      const newPassword = await derivePassword(verifyResult!.staff_id, verifyResult!.created_at, APP_AUTH_SALT);
      const oldPassword = legacyPassword(verifyResult!.staff_id, serviceKey);

      try {
        // 新passwordでsignIn (移行済みユーザー)
        const { session: s, user } = await issueSession(supabaseAdmin, email, newPassword);
        session = s;

        // metaChanged確認 (移行済みユーザーのみ)
        const existingMeta = user?.user_metadata || {};
        const metaChanged =
          existingMeta.role !== newMeta.role ||
          existingMeta.name !== newMeta.name ||
          existingMeta.store_code !== newMeta.store_code ||
          existingMeta.operator_id !== newMeta.operator_id;

        if (metaChanged) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: newMeta,
            app_metadata: { staff_id: verifyResult!.staff_id, role: verifyResult!.role, salt_version: 'v2' },
          });
          const { session: fresh } = await issueSession(supabaseAdmin, email, newPassword);
          session = fresh;
        }
      } catch {
        // R1: 旧passwordで試行 → issueSession経由で例外ハンドリング統一
        let migrationDone = false;
        try {
          const { user: oldUser } = await issueSession(supabaseAdmin, email, oldPassword);
          // 旧→新移行 (一度だけ走る) + salt_version:'v2' を app_metadata に付与
          await supabaseAdmin.auth.admin.updateUserById(oldUser.id, {
            password: newPassword,
            user_metadata: newMeta,
            app_metadata: { staff_id: verifyResult!.staff_id, role: verifyResult!.role, salt_version: 'v2' },
          });
          const { session: fresh } = await issueSession(supabaseAdmin, email, newPassword);
          session = fresh;
          migrationDone = true;
        } catch {
          // 旧passwordも失敗 → 新規ユーザー
        }
        if (!migrationDone) {
          // 新規ユーザー → createUser + salt_version:'v2'
          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: newPassword,
            email_confirm: true,
            user_metadata: newMeta,
            app_metadata: { staff_id: verifyResult!.staff_id, role: verifyResult!.role, salt_version: 'v2' },
          });
          if (createError) {
            console.error('[verify-pin] createUser error:', createError);
            return new Response(
              JSON.stringify({ error: 'ユーザー作成に失敗しました' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const { session: fresh } = await issueSession(supabaseAdmin, email, newPassword);
          session = fresh;
        }
      }
    } else {
      // Fallback: APP_AUTH_SALT未設定 → 旧方式 (ロックアウト防止)
      // R1: issueSession経由で例外ハンドリング統一
      const password = legacyPassword(verifyResult!.staff_id, serviceKey);

      let fallbackDone = false;
      try {
        const { session: s, user } = await issueSession(supabaseAdmin, email, password);
        session = s;
        fallbackDone = true;
        const existingMeta = user?.user_metadata || {};
        const metaChanged =
          existingMeta.role !== newMeta.role ||
          existingMeta.name !== newMeta.name ||
          existingMeta.store_code !== newMeta.store_code ||
          existingMeta.operator_id !== newMeta.operator_id;
        if (metaChanged) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: newMeta,
            app_metadata: { staff_id: verifyResult!.staff_id, role: verifyResult!.role },
          });
          const { session: fresh } = await issueSession(supabaseAdmin, email, password);
          session = fresh;
        }
      } catch {
        // signIn失敗 → 新規ユーザー (fallback)
      }
      if (!fallbackDone) {
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: newMeta,
          app_metadata: { staff_id: verifyResult!.staff_id, role: verifyResult!.role },
        });
        if (createError) {
          console.error('[verify-pin] createUser error (fallback):', createError);
          return new Response(
            JSON.stringify({ error: 'ユーザー作成に失敗しました' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { session: fresh } = await issueSession(supabaseAdmin, email, password);
        session = fresh;
      }
    }

    // R3: session null guard — access_token falsyなら500 (沈黙スルー廃止)
    if (!session?.access_token) {
      console.error('[verify-pin] session.access_token falsy', { staff_id, salt_mode: !!APP_AUTH_SALT });
      return new Response(
        JSON.stringify({ error: 'セッション発行に失敗しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SPEC-AUTH-AUTHLOGS-WAITUNTIL-AWAIT-01: awaited before the 200. waitUntil was dropped on
    // isolate shutdown, so login_success never persisted -> throttle's reset point was missing
    // and failure counts would accumulate forever. try/catch: log failure never breaks login.
    await writeAuthLog(supabaseAdmin, {
      staff_id: verifyResult!.staff_id,
      action: 'login_success',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return new Response(
      JSON.stringify({
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        staff: {
          staff_id: verifyResult!.staff_id,
          name: verifyResult!.name,
          role: verifyResult!.role,
          operator_id: verifyResult!.operator_id,
          store_code: verifyResult!.store_code,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[verify-pin] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: '予期しないエラーが発生しました' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
