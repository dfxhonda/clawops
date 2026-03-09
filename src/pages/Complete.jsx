import { useNavigate, useLocation } from 'react-router-dom'

export default function Complete() {
  const navigate = useNavigate()
  const { state } = useLocation()
  return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <div style={{fontSize:64,marginBottom:16}}>✅</div>
      <h2 style={{fontSize:24,fontWeight:'bold',marginBottom:8}}>入力完了！</h2>
      <p style={{color:'#666',marginBottom:32}}>{state?.storeName} の巡回データを保存しました</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        店舗選択に戻る
      </button>
    </div>
  )
}
