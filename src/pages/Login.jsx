// Login v4 - 50音タブ + 名前リスト + bottom sheet PIN
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'
import { useToast } from '../hooks/useToast'
import { fetchStarStaff, upsertLoginHistory } from '../services/loginHistory'
import TabBar from './login/TabBar'
import StaffList from './login/StaffList'
import PinSheet from './login/PinSheet'

const KANA_GROUPS = {
  'あ': /^[アイウエオ]/,
  'か': /^[カキクケコガギグゲゴ]/,
  'さ': /^[サシスセソザジズゼゾ]/,
  'た': /^[タチツテトダヂヅデド]/,
  'な': /^[ナニヌネノ]/,
  'は': /^[ハヒフヘホバビブベボパピプペポ]/,
  'ま': /^[マミムメモ]/,
  'や': /^[ヤユヨ]/,
  'ら': /^[ラリルレロ]/,
  'わ': /^[ワヰヱヲン]/,
}

// ひらがな → カタカナ変換（name_kana がひらがな保存の場合に対応）
function toKatakana(str) {
  return (str || '').replace(/[ぁ-ゖ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) + 0x60))
}

export default function Login() {
  const navigate = useNavigate()
  const { showToast, Toast } = useToast({ successDuration: 1200 })

  const [allStaff, setAllStaff]         = useState([])
  const [starStaff, setStarStaff]       = useState([])
  const [activeTab, setActiveTab]       = useState('★')
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [initDone, setInitDone]         = useState(false)
  const [loadErr, setLoadErr]           = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { navigate('/', { replace: true }); return }

      // organization_id フィルタは外す: anon RLS が is_active=true のみ対象のため
      // org_id で絞ると環境によっては空配列になる
      const { data, error } = await supabase
        .from('staff')
        .select('staff_id, name, name_kana, has_pin')
        .eq('is_active', true)
        .order('name_kana')

      if (error) {
        console.error('[Login] staff fetch error:', error)
        setLoadErr(`スタッフ一覧の取得に失敗しました (${error.message})`)
        setInitDone(true)
        return
      }

      let staff = data || []

      // staff テーブルが空の場合は staff_public ビューにフォールバック
      if (staff.length === 0) {
        const { data: pub } = await supabase
          .from('staff_public')
          .select('staff_id, name, name_kana, has_pin')
          .eq('is_active', true)
          .order('name')
        if (pub?.length) staff = pub
      }

      console.log('[Login] staff loaded:', staff.length)
      setAllStaff(staff)
      const star = await fetchStarStaff(staff)
      setStarStaff(star)
      setInitDone(true)
    }
    init()
  }, [navigate])

  const starStaffIds = useMemo(
    () => new Set(starStaff.map(s => s.staff_id)),
    [starStaff]
  )

  const filteredStaff = useMemo(() => {
    if (activeTab === '★') return starStaff
    const regex = KANA_GROUPS[activeTab]
    if (!regex) return allStaff
    return allStaff.filter(s => regex.test(toKatakana(s.name_kana || '')))
  }, [activeTab, allStaff, starStaff])

  const handleLoginSuccess = async (staff, session) => {
    await supabase.auth.setSession({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
    })
    await upsertLoginHistory(staff.staff_id)
    setSelectedStaff(null)
    showToast(`${staff.name} さん こんにちは`)
    setTimeout(() => navigate('/', { replace: true }), 1200)
  }

  if (!initDone) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 32, height: 32, border: '2px solid #f0c040', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: '#e8e8f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif" }}>
      <Toast />

      {/* ヘッダー */}
      <div style={{ flexShrink: 0, padding: '16px 16px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>🎮</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginTop: 4 }}>Round 0</div>
        <div style={{ fontSize: 12, color: '#9090a8', marginTop: 2 }}>スタッフを選んでPINを入力</div>
      </div>

      {/* タブバー */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* 件数バッジ */}
      <div style={{ flexShrink: 0, padding: '4px 12px 0', fontSize: 11, color: '#64748b' }}>
        {filteredStaff.length}件
      </div>

      {/* 名前リスト(スクロールエリア) */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {loadErr ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#f87171', fontSize: 13 }}>{loadErr}</div>
        ) : (
          <StaffList
            staff={filteredStaff}
            starStaffIds={starStaffIds}
            isStarTab={activeTab === '★'}
            onSelect={setSelectedStaff}
          />
        )}
      </div>

      {/* bottom sheet */}
      {selectedStaff && (
        <PinSheet
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  )
}
