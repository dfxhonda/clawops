import { useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

// 汎用ヘルプモーダル（下からスライドアップ）
// usage: <HelpModal topic={helpContent} onClose={() => setHelpTopic(null)} />
// topic: { title: string, body: string[] } | null
export default function HelpModal({ topic, onClose }) {
  useEffect(() => {
    if (!topic) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [topic, onClose])

  if (!topic) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: '#0e0e1e',
          border: '1px solid #2a2a44',
          borderRadius: '14px 14px 0 0',
          padding: '16px 16px 32px',
        }}
      >
        {/* ハンドルバー */}
        <div style={{ width: 36, height: 4, background: '#2a2a44', borderRadius: 2, margin: '0 auto 14px' }} />

        {/* タイトル + 閉じるボタン */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f0' }}>{topic.title}</span>
          <button
            onClick={onClose}
            style={{ fontSize: 18, color: '#8888a8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >×</button>
        </div>

        {/* 本文 */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {topic.body.map((line, i) => (
            <li key={i} style={{ fontSize: 13, color: '#c0c0d8', lineHeight: 1.7, paddingLeft: line.startsWith('①') || line.startsWith('②') || line.startsWith('③') || line.startsWith('※') || line.startsWith('📷') || line.startsWith('✓') || line.startsWith('⚠') ? 0 : 0 }}>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ヘルプボタン本体 — 各コンポーネントで使う小さな HelpCircle ボタン
export function HelpBtn({ onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        color: '#5dade2',
        background: 'none', border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, padding: 0,
      }}
    >
      <HelpCircle className="w-3 h-3" style={{ width: 12, height: 12 }} />
    </button>
  )
}
