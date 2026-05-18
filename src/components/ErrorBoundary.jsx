import { Component } from 'react'
import * as Sentry from '@sentry/react'
import FallbackUI from './FallbackUI'

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
