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

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ErrorBoundary>
      <App />
      <SpeedInsights />
    </ErrorBoundary>
  </BrowserRouter>
)
