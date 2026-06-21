import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// HMAC-SHA256 for stateless challenge signing (16 hex chars = 64bit)
async function hmacSign(data: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function uint8ToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// JWT payload decode (verify_jwt=true なので署名は runtime 検証済み)
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // verify_jwt: true — Supabase runtime が署名検証済み、decode のみ
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  let jwtPayload: Record<string, unknown>;
  try {
    jwtPayload = decodeJwtPayload(token);
  } catch {
    return new Response(JSON.stringify({ error: 'JWT decode error' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const staff_id = (jwtPayload?.app_metadata as Record<string, string>)?.staff_id;
  if (!staff_id) {
    return new Response(JSON.stringify({ error: 'staff_id not in JWT app_metadata' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const APP_AUTH_SALT = Deno.env.get('APP_AUTH_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('CLAWOPS_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const WEBAUTHN_RPID = Deno.env.get('WEBAUTHN_RPID') ?? '';

  const origin = req.headers.get('origin') || `https://${WEBAUTHN_RPID}`;
  const rpID = WEBAUTHN_RPID || new URL(origin).hostname;

  const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const { action } = body;

    // ─── BEGIN: challenge 生成 + PublicKeyCredentialCreationOptions 返却 ───
    if (action === 'begin') {
      // 既存 credentials (重複登録防止用 excludeCredentials)
      const { data: existingCreds } = await supabaseAdmin
        .from('staff_credentials')
        .select('credential_id, transports')
        .eq('staff_id', staff_id);

      // challenge: 32 bytes random
      const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
      const challengeB64 = uint8ToBase64url(challengeBytes);

      // stateless challenge token: challengeB64 + '.' + base64url(JSON{iat,staff_id}) + '.' + HMAC
      const iat = Date.now();
      const meta = btoa(JSON.stringify({ iat, staff_id }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const sigInput = `${challengeB64}.${meta}`;
      const sig = await hmacSign(sigInput, APP_AUTH_SALT);
      const challenge_token = `${sigInput}.${sig}`;

      const excludeCredentials = (existingCreds || []).map(c => ({
        id: c.credential_id,
        type: 'public-key' as const,
        transports: c.transports || [],
      }));

      const options = {
        challenge: challengeB64,
        rp: { id: rpID, name: 'ClawOps' },
        user: {
          id: uint8ToBase64url(new TextEncoder().encode(staff_id)),
          name: staff_id,
          displayName: staff_id,
        },
        pubKeyCredParams: [
          { type: 'public-key' as const, alg: -7 },   // ES256
          { type: 'public-key' as const, alg: -257 },  // RS256
        ],
        timeout: 60000,
        excludeCredentials,
        authenticatorSelection: {
          authenticatorAttachment: 'platform' as const,
          userVerification: 'required' as const,
          residentKey: 'preferred' as const,
        },
        attestation: 'none' as const,
      };

      return new Response(JSON.stringify({ challenge_token, options }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── FINISH: WebAuthn 検証 + staff_credentials INSERT ───
    } else if (action === 'finish') {
      const { registration_response, challenge_token, device_label } = body;

      if (!registration_response || !challenge_token) {
        return new Response(JSON.stringify({ error: 'registration_response と challenge_token は必須です' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // challenge_token 検証: parts[0]=challenge, parts[1]=meta, parts[2]=HMAC
      const parts = challenge_token.split('.');
      if (parts.length !== 3) {
        return new Response(JSON.stringify({ error: 'challenge_token 形式エラー' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const [challengeB64, metaB64, receivedSig] = parts;
      const sigInput = `${challengeB64}.${metaB64}`;
      const expectedSig = await hmacSign(sigInput, APP_AUTH_SALT);

      if (receivedSig !== expectedSig) {
        return new Response(JSON.stringify({ error: 'challenge_token 署名不正' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // meta decode: { iat, staff_id }
      const rawMeta = metaB64.replace(/-/g, '+').replace(/_/g, '/');
      const { iat, staff_id: tokenStaffId } = JSON.parse(
        atob(rawMeta + '='.repeat((4 - rawMeta.length % 4) % 4))
      );

      // 5 分以内
      if (Date.now() - iat > 5 * 60 * 1000) {
        return new Response(JSON.stringify({ error: 'challenge の有効期限が切れています' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // staff_id 一致確認
      if (tokenStaffId !== staff_id) {
        return new Response(JSON.stringify({ error: '認証情報が一致しません' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // WebAuthn registration 検証
      let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
      try {
        verification = await verifyRegistrationResponse({
          response: registration_response,
          expectedChallenge: challengeB64,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });
      } catch (e) {
        console.error('[register-passkey] verifyRegistrationResponse error:', e);
        return new Response(JSON.stringify({ error: 'WebAuthn 検証に失敗しました' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return new Response(JSON.stringify({ error: 'WebAuthn 検証に失敗しました' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { credential } = verification.registrationInfo;
      const credentialIdB64 = uint8ToBase64url(credential.id);
      const publicKeyB64 = uint8ToBase64url(credential.publicKey);
      const transports: string[] = registration_response?.response?.transports || [];

      // staff から organization_id 取得 (NOT NULL 必須、取得失敗は400で中断)
      const { data: staffRow } = await supabaseAdmin
        .from('staff')
        .select('organization_id')
        .eq('staff_id', staff_id)
        .single();

      if (!staffRow?.organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id の取得に失敗しました' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from('staff_credentials')
        .insert({
          staff_id,
          organization_id: staffRow.organization_id,
          credential_id: credentialIdB64,
          public_key: publicKeyB64,
          sign_count: credential.counter,
          device_label: device_label || null,
          transports,
        });

      if (insertError) {
        console.error('[register-passkey] insert error:', insertError);
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'この端末はすでに登録済みです' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: '登録に失敗しました' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'action は begin または finish です' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('[register-passkey] Unexpected error:', err);
    return new Response(JSON.stringify({ error: '予期しないエラーが発生しました' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
