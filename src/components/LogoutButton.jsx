// ============================================
// HomeButton: メニュー（PatrolOverview）に戻るボタン
// 全ページの共通ヘッダー右端に配置
// ============================================
import { useNavigate } from 'react-router-dom'

export default function LogoutButton({ className, to = '/' }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(to)}
      className={className || 'text-[10px] text-muted hover:text-accent'}>
      ⌂ メニュー
    </button>
  )
}
