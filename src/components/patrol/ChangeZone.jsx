// 入替/設定変更ゾーン ヘッダー部分 (変更タイプバッジ + リセット)
export default function ChangeZoneHeader({ changeDate, changeType, onReset }) {
  const badges = {
    none:    { label: '変更なし',  style: { background: 'rgba(176,176,197,.1)', color: '#8888a8' } },
    replace: { label: '景品入替',  style: { background: 'rgba(255,107,107,.15)', color: '#ff6b6b' } },
    config:  { label: '設定変更',  style: { background: 'rgba(168,85,247,.15)', color: '#a855f7' } },
  }
  const badge = badges[changeType] || badges.none

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 6px', padding: '8px 0 6px', borderTop: '2px solid #ff6b6b', opacity: .9 }}>
      <span style={{ fontSize: 11, color: '#ff6b6b', fontWeight: 700 }}>▼ 入替/設定変更 {changeDate}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, ...badge.style }}>
          {badge.label}
        </span>
        <button onClick={onReset} style={{ padding: '5px 14px', borderRadius: 4, background: '#222238', border: '1px solid #2a2a44', color: '#8888a8', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          ↩
        </button>
      </div>
    </div>
  )
}
