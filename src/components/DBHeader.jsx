import { useNavigate } from 'react-router-dom'
import { clearToken } from '../services/sheets'

export default function DBHeader({ title, subtitle, children }) {
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0f0f0f', borderBottom: '1px solid #2a2a2a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          <span style={{ fontSize: 11, color: '#4a9eff', fontWeight: 'normal' }}>Supabase</span>
        </div>
        {subtitle && <div style={{ fontSize: 11, color: '#666' }}>{subtitle}</div>}
      </div>
      {children}
      <button onClick={() => navigate('/admin')} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
        管理TOP
      </button>
      <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #5a3a3a', color: '#ff6666', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
        ログアウト
      </button>
    </div>
  )
}
