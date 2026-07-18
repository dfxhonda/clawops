// SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) Part A: debug_logs (D-074 テーブル) のフロント配線。
// テスト版(develop preview)でのブラックアウト等ランタイム障害を DB に残すための最小ログ基盤。
// - React クラッシュ (ErrorBoundary) / window.onerror / unhandledrejection を debug_logs へ INSERT。
// - develop preview のみ有効 (本番ドメインは既定 off、opt-in のみ)。INSERT 失敗しても本体を壊さない。
import { supabase } from './supabase'
import { extractMeta } from './auth/session'

// staff_id は auth から独立同期 (AuthProvider を触らない = 認証ロジック非改変)。
let _staffId = null

// session_id: クライアント生成 uuid を localStorage 保持 (端末/ブラウザ単位で安定 = 並行セッション識別子)。
function getSessionId() {
  try {
    let sid = localStorage.getItem('debug_session_id')
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `s-${Date.now()}-${Math.round(performance?.now?.() ?? 0)}`
      localStorage.setItem('debug_session_id', sid)
    }
    return sid
  } catch {
    return 'no-session'
  }
}

// A5: develop preview のみ有効。本番ドメイン(dfx.round-0.com)は既定 off、opt-in (window.__DEBUG__) のみ。
export function isDebugLogsEnabled() {
  if (typeof window === 'undefined') return false
  try {
    if (window.__DEBUG__ === true) return true // opt-in (D-072 eruda ゲートと同じ)
    const host = window.location.hostname
    if (host === 'dfx.round-0.com') return false // 本番ドメイン = 既定 off
    return host.endsWith('.vercel.app') // Vercel preview (develop) = on
  } catch {
    return false
  }
}

// 並行セッション/端末のヒント (どの端末・状態でクラッシュしたか切り分け用)。
function parallelHints() {
  try {
    return {
      visibility: typeof document !== 'undefined' ? document.visibilityState : null,
      cores: navigator?.hardwareConcurrency ?? null,
      screen: (typeof window !== 'undefined' && window.screen) ? `${window.screen.width}x${window.screen.height}` : null,
      online: navigator?.onLine ?? null,
      ts: Date.now(),
    }
  } catch {
    return {}
  }
}

// debug_logs への 1 行 INSERT。A4: 失敗しても throw しない (本体を壊さない)。
export async function logDebug({ level = 'error', tag, message, payload } = {}) {
  if (!isDebugLogsEnabled()) return
  try {
    await supabase.from('debug_logs').insert({
      staff_id: _staffId,
      session_id: getSessionId(),
      level,
      tag: tag ?? null,
      message: message != null ? String(message).slice(0, 2000) : null,
      payload: { ...(payload || {}), hints: parallelHints() },
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
    })
  } catch {
    // A4: INSERT 失敗 (RLS 未ログイン / ネットワーク) でも二次クラッシュさせない。
  }
}

// A2 + staff_id 同期: window グローバルエラーを debug_logs へ。main.jsx から一度だけ呼ぶ。
let _installed = false
export function installGlobalErrorLogging() {
  if (_installed || typeof window === 'undefined') return
  _installed = true

  // staff_id を supabase auth から同期 (AuthProvider 非改変)。
  try {
    supabase.auth.getSession().then(({ data }) => { _staffId = data?.session ? (extractMeta(data.session).staffId ?? null) : null })
    supabase.auth.onAuthStateChange((_e, session) => { _staffId = session ? (extractMeta(session).staffId ?? null) : null })
  } catch { /* auth 同期失敗は無視 (staff_id=null で継続) */ }

  window.addEventListener('error', (e) => {
    logDebug({
      tag: 'window-error',
      message: e?.message,
      payload: { stack: e?.error?.stack ?? null, filename: e?.filename ?? null, lineno: e?.lineno ?? null, colno: e?.colno ?? null },
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason
    logDebug({
      tag: 'unhandled-rejection',
      message: reason?.message ?? String(reason ?? 'unhandledrejection'),
      payload: { stack: reason?.stack ?? null },
    })
  })
}

// テスト用: 内部状態リセット
export function __resetDebugLogForTest() {
  _installed = false
  _staffId = null
}
