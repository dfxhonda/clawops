import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !envAnonKey) {
  throw new Error(
    '環境変数が未設定です。.env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。'
  )
}

// SPEC-HOTFIX-APIKEY-FALLBACK-01: Vercel Production の VITE_SUPABASE_ANON_KEY が新形式
// (sb_publishable_...) に自動移行され、pinned supabase-js で全 REST が 401 になった障害の
// env 非依存 hotfix。環境キーが JWT (eyJ...) でなければ legacy anon JWT にフォールバックする。
// anon key は設計上 public (全ての過去バンドルに存在) なのでハードコードは安全。
const LEGACY_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDgwNTgsImV4cCI6MjA4OTcyNDA1OH0.J2rH4L6zXStwdNikIUIzPRnyKTVPhy0J5lGtqN1QCHI'

let supabaseAnonKey = envAnonKey
if (!String(envAnonKey).startsWith('eyJ')) {
  console.warn('APIKEY-FALLBACK: non-JWT env key detected, using legacy anon key')
  supabaseAnonKey = LEGACY_ANON_KEY
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
