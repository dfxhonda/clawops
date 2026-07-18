import { Component } from 'react'
import * as Sentry from '@sentry/react'
import FallbackUI from './FallbackUI'
import { logDebug } from '../lib/debugLog'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.resetError = this.resetError.bind(this)
  }

  componentDidMount() {
    // 正常起動したらリロードフラグをクリア
    sessionStorage.removeItem('chunk-reload')
  }

  static getDerivedStateFromError(error) {
    // チャンク読み込み失敗（デプロイ後の旧キャッシュ）→ 自動リロード
    const msg = error?.message || ''
    if (
      error?.name === 'ChunkLoadError' ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module')
    ) {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1')
        window.location.reload()
      }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info)
    try {
      Sentry.captureException(error, { extra: { componentStack: info?.componentStack } })
    } catch (_sentryErr) {
      // Sentry未初期化時はサイレント無視
    }
    // SPEC-DEBUG-LOGS-WIRING-AND-CRASH-RESEARCH-01 (D-092) A1: React クラッシュを debug_logs へ。
    // logDebug 内部で develop-only gate + try/catch (A4) 済だが、ここでも二重に握りつぶして
    // ErrorBoundary が絶対に二次クラッシュしないようにする (A3)。
    try {
      logDebug({
        level: 'error',
        tag: 'react-crash',
        message: error?.message,
        payload: { stack: error?.stack ?? null, componentStack: info?.componentStack ?? null, name: error?.name ?? null },
      })?.catch?.(() => {})
    } catch (_logErr) {
      // debug ログの失敗で fallback UI を壊さない
    }
  }

  resetError() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || FallbackUI
      return (
        <FallbackComponent
          error={this.state.error}
          resetErrorBoundary={this.resetError}
        />
      )
    }
    return this.props.children
  }
}
