// ClawOps 共通設定
// 本番環境では環境変数から注入すること
// ※ このファイルにservice_roleキーを絶対に書かないこと
window.CLAWOPS_CONFIG = {
  SUPABASE_URL: '', // デプロイ時に設定
  SUPABASE_ANON_KEY: '', // デプロイ時に設定（anon keyのみ）
}
