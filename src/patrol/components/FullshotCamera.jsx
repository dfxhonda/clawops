import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const FULLSHOT_PROMPT = `この画像はクレーンゲーム機のメーターパネルです。以下のJSON形式で情報を抽出してください。

機種判別ヒント:
- ラベル「COIN METER / PRIZE OUT / TOTAL IN」あり → machine_type: "barber"
- ラベル「左側IN/OUT 右側IN/OUT」+ 4メーター → machine_type: "buzz_crane_4"
- ラベル「左側IN/OUT」+ 2メーター → machine_type: "buzz_twins"
- ラベル「BUZZCRE 4」等の機種コード文字があれば machine_code に使用
- machine_codeはラベル文字から推定（例: "KOS01-M06"）

必ずこのJSONのみを返し、他の文字は一切出力しないこと:
{"machine_code":null,"machine_type":"unknown","meters":{"in_left":null,"in_center":null,"in_right":null,"out_left":null,"out_right":null,"out_a":null,"out_b":null,"out_c":null},"confidence":"low"}`

async function callClaudeVision(base64Image) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-client-side-key-warning': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: FULLSHOT_PROMPT },
      ]}],
    }),
  })
  const json = await resp.json()
  return json.content?.[0]?.text || ''
}

async function resolveBoothsByMachineCode(machineCode) {
  if (!machineCode) return []
  const { data } = await supabase
    .from('booths')
    .select('booth_code, booth_name, machine_code')
    .eq('machine_code', machineCode)
    .order('booth_code')
  return data || []
}

export default function FullshotCamera({ onComplete, currentStoreCode }) {
  const inputRef = useRef(null)
  const [phase, setPhase] = useState('idle') // idle | processing | confirm | saving | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhase('processing')
    setError(null)

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const raw = await callClaudeVision(base64)
      let parsed
      try {
        parsed = JSON.parse(raw.trim())
      } catch {
        throw new Error(`JSON parse失敗: ${raw.slice(0, 100)}`)
      }

      let machineCode = parsed.machine_code
      if (machineCode && currentStoreCode && !machineCode.includes('-')) {
        machineCode = `${currentStoreCode}-${machineCode}`
      }

      const booths = await resolveBoothsByMachineCode(machineCode)

      // Storage 保存
      let photoUrl = null
      try {
        const ts = Date.now()
        const dateStr = new Date().toISOString().slice(0, 10)
        const path = `meter-captures/fullshot/${currentStoreCode || 'unknown'}/${machineCode || 'unknown'}/${dateStr}/${ts}.jpg`
        await supabase.storage.from('meter-captures').upload(path, file, { contentType: 'image/jpeg', upsert: true })
        photoUrl = supabase.storage.from('meter-captures').getPublicUrl(path).data.publicUrl
      } catch (storageErr) {
        console.warn('[FullshotCamera] Storage upload failed:', storageErr)
      }

      setResult({ machineCode, machineType: parsed.machine_type, meters: parsed.meters, confidence: parsed.confidence, booths, photoUrl })
      setPhase('confirm')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSave() {
    if (!result) return
    setPhase('saving')
    try {
      const today = new Date().toISOString().slice(0, 10)
      for (const booth of result.booths) {
        const inVal = result.meters.in_left ?? result.meters.in_center ?? null
        const row = { booth_code: booth.booth_code, patrol_date: today, in_meter: inVal, photo_url: result.photoUrl }
        await supabase.from('meter_readings').insert(row)
      }
      setPhase('done')
      onComplete?.({ saved: true, machineCode: result.machineCode })
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  if (phase === 'idle') return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapture} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="h-9 px-3 flex items-center gap-1 rounded-xl bg-teal-700 text-white text-[11px] font-bold active:bg-teal-800 transition-colors"
      >
        📸 全景
      </button>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>💡フラッシュONで精度UP</div>
    </div>
  )

  if (phase === 'processing') return (
    <div style={{ padding: '12px 16px', color: '#f8fafc', textAlign: 'center', fontSize: 13 }}>
      🔍 機械コード・メーター読取中...
    </div>
  )

  if (phase === 'error') return (
    <div style={{ padding: 12 }}>
      <div style={{ color: '#f43f5e', fontSize: 12, marginBottom: 8 }}>エラー: {error}</div>
      <button onClick={() => setPhase('idle')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontSize: 13 }}>戻る</button>
    </div>
  )

  if (phase === 'confirm' && result) {
    const isLow = result.confidence === 'low'
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', zIndex: 100, display: 'flex', flexDirection: 'column', padding: 16, color: '#f8fafc', overflowY: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>📸 全景撮影 確認</div>

        <div style={{ marginBottom: 12, padding: '10px 14px', backgroundColor: '#1e293b', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>機械コード</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{result.machineCode || '不明'}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            機種: {result.machineType} &nbsp;|&nbsp;
            <span style={{ color: isLow ? '#fbbf24' : '#34d399' }}>
              信頼度: {result.confidence}
            </span>
          </div>
        </div>

        {result.booths.length === 0 && (
          <div style={{ color: '#fbbf24', fontSize: 13, marginBottom: 12, padding: '8px 12px', backgroundColor: '#422006', borderRadius: 8 }}>
            ⚠️ 該当ブースが見つかりませんでした。機械コードを確認してください。
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          {result.booths.map(b => (
            <div key={b.booth_code} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              backgroundColor: isLow ? '#422006' : '#14532d', padding: '10px 14px', borderRadius: 8,
            }}>
              <span style={{ flex: 1, fontSize: 14 }}>{b.booth_code}</span>
              <span style={{ fontSize: 11, color: isLow ? '#fbbf24' : '#86efac' }}>
                {isLow ? '⚠️ 要確認' : '✅ 自動入力'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPhase('idle')}
            style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: 'none', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            ✏️ 個別修正
          </button>
          <button
            onClick={handleSave}
            disabled={result.booths.length === 0}
            style={{ flex: 2, padding: '14px 0', borderRadius: 10, border: 'none', backgroundColor: result.booths.length === 0 ? '#1e293b' : '#10b981', color: '#fff', fontWeight: 700, fontSize: 15, cursor: result.booths.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            ✅ 全部このまま保存
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'saving') return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc' }}>
      保存中...
    </div>
  )

  if (phase === 'done') return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f8fafc' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>保存完了</div>
      <button onClick={() => setPhase('idle')} style={{ marginTop: 16, padding: '12px 28px', borderRadius: 10, border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
        戻る
      </button>
    </div>
  )

  return null
}
