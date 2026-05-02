import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LogoutButton from '../../components/LogoutButton'

const SHEET_ID = '1PwjmDQqKjbVgeUeFc_cWWkOtjgWcBxwI7XeNmaasqVA'
const SHEET_NAME = '集金帳票CSV'

// 読み取り済みデータ (Chrome OCR抽出分)
const SLIPS_DATA = [
  ['CS001','2026-02-17','SIM01','下通','27円ガチャ','','22060','22798','288000','本田','','IMG_1949.JPG'],
  ['CS002','2026-02-17','KOS01','合志','27円ガチャ','','6613','6942','129000','本田','','IMG_1956.JPG'],
  ['CS003','2026-02-17','KOS01','合志','R2014 Buzz9L','','','','166600','本田','4ブース機','IMG_1956.JPG'],
  ['CS004','2026-02-17','KOS01','合志','500GATCHA','R1005','7812','9172','185500','本田','3700','IMG_1956.JPG'],
  ['CS005','2026-02-17','KOS01','合志','セサミW1','','36225','36826','91700','本田','','IMG_1956.JPG'],
  ['CS006','2026-02-17','KOS01','合志','R1006 セサミW2','','55129','55298','30800','本田','','IMG_1956.JPG'],
  ['CS007','2026-02-17','KOS01','合志','R1050 セサミW3','','48182','48311','35600','本田','','IMG_1956.JPG'],
  ['CS008','2026-02-17','KOS01','合志','R1053 セサミW4','','46509','46758','47500','本田','','IMG_1956.JPG'],
  ['CS009','2026-02-17','KOS01','合志','R2054 Buzz2L','','','','131700','本田','4ブース機','IMG_1956.JPG'],
  ['CS010','2026-02-17','KOS01','合志','アンパンマンアイライド','','85168','86135','22100','本田','','IMG_1956.JPG'],
  ['CS011','2026-02-17','KOS01','合志','R2055 Buzz2Lミコ','','12405','14278','187300','本田','','IMG_1956.JPG'],
  ['CS012','2026-02-14','STK01','薩摩川内','ポケクレマルチ','','17207','17419','36100','本田 高野','','IMG_1916.JPG'],
  ['CS013','2026-02-14','STK01','薩摩川内','ポケクレマルチ(2)','','17654','17735','30000','本田 高野','','IMG_1916.JPG'],
  ['CS014','2026-02-14','STK01','薩摩川内','仲原ガチャ200','8P0183','1972','2046','14900','本田 高野','','IMG_1916.JPG'],
  ['CS015','2026-02-14','STK01','薩摩川内','ガチャ100','G0221','1376','1597','27700','本田 高野','','IMG_1916.JPG'],
  ['CS016','2026-02-13','STK01','薩摩川内','ポケクレマルチ','','16670','16790','21700','村松','','IMG_1912.JPG'],
  ['CS017','2026-02-13','STK01','薩摩川内','ポケクレマルチ(2)','','','','38300','村松','','IMG_1912.JPG'],
  ['CS018','2026-02-13','STK01','薩摩川内','R370レクレーン1','','19983','20117','26900','村松','','IMG_1912.JPG'],
  ['CS019','2026-02-13','STK01','薩摩川内','R1201012','','15892','15865','17300','村松','','IMG_1912.JPG'],
  ['CS020','2026-02-13','STK01','薩摩川内','コバレクレ716','','','','71500','村松','複数ブース','IMG_1912.JPG'],
  ['CS021','2026-02-13','STK01','薩摩川内','仲原ガチャ200','','','','64200','村松','','IMG_1912.JPG'],
  ['CS022','2026-02-13','STK01','薩摩川内','BP 0318','','1255','1368','22700','村松','','IMG_1912.JPG'],
  ['CS023','2026-02-13','STK01','薩摩川内','BP 0738','','2386','2423','7900','村松','','IMG_1912.JPG'],
  ['CS024','2026-02-13','STK01','薩摩川内','サイガチャ100','','','','0','村松','売上なし','IMG_1912.JPG'],
  ['CS025','2026-02-13','STK01','薩摩川内','GB 0303','','4932','3459','60600','村松','','IMG_1912.JPG'],
  ['CS026','2026-02-13','STK01','薩摩川内','GB 0555','','3785','3799','39900','村松','','IMG_1912.JPG'],
]

const HEADERS = ['slip_id','date','store_code','store_name','machine_name','machine_code','meter_in','meter_out','pay_amt','staff','note','source_image']

export default function ImportSlips() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [status, setStatus] = useState('ready')
  const [log, setLog] = useState([])

  function addLog(msg) {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`])
  }

  async function createSheetIfNeeded() {
    const token = accessToken
    // Check existing sheets
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    const exists = data.sheets?.some(s => s.properties.title === SHEET_NAME)

    if (!exists) {
      addLog(`シート「${SHEET_NAME}」を作成中...`)
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
          })
        }
      )
      addLog('シート作成完了')
    } else {
      addLog('シート「集金帳票CSV」は既に存在します')
    }
  }

  async function writeHeaders() {
    const token = accessToken
    addLog('ヘッダー行を書き込み中...')
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME + '!A1')}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [HEADERS] })
      }
    )
    addLog('ヘッダー書き込み完了')
  }

  async function writeData() {
    const token = accessToken
    addLog(`${SLIPS_DATA.length}件のデータを書き込み中...`)
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME + '!A:L')}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: SLIPS_DATA })
      }
    )
    addLog(`✅ ${SLIPS_DATA.length}件のデータ書き込み完了`)
  }

  async function handleImport() {
    if (!accessToken) {
      addLog('❌ ログインしてください')
      return
    }
    setStatus('running')
    try {
      await createSheetIfNeeded()
      await writeHeaders()
      await writeData()
      setStatus('done')
      addLog('🎉 インポート完了！')
    } catch (e) {
      addLog('❌ エラー: ' + e.message)
      setStatus('error')
    }
  }

  return (
    <div className="h-full bg-bg text-text overflow-y-auto">
    <div className="p-4 max-w-lg md:max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/menu')} className="text-muted text-2xl">←</button>
        <h1 className="flex-1 text-xl font-bold text-accent">集金帳票インポート</h1>
        <LogoutButton to="/admin/menu" />
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <div className="text-sm text-muted mb-2">読み取り済みデータ</div>
        <div className="text-2xl font-bold text-accent">{SLIPS_DATA.length}件</div>
        <div className="text-xs text-muted mt-1">
          3枚の伝票画像から抽出（IMG_1949, IMG_1956, IMG_1916, IMG_1912）
        </div>
        <div className="text-xs text-muted mt-1">
          店舗: SIM01(下通), KOS01(合志), STK01(薩摩川内)
        </div>
      </div>

      <button
        onClick={handleImport}
        disabled={status === 'running'}
        className="w-full bg-accent text-black font-bold rounded-xl py-4 mb-4 disabled:opacity-50 text-lg"
      >
        {status === 'ready' ? '集金帳票CSVにインポート' :
         status === 'running' ? 'インポート中...' :
         status === 'done' ? '✅ 完了' : '❌ エラー（再試行）'}
      </button>

      {log.length > 0 && (
        <div className="bg-surface2 rounded-xl p-3 space-y-1">
          {log.map((l, i) => (
            <div key={i} className="text-xs font-mono text-muted">{l}</div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
