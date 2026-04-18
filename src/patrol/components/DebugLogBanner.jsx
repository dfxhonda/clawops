import { useEffect, useState, useRef } from 'react';

/**
 * 画面下部に固定表示されるログバナー（デバッグ用・使い捨て）
 * console.log / console.warn / console.error をフックして画面に表示する
 */
export default function DebugLogBanner() {
  const [logs, setLogs] = useState([]);
  const originalRef = useRef(null);

  useEffect(() => {
    if (originalRef.current) return; // 二重適用防止

    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    originalRef.current = original;

    const push = (level, args) => {
      const text = args
        .map((a) => {
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(' ');
      const time = new Date().toLocaleTimeString('ja-JP', { hour12: false });
      setLogs((prev) => [...prev.slice(-99), { time, level, text }]);
    };

    console.log = (...args) => {
      original.log(...args);
      push('log', args);
    };
    console.warn = (...args) => {
      original.warn(...args);
      push('warn', args);
    };
    console.error = (...args) => {
      original.error(...args);
      push('error', args);
    };

    window.addEventListener('error', (e) => {
      push('error', ['[window.error]', e.message, 'at', e.filename, ':', e.lineno]);
    });
    window.addEventListener('unhandledrejection', (e) => {
      push('error', ['[unhandled]', e.reason?.message || e.reason]);
    });

    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    };
  }, []);

  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: open ? '40vh' : '28px',
        background: 'rgba(0,0,0,0.92)',
        color: '#0f0',
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        lineHeight: '1.3',
        zIndex: 99999,
        overflowY: 'auto',
        borderTop: '2px solid #0f0',
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '4px 8px',
          background: '#030',
          color: '#fff',
          fontWeight: 'bold',
          position: 'sticky',
          top: 0,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>🐛 DEBUG LOG ({logs.length})</span>
        <span>{open ? '▼ タップで閉じる' : '▲ タップで開く'}</span>
      </div>
      {open && (
        <div style={{ padding: '4px 8px' }}>
          {logs.length === 0 && <div style={{ color: '#888' }}>ログ待機中...</div>}
          {logs.map((l, i) => (
            <div
              key={i}
              style={{
                color:
                  l.level === 'error' ? '#f55' : l.level === 'warn' ? '#fa0' : '#0f0',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
              }}
            >
              [{l.time}] {l.text}
            </div>
          ))}
          <button
            onClick={() => setLogs([])}
            style={{
              marginTop: 8,
              padding: '4px 8px',
              background: '#500',
              color: '#fff',
              border: '1px solid #f55',
              borderRadius: 4,
            }}
          >
            クリア
          </button>
        </div>
      )}
    </div>
  );
}
