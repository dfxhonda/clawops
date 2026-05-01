import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_VERCEL_ENV || import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Sentry.ErrorBoundary fallback={<div style={{padding:20}}>エラーが発生しました。アプリを再起動してください。</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </BrowserRouter>
)
