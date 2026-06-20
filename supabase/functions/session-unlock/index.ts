import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// JWT payload decode (署名検証なし = 期限切れトークンでも動作)
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return JSON.parse(atob(padded));
}

// base64 または base64url → Uint8Array
function base64ToUint8Array(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// verify-pinと同一: APP_AUTH_SALT方式 deterministic password
async function derivePassword(staffId: string, createdAt: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${staffId}:${createdAt}:${salt}`)
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

function legacyPassword(staffId: string, serviceKey: string): string {
  return `clawops_${staffId}_${serviceKey.slice(-8)}`;
}

async function issueSession(admin: ReturnType<typeof createClient>, email: string, password: string) {
  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw error ?? new Error('[session-unlock] session null');
  return data.session;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { staff_id, current_access_token, auth_method, webauthn_assertion, webauthn_challenge, pin } =
      await req.json();

    if (!staff_id || !current_access_token || !auth_method) {
      return new Response(JSON.stringify({ error: 'staff_id, current_access_token, auth_method は必須です' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: JWT decode (期限切れ可、署名検証不要)
    let tokenPayload: Record<string, unknown>;
    try {
      tokenPayload = decodeJwtPayload(current_access_token);
    } catch {
      return new Response(JSON.stringify({ error: 'current_access_token のデコードに失敗しました' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // staff_id と token の app_metadata.staff_id 整合確認
    const tokenStaffId = (tokenPayload?.app_metadata as Record<string, unknown>)?.staff_id;
    if (!tokenStaffId || tokenStaffId !== staff_id) {
      return new Response(JSON.stringify({ error: '認証情報が一致しません' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceKey = Deno.env.get('CLAWOPS_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const APP_AUTH_SALT = Deno.env.get('APP_AUTH_SALT');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const WEBAUTHN_RPID = Deno.env.get('WEBAUTHN_RPID') ?? '';

    const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 2: 本人検証
    if (auth_method === 'webauthn') {
      if (!webauthn_assertion) {
        return new Response(JSON.stringify({ error: 'webauthn_assertion は必須です' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const credentialId: string = webauthn_assertion.id;
      const { data: credRow, error: credError } = await supabaseAdmin
        .from('staff_credentials')
        .select('id, public_key, sign_count, credential_id')
        .eq('staff_id', staff_id)
        .eq('credential_id', credentialId)
        .single();

      if (credError || !credRow) {
        return new Response(JSON.stringify({ error: '登録済み passkey が見つかりません' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // challenge: 外部提供優先。未提供時は clientDataJSON から抽出 (S2実装前の暫定)
      let expectedChallenge: string;
      if (webauthn_challenge) {
        expectedChallenge = webauthn_challenge;
      } else {
        try {
          const clientData = JSON.parse(atob(
            (webauthn_assertion.response.clientDataJSON as string).replace(/-/g, '+').replace(/_/g, '/')
          ));
          expectedChallenge = clientData.challenge;
        } catch {
          return new Response(JSON.stringify({ error: 'clientDataJSON のデコードに失敗しました' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const origin = req.headers.get('origin') || `https://${WEBAUTHN_RPID}`;
      const rpID = WEBAUTHN_RPID || new URL(origin).hostname;

      let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
      try {
        verification = await verifyAuthenticationResponse({
          response: webauthn_assertion,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          authenticator: {
            credentialID: credRow.credential_id,
            credentialPublicKey: base64ToUint8Array(credRow.public_key),
            counter: credRow.sign_count,
          },
        });
      } catch (e) {
        console.error('[session-unlock] WebAuthn verify error:', e);
        return new Response(JSON.stringify({ error: 'passkey 検証に失敗しました' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!verification.verified) {
        return new Response(JSON.stringify({ error: 'passkey 検証に失敗しました' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // sign_count 逆行チェック (複製端末検知)
      const newCounter = verification.authenticationInfo.newCounter;
      if (newCounter <= credRow.sign_count && credRow.sign_count > 0) {
        console.error('[session-unlock] sign_count rollback detected', {
          staff_id, stored: credRow.sign_count, received: newCounter,
        });
        return new Response(JSON.stringify({ error: 'passkey の複製が検出されました (sign_count逆行)' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // sign_count + last_used_at 更新
      await supabaseAdmin
        .from('staff_credentials')
        .update({ sign_count: newCounter, last_used_at: new Date().toISOString() })
        .eq('id', credRow.id);

    } else if (auth_method === 'pin') {
      if (!pin) {
        return new Response(JSON.stringify({ error: 'pin は必須です' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: pinResult, error: rpcError } = await supabaseAdmin
        .rpc('verify_staff_pin', { p_staff_id: staff_id, p_pin: pin });

      if (rpcError) {
        console.error('[session-unlock] verify_staff_pin error:', rpcError);
        return new Response(JSON.stringify({ error: 'サーバーエラーが発生しました' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!pinResult?.success) {
        EdgeRuntime.waitUntil(supabaseAdmin.from('auth_logs').insert({
          staff_id,
          action: 'session_unlock_pin_failed',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        }));
        return new Response(JSON.stringify({ error: 'PINが正しくありません' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

    } else {
      return new Response(JSON.stringify({ error: 'auth_method は webauthn または pin です' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: 新セッション発行 (verify-pinと同一: APP_AUTH_SALT deterministic password)
    const { data: staffRow, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('staff_id, created_at')
      .eq('staff_id', staff_id)
      .eq('is_active', true)
      .single();

    if (staffError || !staffRow) {
      return new Response(JSON.stringify({ error: 'スタッフ情報の取得に失敗しました' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = `${staff_id.toLowerCase()}@clawops.local`;
    let session: { access_token: string; refresh_token: string; expires_at?: number };

    try {
      if (APP_AUTH_SALT && staffRow.created_at) {
        const password = await derivePassword(staffRow.staff_id, staffRow.created_at, APP_AUTH_SALT);
        session = await issueSession(supabaseAdmin, email, password);
      } else {
        const password = legacyPassword(staffRow.staff_id, serviceKey);
        session = await issueSession(supabaseAdmin, email, password);
      }
    } catch (e) {
      console.error('[session-unlock] issueSession failed:', e);
      return new Response(JSON.stringify({ error: 'セッション発行に失敗しました' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!session?.access_token) {
      console.error('[session-unlock] session.access_token falsy', { staff_id });
      return new Response(JSON.stringify({ error: 'セッション発行に失敗しました' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: auth_logs (session_unlock)
    EdgeRuntime.waitUntil(supabaseAdmin.from('auth_logs').insert({
      staff_id,
      action: 'session_unlock',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    }));

    // Step 5: 返却
    return new Response(
      JSON.stringify({
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[session-unlock] Unexpected error:', err);
    return new Response(JSON.stringify({ error: '予期しないエラーが発生しました' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
