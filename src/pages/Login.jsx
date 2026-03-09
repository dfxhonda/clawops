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
    <div className="container" style={{paddingTop:80}}>
      <div style={{textAlign:'center',marginBottom:40}}>
        <div style={{fontSize:48,marginBottom:16}}>🎮</div>
        <h1 style={{fontSize:28,fontWeight:'bold',color:'#1a73e8'}}>ClawOps</h1>
        <p style={{color:'#666',marginTop:8}}>クレーンゲーム運営管理</p>
      </div>
      <div className="card">
        <button className="btn btn-primary" onClick={handleLogin}>
          Googleアカウントでログイン
        </button>
        <p style={{fontSize:12,color:'#999',textAlign:'center',marginTop:8}}>
          Googleスプレッドシートへのアクセスを許可します
        </p>
      </div>
    </div>
  )
}
