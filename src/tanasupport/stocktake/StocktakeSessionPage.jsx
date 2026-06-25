import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../shared/ui/PageHeader'
import {
  getOrCreateMonthSession,
  getMachineItems,
  getStaffItems,
  declareZero,
  getZeroDeclaration,
  getSessionSummary,
} from './api'

const TABS = [
  { key: 'machine',  label: '機械' },
  { key: 'personal', label: '個人' },
  { key: 'summary',  label: '合計' },
]

export default function StocktakeSessionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { staffId } = useAuth()
  const goBackToHub = () => {
    const ownerType = searchParams.get('owner_type')
    const ownerId   = searchParams.get('owner_id')
    return ownerType && ownerId
      ? navigate(`/stock/hub?owner_type=${ownerType}&owner_id=${ownerId}`)
      : navigate('/stock/stocktake')
  }

  const [tab,      setTab]      = useState('machine')
  const [session,  setSession]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const [machineItems, setMachineItems] = useState([])
  const [staffItems,   setStaffItems]   = useState([])
  const [zeroDeclared, setZeroDeclared] = useState(null)
  const [summary,      setSummary]      = useState(null)
  const [declaring,    setDeclaring]    = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const sess = await getOrCreateMonthSession()
        if (cancelled) return
        setSession(sess)

        const [machine, staff, zero, totals] = await Promise.all([
          getMachineItems(sess.session_id),
          staffId ? getStaffItems(sess.session_id, staffId) : Promise.resolve([]),
          staffId ? getZeroDeclaration(sess.session_id, staffId) : Promise.resolve(null),
          getSessionSummary(sess.session_id),
        ])
        if (cancelled) return
        setMachineItems(machine)
        setStaffItems(staff)
        setZeroDeclared(zero)
        setSummary(totals)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeclareZero = async () => {
    if (!session || !staffId || declaring) return
    setDeclaring(true)
    try {
      await declareZero(session.session_id, staffId)
      setZeroDeclared({ declared_at: new Date().toISOString() })
      const newTotals = await getSessionSummary(session.session_id)
      setSummary(newTotals)
    } finally {
      setDeclaring(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-muted text-sm gap-4 px-5">
      <p>読み込み中...</p>
      {/* J-STOCKTAKE-TARGET-SELECT-01-fix-02 (ヒロ Discord '操作不能は困る、せめて戻れるように'):
          長時間ロード時の脱出口、presentation only (internal data-fetch ロジックは未触) */}
      <button
        type="button"
        onClick={() => navigate('/stock/stocktake')}
        data-testid="stocktake-session-loading-back"
        className="text-xs underline text-muted min-h-[44px] px-3"
      >
        ← 対象選択に戻る
      </button>
    </div>
  )
  if (error) return (
    <div data-testid="stocktake-session-error" className="min-h-screen flex flex-col items-center justify-center bg-bg text-rose-400 text-sm px-5 text-center gap-4">
      <p className="break-all">{error}</p>
      {/* J-STOCKTAKE-TARGET-SELECT-01-fix-02: エラー時の脱出口を明示 (presentation only) */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={() => navigate('/stock/stocktake')}
          data-testid="stocktake-session-error-back-target"
          className="w-full min-h-[44px] rounded-xl bg-surface border border-border text-text font-bold"
        >
          ← 対象選択に戻る
        </button>
        <button
          type="button"
          onClick={() => navigate('/launcher')}
          data-testid="stocktake-session-error-back-launcher"
          className="w-full min-h-[44px] rounded-xl bg-surface border border-border text-muted text-xs"
        >
          メインメニューへ
        </button>
      </div>
    </div>
  )

  const monthLabel = session?.month
    ? new Date(session.month + 'T00:00:00+09:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-screen bg-bg text-text pb-24" data-testid="stocktake-session">
      <PageHeader
        module="tanasupport"
        title="棚卸しセッション"
        subtitle={monthLabel}
        onBack={goBackToHub}
      />

      {/* タブバー */}
      <div className="flex border-b border-border sticky top-0 bg-bg z-10">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              tab === t.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted'
            }`}
            data-testid={`tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'machine'  && <MachineTab  items={machineItems} />}
      {tab === 'personal' && (
        <PersonalTab
          items={staffItems}
          zeroDeclared={zeroDeclared}
          onDeclareZero={handleDeclareZero}
          declaring={declaring}
        />
      )}
      {tab === 'summary'  && <SummaryTab  summary={summary} />}

      <div className="fixed bottom-0 inset-x-0 bg-bg border-t border-border px-5 py-3">
        <button
          onClick={goBackToHub}
          className="w-full h-12 bg-surface border border-border text-text text-sm rounded-2xl font-medium active:scale-[0.98] transition-all"
        >
          ← ハブに戻る
        </button>
      </div>
    </div>
  )
}

