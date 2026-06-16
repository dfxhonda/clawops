import { useEffect, useRef, useState } from 'react'

// J-COLLECTION-12 R4: 署名有効点数の閾値 (point count、stroke count ではない)。
export const SIGNATURE_MIN_POINTS = 20

// COLLECTION-SIGNATURE-REDESIGN-01 R2: パームリジェクション実装済み。
// - pointerType==='pen'優先ロック。Pencil接地中は他pointer(touch/手のひら)を無視。
// - penイベントが来ない環境では最初のpointerIdに固定 → 指でも書ける。
// - getCoalescedEvents()でPencil高頻度サンプリング、quadraticCurveToで手ブレ補正。
// - 筆圧(e.pressure)で線幅可変(0または非対応は固定幅fallback)。
// onChange(dataURL|null) を返す。onPointCount(n)は有効点のみ加算。
export default function SignatureCanvas({ value, onChange, height = 120, onPointCount, label = '担当者署名' }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
  const pointCountRef = useRef(0)
  const activePointerId = useRef(null)
  const isPenActive = useRef(false)
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
    if (e.pointerType === 'pen') {
      isPenActive.current = true
      activePointerId.current = e.pointerId
    } else {
      if (isPenActive.current) return
      if (activePointerId.current !== null) return
      activePointerId.current = e.pointerId
    }
    drawing.current = true
    lastPos.current = pos(e)
  }

  function move(e) {
    if (!drawing.current) return
    if (e.pointerId !== activePointerId.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d')
    const events = e.getCoalescedEvents?.() ?? [e]
    for (const ce of events) {
      const [x, y] = pos(ce)
      const [lx, ly] = lastPos.current
      const pressure = ce.pointerType === 'pen' && ce.pressure > 0 ? ce.pressure : null
      ctx.lineWidth = pressure != null ? Math.max(1, pressure * 5) : 2.5
      ctx.strokeStyle = '#111'
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(lx, ly, (lx + x) / 2, (ly + y) / 2)
      ctx.lineTo(x, y)
      ctx.stroke()
      lastPos.current = [x, y]
      pointCountRef.current += 1
      onPointCount?.(pointCountRef.current)
    }
    if (!dirty) setDirty(true)
  }

  function end(e) {
    if (e.pointerId !== activePointerId.current) return
    if (e.pointerType === 'pen') isPenActive.current = false
    activePointerId.current = null
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
    activePointerId.current = null
    isPenActive.current = false
    drawing.current = false
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
        <span className="text-xs text-gray-600">{label}{!dirty && <span className="text-red-500 ml-1">必須</span>}</span>
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
