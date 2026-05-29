import { useEffect, useRef, useState } from 'react'

// J-COLLECTION-12 R4: 署名有効点数の閾値 (point count、stroke count ではない)。
// 値は spec で 20 (tunable)、ここで named constant 化して将来調整は本ファイル 1 箇所で完結。
export const SIGNATURE_MIN_POINTS = 20

// J-COLLECTION-05 fix_B: 担当者署名キャンバス。pointer/touchで線描画、クリアで消去。
// onChange(dataURL|null) を返す。値はDB保存せずPDFのみ埋め込み。
// J-COLLECTION-12 R3/R4: onPointCount(n) を任意で受け取り、親が「サイン → 確定」遷移判定に使う。
//   point count = pointermove で線を引いた合計回数 (stroke 数ではなく描画密度)。
export default function SignatureCanvas({ value, onChange, height = 120, onPointCount }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
  const pointCountRef = useRef(0)
  const [dirty, setDirty] = useState(!!value)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const r = c.getBoundingClientRect()
    c.width = Math.max(200, Math.round(r.width))
    c.height = height
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  function pos(e) {
    const r = ref.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return [
      ((p.clientX - r.left) * ref.current.width) / r.width,
      ((p.clientY - r.top) * ref.current.height) / r.height,
    ]
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    lastPos.current = pos(e)
  }
  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d')
    const [x, y] = pos(e)
    const [lx, ly] = lastPos.current
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(x, y)
    ctx.stroke()
    lastPos.current = [x, y]
    // J-COLLECTION-12 R4: point count = pointermove 累計 (stroke 数では不安定なため density で判定)
    pointCountRef.current += 1
    onPointCount?.(pointCountRef.current)
    if (!dirty) setDirty(true)
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(ref.current.toDataURL('image/png'))
  }
  function clear() {
    const ctx = ref.current.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, ref.current.width, ref.current.height)
    setDirty(false)
    pointCountRef.current = 0
    onPointCount?.(0)
    onChange(null)
  }

  return (
    <div className="border border-border rounded bg-white">
      <canvas
        ref={ref}
        data-testid="signature-canvas"
        style={{ width: '100%', height, touchAction: 'none', display: 'block' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-gray-50">
        <span className="text-xs text-gray-600">担当者署名{!dirty && <span className="text-red-500 ml-1">必須</span>}</span>
        <button
          type="button"
          data-testid="signature-clear"
          onClick={clear}
          className="text-xs text-blue-600 px-2 min-h-[32px]"
        >
          クリア
        </button>
      </div>
    </div>
  )
}
