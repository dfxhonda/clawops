import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold mb-2">エラーが発生しました</h2>
            <p className="text-sm text-muted mb-4">{this.state.error?.message || '予期しないエラー'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
              className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-xl">
              トップに戻る
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
