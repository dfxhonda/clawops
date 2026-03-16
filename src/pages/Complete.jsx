import { useNavigate, useLocation } from 'react-router-dom'

export default function Complete() {
  const navigate = useNavigate()
  const { state } = useLocation()
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center w-full max-w-sm">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">入力完了！</h2>
        <p className="text-muted mb-8">{state?.storeName} の巡回データを保存しました</p>
        <button
          onClick={() => navigate(`/machines/${state?.storeId}`, { state: { storeName: state?.storeName } })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mb-2"
        >
          機械選択に戻る
        </button>
        <button onClick={() => navigate('/')}
          className="w-full bg-surface2 border border-border text-text font-medium py-3 rounded-xl hover:border-accent/30 transition-colors"
        >
          店舗選択に戻る
        </button>
      </div>
    </div>
  )
}
