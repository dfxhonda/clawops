import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import { maybeInitDebugConsole } from './lib/debugConsole'
import { installGlobalErrorLogging } from './lib/debugLog'
import './index.css'

// OTA gen-3
initSentry()

// SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) A2: window.onerror / unhandledrejection を
// debug_logs へ (develop preview のみ、内部 gate 済)。React 到達前のエラーも拾う。
installGlobalErrorLogging()

// SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) quick-win: Vite 公式の dynamic import 失敗復旧。
// 頻繁な再デプロイで旧 chunk (Failed to fetch dynamically imported module) を掴んだ時、Vite は window に
// 'vite:preloadError' を発火する (https://vite.dev/guide/build.html#load-error-handling)。一度だけ reload で
// 新 index/chunk に復旧させ、黒画面化を未然に防ぐ。sessionStorage 一発ガードで壊れたデプロイの reload-storm を防止
// (ErrorBoundary が起動成功時に 'chunk-reload' を clear)。index.html は no-cache 前提 (vercel.json)。
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    if (!sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1')
      window.location.reload()
    }
  })
}

// SPEC-DEBUG-ERUDA-INSCREEN-CONSOLE-01 (D-072): gate 付き動的 import (?debug=1 / __DEBUG__ / localStorage np_debug=1)。
// static import しないので通常ユーザーの bundle には乗らない。eruda 起動時に __NUMPAD_LOG__ も自動 ON。
maybeInitDebugConsole()

// SPEC-SW-UPDATE-TRIGGER-01: side-effect import, registerSW()を実行する唯一の経路。
// SPEC-PWA-SW-STRIP-PHASE1-01でmain.jsxの `export { updateSW } from './lib/swRegistration'`
// を「未使用の再exportで死んでいる」と誤判定し削除したが、それがswRegistration.js自体を
// importする唯一の経路だったため、以降 registerSW() が一切実行されず新規インストールで
// SW登録自体が発生しない状態だった (git show 402e1c2 で確認)。
import './lib/swRegistration'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ErrorBoundary>
      <App />
      <SpeedInsights />
    </ErrorBoundary>
  </BrowserRouter>
)
