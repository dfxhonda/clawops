cat > src/pages/RankingView.jsx << 'EOF'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getMachines, getBooths, getAllMeterReadings } from '../services/sheets'

export default function RankingView() {
  const { storeId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [boothStats, setBoothStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [storeId])

  async function loadStats() {
    setLoading(true)
    const [machines, allReadings] = await Promise.all([
      getMachines(storeId),
      getAllMeterReadings()
    ])
    const stats = []
    for (const m of machines) {
      const booths = await getBooths(m.machine_id)
      for (const b of booths) {
        const br = allReadings.filter(r => String(r.booth_id) === String(b.booth_id))
        if (br.length >= 2) {
          const prev = br[br.length - 2]
          const curr = br[br.length - 1]
          const prevIn = Number(prev.in_meter)
          const currIn = Number(curr.in_meter)
          if (!isNaN(prevIn) && !isNaN(currIn) && currIn >= prevIn) {
            const diff = currIn - prevIn
            stats.push({
              full_booth_code: b.full_booth_code,
              machine_name: m.machine_name,
              diff,
              sales: diff * Number(b.play_price || 100),
              prize_name: curr.prize_name || '-',
              read_time: curr.read_time?.slice(0,10)
            })
          }
        } else if (br.length === 1) {
          stats.push({
            full_booth_code: b.full_booth_code,
            machine_name: m.machine_name,
            diff: 0, sales: 0,
            prize_name: br[0].prize_name || '-',
            read_time: br[0].read_time?.slice(0,10),
            noData: true
          })
        }
      }
    }
    stats.sort((a, b) => b.sales - a.sales)
    setBoothStats(stats)
    setLoading(false)
  }

  const withData = boothStats.filter(b => !b.noData)
  const top3 = withData.slice(0, 3)
  const worst3 = [...withData].reverse().slice(0, 3)
  const totalSales = withData.reduce((s, b) => s + b.sales, 0)

  if (loading) return (
    <div className="container" style={{paddingTop:40,textAlign:'center'}}>
      <p>集計中...</p>
      <p style={{fontSize:12,color:'#999',marginTop:8}}>少々お待ちください</p>
    </div>
  )

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div>
          <h2>{state?.storeName}</h2>
          <p style={{fontSize:13,color:'#666'}}>売上ランキング（前回比）</p>
        </div>
      </div>

      <div style={{background:'#1a73e8',color:'white',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:12,opacity:0.8}}>店舗合計売上</div>
        <div style={{fontSize:28,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</div>
        <div style={{fontSize:11,opacity:0.7,marginTop:4}}>{withData.length}ブース集計済</div>
      </div>

      {top3.length > 0 && <>
        <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,color:'#137333'}}>🏆 TOP3</h3>
        {top3.map((b, i) => (
          <div key={b.full_booth_code} className="card" style={{borderLeft:`4px solid ${['#FFD700','#C0C0C0','#CD7F32'][i]}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold'}}>{['🥇','🥈','🥉'][i]} {b.full_booth_code}</div>
                <div style={{fontSize:12,color:'#666'}}>{b.machine_name} · {b.prize_name}</div>
                <div style={{fontSize:11,color:'#999'}}>{b.read_time}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'bold',color:'#137333',fontSize:16}}>¥{b.sales.toLocaleString()}</div>
                <div style={{fontSize:12,color:'#999'}}>+{b.diff.toLocaleString()}回</div>
              </div>
            </div>
          </div>
        ))}
      </>}

      {worst3.length > 0 && <>
        <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16,color:'#ea4335'}}>⚠️ WORST3（入替候補）</h3>
        {worst3.map((b, i) => (
          <div key={b.full_booth_code} className="card" style={{borderLeft:'4px solid #ea4335'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold'}}>{b.full_booth_code}</div>
                <div style={{fontSize:12,color:'#666'}}>{b.machine_name} · {b.prize_name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'bold',color:'#ea4335'}}>¥{b.sales.toLocaleString()}</div>
                <div style={{fontSize:12,color:'#999'}}>+{b.diff.toLocaleString()}回</div>
              </div>
            </div>
          </div>
        ))}
      </>}

      <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16}}>📋 全ブース</h3>
      {boothStats.map((b, i) => (
        <div key={b.full_booth_code} className="card" style={{padding:'10px 16px',opacity:b.noData?0.5:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'bold',fontSize:14}}>
                {!b.noData && `#${withData.findIndex(x=>x.full_booth_code===b.full_booth_code)+1} `}
                {b.full_booth_code}
              </div>
              <div style={{fontSize:12,color:'#666'}}>{b.prize_name}</div>
            </div>
            <div style={{textAlign:'right'}}>
              {b.noData
                ? <div style={{fontSize:12,color:'#999'}}>データ1件のみ</div>
                : <>
                  <div style={{fontWeight:'bold'}}>¥{b.sales.toLocaleString()}</div>
                  <div style={{fontSize:12,color:'#999'}}>+{b.diff.toLocaleString()}回</div>
                </>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
EOF