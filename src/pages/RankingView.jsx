import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getMachines, getBooths, getAllMeterReadings, parseNum } from '../services/sheets'

export default function RankingView() {
  const { storeId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [boothStats, setBoothStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('prev') // 'prev' | 'total'

  useEffect(() => { loadStats() }, [storeId])

  async function loadStats() {
    setLoading(true)
    const [machines, allReadings] = await Promise.all([
      getMachines(storeId),
      getAllMeterReadings()
    ])
    const allBooths = await Promise.all(machines.map(m => getBooths(m.machine_id)))
    const stats = []
    machines.forEach((m, mi) => {
      allBooths[mi].forEach(b => {
        const br = allReadings.filter(r => String(r.booth_id) === String(b.booth_id))
        const price = parseNum(b.play_price||'100')

        // 前回比
        let prevDiff = 0, prevSales = 0, prevNoData = true
        if (br.length >= 2) {
          const prev = parseNum(br[br.length-2].in_meter)
          const curr = parseNum(br[br.length-1].in_meter)
          if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
            prevDiff = curr - prev
            prevSales = prevDiff * price
            prevNoData = false
          }
        }

        // 集金後累計（暫定：最古レコード起点）
        let totalDiff = 0, totalSales = 0, totalNoData = true
        if (br.length >= 2) {
          const first = parseNum(br[0].in_meter)
          const last = parseNum(br[br.length-1].in_meter)
          if (!isNaN(first) && !isNaN(last) && last >= first) {
            totalDiff = last - first
            totalSales = totalDiff * price
            totalNoData = false
          }
        }

        stats.push({
          full_booth_code: b.full_booth_code,
          machine_name: m.machine_name,
          prize_name: br.length ? (br[br.length-1].prize_name||'-') : '-',
          read_time: br.length ? br[br.length-1].read_time?.slice(0,10) : '-',
          since_date: br.length ? br[0].read_time?.slice(0,10) : '-',
          prevDiff, prevSales, prevNoData,
          totalDiff, totalSales, totalNoData,
        })
      })
    })
    setBoothStats(stats)
    setLoading(false)
  }

  const isPrev = mode === 'prev'
  const getDiff = b => isPrev ? b.prevDiff : b.totalDiff
  const getSales = b => isPrev ? b.prevSales : b.totalSales
  const getNoData = b => isPrev ? b.prevNoData : b.totalNoData

  const withData = boothStats.filter(b => !getNoData(b))
  const sorted = [...withData].sort((a,b) => getSales(b) - getSales(a))
  const top3 = sorted.slice(0,3)
  const worst3 = [...sorted].reverse().slice(0,3)
  const totalSales = withData.reduce((s,b) => s + getSales(b), 0)
  const sinceDate = boothStats.length ? boothStats[0].since_date : '-'

  if (loading) return (
    <div className="container" style={{paddingTop:80,textAlign:'center'}}>
      <p>集計中...</p>
    </div>
  )

  return (
    <div className="container" style={{paddingTop:24}}>
      <div className="header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div>
          <h2>{state?.storeName}</h2>
          <p style={{fontSize:13,color:'#666'}}>売上ランキング</p>
        </div>
      </div>

      {/* モード切替タブ */}
      <div style={{display:'flex',background:'#f0f0f0',borderRadius:10,padding:3,marginBottom:16}}>
        {[['prev','📊 前回比'],['total','💰 集金後累計']].map(([val,label]) => (
          <button key={val} onClick={() => setMode(val)}
            style={{flex:1,padding:'8px 0',border:'none',borderRadius:8,cursor:'pointer',fontWeight:'bold',fontSize:13,
              background: mode===val ? 'white' : 'transparent',
              color: mode===val ? '#1a73e8' : '#666',
              boxShadow: mode===val ? '0 1px 4px rgba(0,0,0,0.15)' : 'none'}}>
            {label}
          </button>
        ))}
      </div>

      {/* 合計カード */}
      <div style={{background:'#1a73e8',color:'white',borderRadius:12,padding:'12px 16px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:12,opacity:0.8}}>
          {isPrev ? '店舗合計（前回比）' : `集金後累計（${sinceDate}〜）`}
        </div>
        <div style={{fontSize:28,fontWeight:'bold'}}>¥{totalSales.toLocaleString()}</div>
        <div style={{fontSize:11,opacity:0.7,marginTop:4}}>{withData.length}ブース集計済 / 全{boothStats.length}ブース</div>
      </div>

      {/* TOP3 */}
      {top3.length > 0 && <>
        <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,color:'#137333'}}>🏆 TOP3</h3>
        {top3.map((b,i) => (
          <div key={b.full_booth_code} className="card" style={{borderLeft:`4px solid ${['#FFD700','#C0C0C0','#CD7F32'][i]}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold'}}>{['🥇','🥈','🥉'][i]} {b.full_booth_code}</div>
                <div style={{fontSize:12,color:'#666'}}>{b.machine_name} · {b.prize_name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'bold',color:'#137333',fontSize:16}}>¥{getSales(b).toLocaleString()}</div>
                <div style={{fontSize:12,color:'#999'}}>+{getDiff(b).toLocaleString()}回</div>
              </div>
            </div>
          </div>
        ))}
      </>}

      {/* WORST3 */}
      {worst3.length > 0 && <>
        <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16,color:'#ea4335'}}>⚠️ WORST3（入替候補）</h3>
        {worst3.map(b => (
          <div key={b.full_booth_code} className="card" style={{borderLeft:'4px solid #ea4335'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold'}}>{b.full_booth_code}</div>
                <div style={{fontSize:12,color:'#666'}}>{b.machine_name} · {b.prize_name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'bold',color:'#ea4335'}}>¥{getSales(b).toLocaleString()}</div>
                <div style={{fontSize:12,color:'#999'}}>+{getDiff(b).toLocaleString()}回</div>
              </div>
            </div>
          </div>
        ))}
      </>}

      {/* 全ブース（機械順） */}
      <h3 style={{fontSize:15,fontWeight:'bold',marginBottom:8,marginTop:16}}>📋 全ブース（機械順）</h3>
      {boothStats.map(b => (
        <div key={b.full_booth_code} className="card" style={{padding:'10px 16px',opacity:getNoData(b)?0.5:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'bold',fontSize:14}}>{b.full_booth_code}</div>
              <div style={{fontSize:12,color:'#666'}}>{b.prize_name}</div>
            </div>
            <div style={{textAlign:'right'}}>
              {getNoData(b)
                ? <div style={{fontSize:12,color:'#999'}}>データ不足</div>
                : <>
                  <div style={{fontWeight:'bold'}}>¥{getSales(b).toLocaleString()}</div>
                  <div style={{fontSize:12,color:'#999'}}>+{getDiff(b).toLocaleString()}回</div>
                </>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
