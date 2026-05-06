import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// M2 Stage 1: セッションはハブからの倉庫タップで自動作成される
// 管理者からの手動作成は廃止
export default function SessionCreate() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/admin/stocktake', { replace: true })
  }, [navigate])
  return null
}
