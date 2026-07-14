// Login v4 - 50音タブ + 名前リスト + bottom sheet PIN
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DFX_ORG_ID } from '../lib/auth/orgConstants'
import { useToast } from '../hooks/useToast'
import { fetchDeviceLoginRows, upsertLoginHistory } from '../services/loginHistory'
import TabBar from './login/TabBar'
import StaffList from './login/StaffList'
import PinSheet from './login/PinSheet'
import { startPrefetch } from '../lib/prefetchCache'
import { warmupVerifyPin } from './login/pinVerifier'
import { checkVersionAndReload } from '../lib/versionReload'

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

  // SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01 R2(A): mount時にverify-pin Edgeを事前warm-up
  useEffect(() => { warmupVerifyPin() }, [])

  // SPEC-PWA-LOGIN-VERSIONJSON-RELOAD-02 (D-062): /login マウント時に deploy 世代を検知し単発 reload (保険層)
  useEffect(() => { checkVersionAndReload() }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // SPEC-LOGIN-GHOST-SESSION-VALIDATE-FIX-01: getUser() でサーバー側の生存確認。
        // 削除済み auth.user の亡霊 session は無音破棄して staff 一覧へフォールスルー。
        let ghostDetected = false
        try {
          const { data: userData, error: userError } = await supabase.auth.getUser()
          if (userError || !userData?.user) {
            ghostDetected = true
            console.warn('[ERR-LOGIN-GHOST-SESSION]', userError)
          }
        } catch (e) {
          ghostDetected = true
          console.warn('[ERR-LOGIN-GHOST-SESSION]', e)
        }
        if (ghostDetected) {
          try { await supabase.auth.signOut() } catch (e) { console.warn('[ERR-LOGIN-GHOST-SESSION] signOut', e) }
          // fall through: return せず staff 一覧ロードへ続行
        } else {
          navigate('/launcher', { replace: true })
          return
        }
      }
      // SPEC-LOGIN-LATENCY-FIX-01 C2: staff SELECT と device_login_history SELECT を
      // Promise.all で並列発火 (waterfall +737ms cold 解消)。
      // organization_id フィルタは外す: anon RLS が is_active=true のみ対象のため、
      // org_id で絞ると環境によっては空配列になる。
      const [staffRes, deviceRows] = await Promise.all([
        supabase
          .from('staff')
          .select('staff_id, name, name_kana, has_pin')
          .eq('is_active', true)
          .order('name_kana'),
        fetchDeviceLoginRows(),
      ])

      const { data, error } = staffRes
      if (error) {
        setLoadErr(`スタッフ一覧の取得に失敗しました (${error.message})`)
        setInitDone(true)
        return
      }

      let staff = data || []

      // staff テーブルが空の場合は staff_public ビューにフォールバック
      if (staff.length === 0) {
        const { data: pub } = await supabase
          .from('staff')
          .select('staff_id, name, name_kana, has_pin')
          .eq('is_active', true)
          .order('name')
        if (pub?.length) staff = pub
      }

      setAllStaff(staff)
      // device_login_history rows を staff list にマッピング (旧 fetchStarStaff の後半)
      const staffMap = Object.fromEntries(staff.map(s => [s.staff_id, s]))
      const seenStarIds = new Set()
      const star = (deviceRows || [])
        .map(h => staffMap[h.staff_id])
        .filter(s => s && !seenStarIds.has(s.staff_id) && seenStarIds.add(s.staff_id))
      setStarStaff(star)
      setInitDone(true)
    }
    init()
  }, [navigate])

  // SPEC-LOGIN-AUTH-LATENCY-PHASE1-01 R3: 楽観遷移失敗時のエラートースト表示
  useEffect(() => {
    if (!initDone) return
    const authError = sessionStorage.getItem('loginAuthError')
    if (authError) {
      sessionStorage.removeItem('loginAuthError')
      showToast(authError, 'error')
    }
  }, [initDone])

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
    // SPEC-LOGIN-SUCCESS-UNBLOCK-01 R1: non-blocking (do not await)
    upsertLoginHistory(staff.staff_id).catch(e => console.warn('[ERR-LOGIN-HISTORY]', e))
    setSelectedStaff(null)
    showToast(`${staff.name} さん こんにちは`)
    navigate('/launcher', { replace: true })
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
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>Round 0</div>
        <div style={{ fontSize: 18, color: '#9090a8', marginTop: 2 }}>スタッフを選んでPINを入力</div>
      </div>

      {/* タブバー */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* 件数バッジ */}
      <div style={{ flexShrink: 0, padding: '4px 12px 0', fontSize: 15, color: '#64748b' }}>
        {filteredStaff.length}件
      </div>

      {/* 名前リスト(スクロールエリア) */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {loadErr ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#f87171', fontSize: 15 }}>{loadErr}</div>
        ) : (
          <StaffList
            staff={filteredStaff}
            starStaffIds={starStaffIds}
            isStarTab={activeTab === '★'}
            onSelect={staff => {
              setSelectedStaff(staff)
              // SPEC-LOGIN-PREFETCH-ON-STAFF-SELECT-01: PIN入力中(2-5s)の待機時間を先読みに利用。
              // non-blocking: do not await.
              startPrefetch(staff.staff_id)
              // SPEC-LOGIN-VERIFYPIN-WARMUP-IMPL-01 R3(C): tap時にEdgeを再warm-up(cooldown内ならskip)
              warmupVerifyPin()
            }}
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
