// staff_id をハッシュしてアバター色を決定（同一スタッフ=常に同色）
const AVATAR_BG = ['#0e7490','#7c3aed','#059669','#d97706','#db2777','#4338ca','#e11d48']

function avatarBg(staffId) {
  let h = 0
  for (let i = 0; i < staffId.length; i++) {
    h = Math.imul(31, h) + staffId.charCodeAt(i) | 0
  }
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length]
}

export default function StaffList({ staff, starStaffIds, isStarTab, onSelect }) {
  if (staff.length === 0) {
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        {isStarTab
          ? 'まだログイン履歴がありません。タブを右にスワイプしてスタッフを選んでください。'
          : '該当するスタッフがいません'}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {staff.map(s => (
        <button
          key={s.staff_id}
          onClick={() => onSelect(s)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 10,
            background: '#13131c', border: '1px solid #1e1e2e',
            cursor: 'pointer', textAlign: 'left',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: avatarBg(s.staff_id),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: '#fff',
          }}>
            {(s.name || '?')[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{s.name}</div>
            {s.name_kana && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{s.name_kana}</div>
            )}
          </div>
          {starStaffIds.has(s.staff_id) && !isStarTab && (
            <div style={{ fontSize: 14, color: '#06b6d4', flexShrink: 0 }}>★</div>
          )}
        </button>
      ))}
    </div>
  )
}
