import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { validateMeterReading, is2BoothType } from '../utils/meterValidation'
import { getBooths, findMachineById } from '../../services/masters'

const INP = 'w-24 text-right bg-surface2 border border-border rounded-lg px-2 py-1.5 font-mono font-bold focus:border-accent outline-none'

/**
 * OCR結果の確認・修正・保存コンポーネント
 *
 * Props:
 *   imageUrl    string        プレビュー用 object URL
 *   ocrResult   object        { machine_code, machine_type_guess, meters, confidence }
 *   readTime    string|null   ISO文字列（EXIF由来）
 *   staffId     string
 *   onRetake    fn()
 *   onManual    fn()
 *   onSaved     fn(savedCount)
 */
export default function OcrConfirm({ imageUrl, ocrResult, readTime: initialReadTime, staffId, onRetake, onManual, onSaved }) {
  console.log('[OcrConfirm] レンダリング開始', {
    hasOcrResult: !!ocrResult,
    machineCode: ocrResult?.machine_code,
    confidence: ocrResult?.confidence,
    metersKeys: ocrResult?.meters ? Object.keys(ocrResult.meters) : null,
  })
  const [machineCode,  setMachineCode]  = useState(ocrResult?.machine_code || '')
  const [typeGuess,    setTypeGuess]    = useState(ocrResult?.machine_type_guess || null)
  const [confidence,   setConfidence]   = useState(ocrResult?.confidence ?? 0)
  const [readTime,     setReadTime]     = useState(initialReadTime || new Date().toISOString().slice(0, 16))

  const meters = ocrResult?.meters || {}
  const [leftIn,   setLeftIn]   = useState(meters.left_in   ?? '')
  const [leftOut,  setLeftOut]  = useState(meters.left_out  ?? '')
  const [rightIn,  setRightIn]  = useState(meters.right_in  ?? '')
  const [rightOut, setRightOut] = useState(meters.right_out ?? '')
  const [inMeter,  setInMeter]  = useState(meters.in_meter  ?? '')
  const [outMeter, setOutMeter] = useState(meters.out_meter ?? '')

  const [machineInfo, setMachineInfo] = useState(null)
  const [machineErr,  setMachineErr]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState(null)

  const is2Booth = is2BoothType(typeGuess)

  // 機械コードが変わったら検証
  useEffect(() => {
    if (!machineCode || machineCode.length < 6) { setMachineInfo(null); setMachineErr(false); return }
    findMachineById(machineCode).then(m => {
      setMachineInfo(m)
      setMachineErr(!m)
    })
  }, [machineCode])

  const currentOcr = {
    machine_code: machineCode,
    machine_type_guess: typeGuess,
    meters: is2Booth
      ? { left_in: leftIn === '' ? null : Number(leftIn), left_out: leftOut === '' ? null : Number(leftOut), right_in: rightIn === '' ? null : Number(rightIn), right_out: rightOut === '' ? null : Number(rightOut) }
      : { in_meter: inMeter === '' ? null : Number(inMeter), out_meter: outMeter === '' ? null : Number(outMeter) },
    confidence,
  }
  const { warnings, blocked } = validateMeterReading(currentOcr, null, is2Booth)

  async function handleSave() {
    if (blocked) return
    if (!machineCode) { setSaveErr('機械コードを入力してください'); return }
    setSaveErr(null)
    setSaving(true)
    try {
      const booths = await getBooths(machineCode)
      if (!booths.length) { setSaveErr('機械のブースが見つかりません'); setSaving(false); return }
      const storeCode = machineInfo?.store_code || machineCode.split('-')[0] + machineCode.slice(3, 5)

      const readTimeIso = new Date(readTime).toISOString()
      const patrolDate  = readTimeIso.slice(0, 10)

      const records = []
      if (is2Booth && booths.length >= 2) {
        const b01 = booths[0]
        const b02 = booths[1]
        records.push({
          full_booth_code: b01.booth_code,
          store_code:      storeCode,
          machine_code:    machineCode,
          in_meter:        leftIn  === '' ? null : Number(leftIn),
          out_meter:       leftOut === '' ? null : Number(leftOut),
          input_method:    'ocr',
          ocr_confidence:  confidence,
          read_time:       readTimeIso,
          patrol_date:     patrolDate,
          created_by:      staffId,
        })
        records.push({
          full_booth_code: b02.booth_code,
          store_code:      storeCode,
          machine_code:    machineCode,
          in_meter:        rightIn  === '' ? null : Number(rightIn),
          out_meter:       rightOut === '' ? null : Number(rightOut),
          input_method:    'ocr',
          ocr_confidence:  confidence,
          read_time:       readTimeIso,
          patrol_date:     patrolDate,
          created_by:      staffId,
        })
      } else {
        const b = booths[0]
        records.push({
          full_booth_code: b.booth_code,
          store_code:      storeCode,
          machine_code:    machineCode,
          in_meter:        inMeter  === '' ? null : Number(inMeter),
          out_meter:       outMeter === '' ? null : Number(outMeter),
          input_method:    'ocr',
          ocr_confidence:  confidence,
          read_time:       readTimeIso,
          patrol_date:     patrolDate,
          created_by:      staffId,
        })
      }

      const { error } = await supabase.from('meter_readings').insert(records)
      if (error) throw error
      onSaved(records.length)
    } catch (e) {
      setSaveErr(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* プレビュー */}
      {imageUrl && (
        <div className="rounded-xl overflow-hidden border border-border max-h-48 flex items-center justify-center bg-black">
          <img src={imageUrl} alt="OCR対象" className="max-h-48 object-contain w-full" />
        </div>
      )}

      {/* 信頼度バナー */}
      {confidence < 0.8 && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-4 py-2.5 text-yellow-400 text-xs">
          ⚠ 信頼度 {(confidence * 100).toFixed(0)}% — 値を確認してください
        </div>
      )}

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 space-y-1">
          {warnings.map((w, i) => <div key={i} className="text-red-400 text-xs">⚠ {w}</div>)}
        </div>
      )}

      {/* 機械コード */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
        <div className="text-xs text-muted font-bold uppercase tracking-wider">機械コード</div>
        <input
          type="text"
          value={machineCode}
          onChange={e => setMachineCode(e.target.value.toUpperCase())}
          placeholder="KIK01-M05"
          style={{ fontSize: 16 }}
          className={`w-full bg-surface2 border rounded-lg px-3 py-2 font-mono font-bold outline-none ${machineErr ? 'border-red-500 text-red-400' : 'border-border focus:border-accent text-text'}`}
        />
        {machineErr && <div className="text-red-400 text-xs">この機械コードはマスタに存在しません</div>}
        {machineInfo && <div className="text-green-400 text-xs">✓ {machineInfo.machine_name || machineCode}</div>}
      </div>

      {/* 機種 */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-muted">機種推定</div>
        <div className="text-sm text-text font-mono">{typeGuess || '不明'}</div>
      </div>

      {/* 撮影時刻 */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2">
        <div className="text-xs text-muted font-bold uppercase tracking-wider">撮影時刻</div>
        <input
          type="datetime-local"
          value={readTime}
          onChange={e => setReadTime(e.target.value)}
          style={{ fontSize: 16 }}
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-accent [color-scheme:dark]"
        />
      </div>

      {/* メーター値 */}
      {is2Booth ? (
        <>
          <div className="bg-surface border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted font-bold mb-3">左側 B01</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted mb-1">IN</div>
                <input type="tel" inputMode="numeric" value={leftIn} onChange={e => setLeftIn(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
              </div>
              <div>
                <div className="text-[10px] text-muted mb-1">OUT</div>
                <input type="tel" inputMode="numeric" value={leftOut} onChange={e => setLeftOut(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
              </div>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted font-bold mb-3">右側 B02</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted mb-1">IN</div>
                <input type="tel" inputMode="numeric" value={rightIn} onChange={e => setRightIn(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
              </div>
              <div>
                <div className="text-[10px] text-muted mb-1">OUT</div>
                <input type="tel" inputMode="numeric" value={rightOut} onChange={e => setRightOut(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface border border-border rounded-xl px-4 py-3">
          <div className="text-xs text-muted font-bold mb-3">メーター</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-muted mb-1">IN</div>
              <input type="tel" inputMode="numeric" value={inMeter} onChange={e => setInMeter(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
            </div>
            <div>
              <div className="text-[10px] text-muted mb-1">OUT</div>
              <input type="tel" inputMode="numeric" value={outMeter} onChange={e => setOutMeter(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 16 }} className={INP + ' w-full'} placeholder="----" />
            </div>
          </div>
        </div>
      )}

      {saveErr && <div className="text-red-400 text-xs px-1">{saveErr}</div>}

      {/* アクション */}
      <div className="grid grid-cols-3 gap-2 pb-6">
        <button onClick={onRetake} className="py-3 rounded-xl bg-surface border border-border text-xs font-bold active:scale-[0.98] transition-all">
          再撮影
        </button>
        <button onClick={onManual} className="py-3 rounded-xl bg-surface border border-border text-xs font-bold active:scale-[0.98] transition-all">
          手入力
        </button>
        <button
          onClick={handleSave}
          disabled={saving || blocked}
          className="py-3 rounded-xl bg-accent text-bg text-xs font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
