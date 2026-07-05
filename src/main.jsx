import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import './index.css'

// OTA gen-3
initSentry()

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
