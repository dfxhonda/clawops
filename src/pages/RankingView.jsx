import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getMachines, getBooths, getAllMeterReadings } from '../services/sheets'

export default function RankingView() {
  const { storeId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [boothStats, setBoothStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => { loadStats() }, [storeId])

  async function loadStats() {
    setLoading(true)
    const [machines, allReadings] = await Promise.all([
      getMachines(storeId),
      getAllMeterReadings()
    ])

    // デバッグ情報
    const firstBooth = machines.length > 0 ? (await getBooths(machines[0].machine_id))[0] : null
    const sampleReading = allReadings[0]
    const debugMsg = `読込: machines=${machines.length} readings=${allReadings.length} | ` +
      `booth_id例="${firstBooth?.booth_id}"(${typeof firstBooth?.booth_id}) ` +
      `reading.booth_id例="${sampleReading?.booth_id}"(${typeof sampleReading?.booth_id})`
    setDebugInfo(debugMsg)

    const stats = []
    for (const m of machines) {
      const booths = await getBooths(m.machine_id)
      for (const b of booths) {
        const br = allReadings.filter(r => String(r.booth_id) === String(b.booth_id))
        if (br.length >= 2) {
          const prev = Number(br[br.length-2].in_meter)
          const curr = Number(br[br.length-1].in_meter)
          if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
            const diff = curr - prev
            stats.push({
              full_booth_code: b.full_booth_code,
              machine_name: m.machine_name,
              diff, sales: diff * Number(b.play_price||100),
              prize_name: br[br.length-1].prize_name || '-',
              read_time: br[br.length-1].read_time?.slice(0,10)
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
  const totalSales = withData.reduce((s, b) => s + b.sales, 0)

  if (loading) return (
    <div className="container" style={{paddingTop:40,textAlign:'center'}}>
      <p>集計中...</p>
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

      {/* デバッグ表示 */}
      <div style={{background:'#fff3cd',borderRadius:8,padding:10,marginBottom:12,fontSize:11,wordBreak:'break-all'}}>
        {debugInfo}
      </div>

      <div style={{background:'#1a73e8',color:'white',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:12,opacity:0.8}}>店舗合計売上</div>
        <div style={{fontSize:28,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</div>
        <div style={{fontSize:11,opacity:0.7,marginTop:4}}>{withData.length}ブース集計済</div>
      </div>

      {boothStats.map((b) => (
        <div key={b.full_booth_code} className="card" style={{padding:'10px 16px',opacity:b.noData?0.5:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'bold',fontSize:14}}>{b.full_booth_code}</div>
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
