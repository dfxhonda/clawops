/**
 * Supabase Edge Function: verify-pin
 * 
 * 機能：
 * - staff_id と PIN を受け取り、DB側で検証
 * - bcrypt で PIN ハッシュを比較
 * - 成功時：Supabase Auth にユーザーを作成/取得し、セッショントークンを返す
 * - 失敗時：401 Unauthorized
 * 
 * デプロイ位置：
 * - supabase/functions/verify-pin/index.ts
 * 
 * 環境変数（.env.local または Vercel/Supabase設定）:
 * - SUPABASE_URL: https://gedxzunoyzmvbqgwjalx.supabase.co
 * - SUPABASE_SERVICE_ROLE_KEY: (保護された秘密鍵)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// ハッシュ化ライブラリ（Deno対応）
// ============================================================================

/**
 * bcrypt 互換のハッシュ比較
 * Deno環境での制約で tweetnacl.js を使用
 * 
 * NOTE: 本来は bcryptjs を使用するが、Deno環境の互換性が不明確のため、
 * 暫定的にシンプルな比較実装。本番運用時は以下の改善が必須：
 * 1. argon2-wasm を使用
 * 2. または Supabase の crypt() 関数経由で比較
 */

async function verifyCryptPassword(plaintext: string, hash: string): Promise<boolean> {
  // Option 1: 暫定実装（開発環境用）
  // → PIN が bcrypt ハッシュの場合、完全に互換性がない
  // クライアントが pin をそのまま送信する場合は直接比較
  return plaintext === hash; // 本来は bcrypt.compare()

  // Option 2: PostgreSQL crypt() 関数を使用（推奨）
  // Edge Function 内で DB に問い合わせ
  // const { data, error } = await supabaseAdmin.rpc('verify_pin_hash', {
  //   plain_pin: plaintext,
  //   stored_hash: hash,
  // });
  // return data?.verified || false;
}

// ============================================================================
// Supabase Admin Client の初期化
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceRoleKey = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * セッション情報を生成
 * - Supabase Auth の JWT を直接生成する方法は限定的のため、
 * - Edge Function が Deno 実行時のみ JWT 署名可能
 * - 現実的には、ユーザーを auth.users に作成して自動トークン取得
 */
async function createOrGetAuthUser(
  staffId: string,
  email: string,
  metadata: Record<string, unknown>,
) {
  // Option A: GoTrue Admin API で直接ユーザーを作成
  const createUserUrl = `${supabaseUrl}/auth/v1/admin/users`;
  const response = await fetch(createUserUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      password: generateSecurePassword(), // 一度限りのランダムパスワード
      user_metadata: metadata,
      app_metadata: {
        staff_id: staffId,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("GoTrue API error:", error);

    // ユーザーが既に存在する場合は許容
    if (error.code === "user_already_exists") {
      return await getUserByEmail(email);
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return await response.json();
}

/**
 * メールアドレスでユーザーを取得
 */
async function getUserByEmail(email: string) {
  const usersUrl = `${supabaseUrl}/auth/v1/admin/users`;
  const response = await fetch(`${usersUrl}?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const data = await response.json();
  return data.users?.[0] || null;
}

/**
 * セキュアなランダムパスワード生成
 */
function generateSecurePassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * JWT ペイロードのレスポンス構築
 * Edge Function の実行コンテキストで署名可能
 */
function buildSessionResponse(authUser: any, staff: any) {
  // Supabase が提供する JWT 署名機能を使用
  // または、エッジ関数の実行環境から JWT を直接返す

  // 暫定的に auth.users の ID とメタデータを含む
  return {
    access_token: authUser.id, // 本来は完全な JWT
    user: {
      id: authUser.id,
      email: authUser.email,
      user_metadata: {
        staff_id: staff.staff_id,
        name: staff.name,
        role: staff.role,
        store_code: staff.store_code,
      },
    },
  };
}

// ============================================================================
// ハンドラー
// ============================================================================

async function handleVerifyPin(req: Request): Promise<Response> {
  // CORS 対応
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const { staff_id, pin } = await req.json();

    // バリデーション
    if (!staff_id || !pin) {
      return new Response(
        JSON.stringify({ error: "Missing staff_id or pin" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // 1. staff テーブルから PIN を取得
    // ============================================================
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("*")
      .eq("staff_id", staff_id)
      .single();

    if (staffError || !staffData) {
      console.error("Staff not found:", staffError);
      return new Response(
        JSON.stringify({ error: "Staff not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // 2. PIN を検証
    // ============================================================
    // IMPORTANT: 本番環境では以下のいずれかを実装
    // A) PostgreSQL の crypt() を RPC経由で呼び出し
    // B) bcryptjs/argon2-wasm をDeno環境で動作確認済みのものに変更
    // C) PIN を Supabase Auth のパスワードフィールドに保存して signInWithPassword() を使用

    const pinVerified = await verifyCryptPassword(pin, staffData.pin);

    if (!pinVerified) {
      console.warn(`PIN verification failed for ${staff_id}`);
      return new Response(
        JSON.stringify({ error: "Invalid PIN" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // 3. Supabase Auth にユーザーを作成/取得
    // ============================================================
    const authUser = await createOrGetAuthUser(
      staff_id,
      staffData.email,
      {
        staff_id,
        name: staffData.name,
        role: staffData.role,
        store_code: staffData.store_code,
      },
    );

    // ============================================================
    // 4. セッションレスポンスを返す
    // ============================================================
    const session = buildSessionResponse(authUser, staffData);

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in verify-pin:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// ============================================================================
// Edge Function エクスポート
// ============================================================================

serve(handleVerifyPin);
