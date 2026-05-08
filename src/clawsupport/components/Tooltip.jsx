import { useEffect, useRef, useState } from 'react'

const _listeners = new Set()

function _broadcastOpen(id) {
  for (const fn of _listeners) fn(id)
}

export default function Tooltip({ id, content }) {
  const [open, setOpen] = useState(false)
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
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  function handleIconPointerDown(e) {
    e.stopPropagation()
    e.preventDefault()
    setOpen(prev => {
      const next = !prev
      if (next) _broadcastOpen(id)
      return next
    })
  }

  return (
    <div ref={wrapRef} className="relative flex items-center" data-tooltip-id={id}>
      <button
        type="button"
        data-testid={`tooltip-icon-${id}`}
        onPointerDown={handleIconPointerDown}
        className="w-[22px] h-[22px] bg-blue-500 text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
        aria-label={`${id} の説明`}
      >
        ⓘ
      </button>
      {open && (
        <div
          data-testid={`tooltip-balloon-${id}`}
          className="absolute bottom-full right-0 mb-2 z-[200] w-max max-w-[220px]"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-2xl leading-relaxed">
            {content}
          </div>
          <div className="absolute top-full right-2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}
