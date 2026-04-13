// 景品名インクリメンタルサーチ入力欄
// 2文字以上でprize_mastersから候補を絞り込み表示
import { useEffect, useRef, useState } from 'react'
import { getPrizeMasters } from '../../services/prizes'

const INP_BASE = {
  fontSize: 16, background: '#222238', border: '1px solid #2a2a44',
  borderRadius: 4, padding: '0.4em 0.35em',
  fontFamily: "'Courier New', Courier, monospace", fontWeight: 'bold',
  outline: 'none', WebkitAppearance: 'none', color: '#d0d0e0',
  minWidth: 0, width: '100%', boxSizing: 'border-box',
}

export default function PrizeSearchInput({ value, inputStyle, onChange, onSelect }) {
  const [candidates, setCandidates] = useState([])
  const [show, setShow] = useState(false)
  const allRef = useRef(null)  // 全件キャッシュ（コンポーネントローカル）
  const containerRef = useRef(null)

  async function load() {
    if (allRef.current) return allRef.current
    const data = await getPrizeMasters()
    allRef.current = data
    return data
  }

  async function handleChange(val) {
    onChange(val)
    if (val.length < 2) { setCandidates([]); setShow(false); return }
    const all = await load()
    const hits = all.filter(p => p.prize_name.includes(val)).slice(0, 10)
    setCandidates(hits)
    setShow(hits.length > 0)
  }

  function handleSelect(p) {
    onSelect(p.prize_name, p.original_cost ?? '')
    setCandidates([])
    setShow(false)
  }

  // 外側タップで閉じる
  useEffect(() => {
    function outside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 2, minWidth: 0 }}>
      <input
        type="text"
        style={{ ...INP_BASE, ...inputStyle }}
        value={value || ''}
        placeholder="景品名"
        onFocus={e => e.target.select()}
        onChange={e => handleChange(e.target.value)}
      />
      {show && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#12121e', border: '1px solid #2a2a44', borderRadius: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,.6)', maxHeight: 220, overflowY: 'auto',
        }}>
          {candidates.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 10px', fontSize: 13, color: '#e8e8f0', cursor: 'pointer',
                borderBottom: i < candidates.length - 1 ? '1px solid #1a1a2e' : 'none',
              }}
              onMouseDown={e => { e.preventDefault(); handleSelect(p) }}
              onTouchEnd={e => { e.preventDefault(); handleSelect(p) }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.prize_name}
              </span>
              {p.original_cost != null && (
                <span style={{ color: '#f0c040', fontFamily: "'Courier New', monospace", fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
                  ¥{p.original_cost}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
