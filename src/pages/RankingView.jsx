import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getMachines, getBooths, getLastReading, getToken } from '../services/sheets'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'

async function getAllReadings(boothId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('meter_readings!A2:N')}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  )
  const data = await res.json()
  return (data.values||[]).filter(r => String(r[1]) === String(boothId))
}

export default function RankingView() {
  const { storeId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [boothStats, setBoothStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('last')

  useEffect(() => {
    loadStats()
  }, [storeId, period])

  async function loadStats() {
    setLoading(true)
    const machines = await getMachines(storeId)
    const stats = []
    for (const m of machines) {
      const booths = await getBooths(m.machine_id)
      for (const b of booths) {
        const readings = await getAllReadings(b.booth_id)
        if (readings.length >= 2) {
          const prev = readings[readings.length - 2]
          const curr = readings[readings.length - 1]
          const diff = Number(curr[4]) - Number(prev[4])
          if (!isNaN(diff) && diff >= 0) {
            stats.push({
              full_booth_code: b.full_booth_code,
              machine_name: m.machine_name,
              diff,
              sales: diff * 100,
              prize_name: curr[8] || '-',
              read_time: curr[3]?.slice(0,10)
            })
          }
        }
      }
    }
    stats.sort((a, b) => b.sales - a.sales)
    setBoothStats(stats)
    setLoading(false)
  }

  const top3 = boothStats.slice(0, 3)
  const worst3 = [...boothStats].reverse().slice(0, 3)
  const totalSales = boothStats.reduce((s, b) => s + b.sales, 0)

  if (loading) return <div className="container" style={{paddingTop:40,textAlign:'center'}}>集計中...</div>

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div>
          <h2>{state?.storeName}</h2>
          <p style={{fontSize:13,color:'#666'}}>売上ランキング</p>
        </div>
      </div>

      <div style={{background:'#1a73e8',color:'white',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:12,opacity:0.8}}>店舗合計売上（前回比）</div>
        <div style={{fontSize:28,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</div>
      </div>

      <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,color:'#137333'}}>🏆 TOP3</h3>
      {top3.map((b, i) => (
        <div key={b.full_booth_code} className="card" style={{borderLeft:`4px solid ${['#FFD700','#C0C0C0','#CD7F32'][i]}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'bold'}}>{['🥇','🥈','🥉'][i]} {b.full_booth_code}</div>
              <div style={{fontSize:12,color:'#666'}}>{b.machine_name} · {b.prize_name}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:'bold',color:'#137333'}}>¥{b.sales.toLocaleString()}</div>
              <div style={{fontSize:12,color:'#999'}}>+{b.diff.toLocaleString()}回</div>
            </div>
          </div>
        </div>
      ))}

      <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16,color:'#ea4335'}}>⚠️ WORST3</h3>
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

      <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16}}>📋 全ブース</h3>
      {boothStats.map((b, i) => (
        <div key={b.full_booth_code} className="card" style={{padding:'10px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'bold',fontSize:14}}>#{i+1} {b.full_booth_code}</div>
              <div style={{fontSize:12,color:'#666'}}>{b.prize_name}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:'bold'}}>¥{b.sales.toLocaleString()}</div>
              <div style={{fontSize:12,color:'#999'}}>+{b.diff.toLocaleString()}回</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
