import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // CORS preflight
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

    if (!staff_id) {
      return new Response(
        JSON.stringify({ error: 'staff_id は必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceKey = Deno.env.get('CLAWOPS_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: verifyResult, error: rpcError } = await supabaseAdmin
      .rpc('verify_staff_pin', { p_staff_id: staff_id, p_pin: pin || '' });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'サーバーエラーが発生しました' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verifyResult?.success) {
      await supabaseAdmin.from('auth_logs').insert({
        staff_id: staff_id,
        action: 'login_failed',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
      return new Response(
        JSON.stringify({ error: verifyResult?.error || '認証に失敗しました' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = `${staff_id.toLowerCase()}@clawops.local`;
    const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const password = `clawops_${staff_id}_${legacyKey.slice(-8)}`;

    const newMeta = {
      staff_id: verifyResult.staff_id,
      name: verifyResult.name,
      role: verifyResult.role,
      operator_id: verifyResult.operator_id,
      store_code: verifyResult.store_code,
    };

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    let session = signInData?.session;

    if (signInError) {
      // 新規ユーザー作成
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: newMeta,
        app_metadata: { staff_id: verifyResult.staff_id, role: verifyResult.role },
      });

      if (createError) {
        console.error('Create user error:', createError);
        return new Response(
          JSON.stringify({ error: 'ユーザー作成に失敗しました' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newSignIn, error: newSignInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (newSignInError) {
        console.error('Sign in after create error:', newSignInError);
        return new Response(
          JSON.stringify({ error: 'セッション発行に失敗しました' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      session = newSignIn?.session;
    } else {
      // 既存ユーザー: メタデータが変化した場合のみ更新+再サインイン (毎回2回呼ぶと遅い)
      const existingMeta = signInData.user?.user_metadata || {};
      const metaChanged =
        existingMeta.role !== newMeta.role ||
        existingMeta.name !== newMeta.name ||
        existingMeta.store_code !== newMeta.store_code ||
        existingMeta.operator_id !== newMeta.operator_id;

      if (metaChanged) {
        await supabaseAdmin.auth.admin.updateUserById(signInData.user.id, {
          user_metadata: newMeta,
          app_metadata: { staff_id: verifyResult.staff_id, role: verifyResult.role },
        });
        const { data: freshSignIn, error: freshError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
        if (!freshError && freshSignIn?.session) {
          session = freshSignIn.session;
        }
      }
    }

    await supabaseAdmin.from('auth_logs').insert({
      staff_id: verifyResult.staff_id,
      action: 'login_success',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return new Response(
      JSON.stringify({
        session: {
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
          expires_at: session?.expires_at,
        },
        staff: {
          staff_id: verifyResult.staff_id,
          name: verifyResult.name,
          role: verifyResult.role,
          operator_id: verifyResult.operator_id,
          store_code: verifyResult.store_code,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: '予期しないエラーが発生しました' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
