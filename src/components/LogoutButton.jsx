// ============================================
// LogoutButton: ログアウトボタン（共通）
// sessionStorage.clear() の散在を解消
// ============================================
import { logout } from '../lib/auth/session'

export default function LogoutButton({ className }) {
  async function handleLogout() {
    await logout()
    window.location.href = '/docs/'
  }

  return (
    <button onClick={handleLogout}
      className={className || 'text-[10px] text-muted hover:text-accent2'}>
      ログアウト
    </button>
  )
}
