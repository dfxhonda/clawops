import { useEffect, useRef, useState } from 'react'

const _listeners = new Set()

function _broadcastOpen(id) {
  for (const fn of _listeners) fn(id)
}

export default function Tooltip({ id, content, label }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const btnRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = openId => {
      if (openId !== id) setOpen(false)
    }
    _listeners.add(handler)
    return () => _listeners.delete(handler)
  }, [id])

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  function handleTrigger(e) {
    e.stopPropagation()
    e.preventDefault()
    setOpen(prev => {
      const next = !prev
      if (next) {
        if (btnRef.current) {
          const rect = btnRef.current.getBoundingClientRect()
          setAlignRight(rect.left + 200 > window.innerWidth - 8)
        }
        _broadcastOpen(id)
      }
      return next
    })
  }

  return (
    <div ref={wrapRef} className="relative" data-tooltip-id={id}>
      <button
        ref={btnRef}
        type="button"
        role="button"
        data-testid={`tooltip-label-${id}`}
        onPointerDown={handleTrigger}
        className="text-blue-500 font-bold text-xs cursor-pointer select-none leading-tight"
      >
        {label}
      </button>
      {open && (
        <div
          data-testid={`tooltip-balloon-${id}`}
          className={`absolute top-full mt-1 z-[200] w-max max-w-[200px] ${alignRight ? 'right-0' : 'left-0'}`}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-2xl leading-relaxed">
            {content}
          </div>
          <div className={`absolute bottom-full border-4 border-transparent border-b-slate-800 ${alignRight ? 'right-2' : 'left-2'}`} />
        </div>
      )}
    </div>
  )
}
