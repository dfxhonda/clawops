import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import './index.css'

initSentry()

// SPEC-PWA-SW-AUTOUPDATE-B1-01: SW登録 (React外、起動前クラッシュをブラウザ層で救う)
// SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01: swRegistration.jsに分離(Login.jsxとの循環dep回避)
export { updateSW } from './lib/swRegistration'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ErrorBoundary>
      <App />
      <SpeedInsights />
    </ErrorBoundary>
  </BrowserRouter>
)
