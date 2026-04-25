import { useNavigate } from 'react-router-dom'

const FAB_STYLE = {
  position: 'fixed',
  bottom: 24,
  right: 16,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  fontSize: 20,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 16px rgba(37,99,235,0.5)',
  zIndex: 80,
  lineHeight: 1,
}

export default function HelpFAB() {
  const navigate = useNavigate()
  return (
    <button
      style={FAB_STYLE}
      onClick={() => navigate('/help')}
      aria-label="ヘルプ"
    >
      ?
    </button>
  )
}
