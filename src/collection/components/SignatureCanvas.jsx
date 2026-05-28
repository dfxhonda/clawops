import { useEffect, useRef, useState } from 'react'

// J-COLLECTION-05 fix_B: 担当者署名キャンバス。pointer/touchで線描画、クリアで消去。
// onChange(dataURL|null) を返す。値はDB保存せずPDFのみ埋め込み。
export default function SignatureCanvas({ value, onChange, height = 120 }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
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
