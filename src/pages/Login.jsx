import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, getToken } from '../services/sheets'

const CLIENT_ID = '706491055274-g3ik8l1ao9is516d2gcta39fikr8lsgv.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export default function Login() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getToken()) { navigate('/'); return }
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      setToken(params.get('access_token'))
      navigate('/')
    }
  }, [])

  function handleLogin() {
    const redirectUri = window.location.origin + '/login'
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(SCOPE)}`
    window.location.href = url
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-10">
          <div className="w-20 h-20 mx-auto mb-4 bg-surface2 rounded-2xl flex items-center justify-center text-5xl">
            🎮
          </div>
          <h1 className="text-3xl font-bold text-accent tracking-wider">ClawOps</h1>
          <p className="text-muted text-sm mt-2">クレーンゲーム運営管理</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-colors text-base"
          >
            Googleアカウントでログイン
          </button>
          <p className="text-muted text-xs mt-3">
            Googleスプレッドシートへのアクセスを許可します
          </p>
        </div>
      </div>
    </div>
  )
}