function MachineTab({ items }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center" data-testid="machine-tab">
        <p className="text-3xl mb-3">⏳</p>
        <p className="text-muted text-sm">スナップショット未取得</p>
        <p className="text-muted text-xs mt-1">月末23:59に自動取得されます</p>
      </div>
    )
  }

  const grouped = {}
  for (const item of items) {
    if (!grouped[item.owner_code]) grouped[item.owner_code] = []
    grouped[item.owner_code].push(item)
  }

  return (
    <div className="px-5 pt-4 pb-4" data-testid="machine-tab">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
          READ ONLY — M1由来スナップショット
        </span>
      </div>
      {Object.entries(grouped).map(([boothCode, prizes]) => (
        <div key={boothCode} className="mb-4">
          <p className="text-xs font-bold text-muted mb-1.5">{boothCode}</p>
          <div className="grid grid-cols-2 gap-2">
            {prizes.map(item => (
              <div
                key={item.prize_id}
                className="bg-surface border border-border rounded-xl p-2.5"
                data-testid={`machine-item-${item.prize_id}`}
              >
                <p className="text-xs text-text truncate font-medium leading-snug">
                  {item.prize_name}
                </p>
                <p className="text-xl font-mono font-bold text-text text-center mt-1">
                  {item.theoretical_count}
                </p>
                <p className="text-[10px] text-muted text-center">理論値</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PersonalTab({ items, zeroDeclared, onDeclareZero, declaring }) {
  return (
    <div className="px-5 pt-4" data-testid="personal-tab">
      {zeroDeclared ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4 text-center">
          <p className="text-emerald-400 font-bold text-base">ゼロ申告済み</p>
          <p className="text-muted text-xs mt-1">
            {new Date(zeroDeclared.declared_at).toLocaleDateString('ja-JP', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      ) : (
        <button
          onClick={onDeclareZero}
          disabled={declaring}
          className="w-full h-14 bg-accent text-bg font-bold text-base rounded-2xl mb-4 disabled:opacity-60 active:scale-[0.98] transition-all"
          data-testid="btn-declare-zero"
        >
          {declaring ? '申告中...' : '個人持ち回り景品 ゼロ申告'}
        </button>
      )}

      {items.length === 0 && !zeroDeclared && (
        <p className="text-center text-muted text-sm py-8">
          個人持ち回り景品の記録がありません
          <br />
          <span className="text-xs mt-1 block">景品がない場合はゼロ申告ボタンを押してください</span>
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {items.map(item => (
            <div
              key={item.prize_id}
              className="bg-surface border border-border rounded-xl p-2.5"
            >
              <p className="text-xs text-text truncate font-medium">{item.prize_name}</p>
              <p className="text-xl font-mono font-bold text-text text-center mt-1">
                {item.actual_count}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryTab({ summary }) {
  if (!summary) return null
  const total = (summary.location ?? 0) + (summary.booth ?? 0) + (summary.staff ?? 0)

  return (
    <div className="px-5 pt-4" data-testid="summary-tab">
      <div className="space-y-3">
        <SummaryRow emoji="🏭" label="倉庫"   count={summary.location ?? 0} />
        <SummaryRow emoji="🎮" label="機械内" count={summary.booth ?? 0} />
        <SummaryRow emoji="👤" label="個人"   count={summary.staff ?? 0} />
        <div className="border-t border-border pt-3">
          <SummaryRow emoji="📦" label="全社合計" count={total} bold />
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ emoji, label, count, bold = false }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl ${
        bold
          ? 'bg-surface border border-accent/30'
          : 'bg-surface border border-border'
      }`}
      data-testid={`summary-row-${label}`}
    >
      <span className={`text-sm ${bold ? 'font-bold text-text' : 'text-muted'}`}>
        {label}
      </span>
      <span
        className={`font-mono ${
          bold ? 'text-2xl font-bold text-accent' : 'text-lg font-bold text-text'
        }`}
        data-testid={`summary-count-${label}`}
      >
        {count.toLocaleString()}
      </span>
    </div>
  )
}
