import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const LOCK_DURATION = 30 // seconds
const MAX_FAILS = 3

export default function StocktakeLogin() {
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState([])
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [failCount, setFailCount] = useState(0)
  const [lockUntil, setLockUntil] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    supabase
      .from('staff')
      .select('staff_id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStaffList(data ?? []))
  }, [])

  // ロックカウントダウン
  useEffect(() => {
    if (!lockUntil) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= lockUntil) {
        setLockUntil(null)
        setFailCount(0)
        clearInterval(t)
      }
    }, 500)
    return () => clearInterval(t)
  }, [lockUntil])

  function handleSelectStaff(staff) {
    setSelected(staff)
    setPin('')
    setError('')
  }

  function handleBack() {
    setSelected(null)
    setPin('')
    setError('')
    setFailCount(0)
    setLockUntil(null)
  }

  async function handlePinDigit(digit) {
    if (lockUntil && Date.now() < lockUntil) return
    const next = pin + digit
    setPin(next)
    if (next.length < 4) return

    // 4桁揃ったら認証
    const { data } = await supabase
      .from('staff')
      .select('staff_id, name, pin')
      .eq('is_active', true)
      .eq('staff_id', selected.staff_id)
      .single()

    if (data?.pin === next) {
      sessionStorage.setItem('stocktake_staff_id', data.staff_id)
      sessionStorage.setItem('stocktake_staff_name', data.name)
      navigate('/stock/top')
    } else {
      const newFail = failCount + 1
      setFailCount(newFail)
      setPin('')
      if (newFail >= MAX_FAILS) {
        setLockUntil(Date.now() + LOCK_DURATION * 1000)
        setError(`${MAX_FAILS}回失敗しました。${LOCK_DURATION}秒後に再試行できます。`)
      } else {
        setError(`PINが違います（${newFail}/${MAX_FAILS}回）`)
      }
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  const locked = lockUntil && Date.now() < lockUntil
  const lockRemain = locked ? Math.ceil((lockUntil - now) / 1000) : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text px-6">
      <div className="w-full max-w-sm">

        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">📦</div>
          <div className="text-lg font-bold">棚卸しアプリ</div>
          <div className="text-xs text-muted mt-1">スタッフを選んでください</div>
        </div>

        {/* スタッフ選択 */}
        {!selected && (
          <div className="space-y-2">
            {staffList.map(s => (
              <button
                key={s.staff_id}
                onClick={() => handleSelectStaff(s)}
                className="w-full py-4 rounded-xl bg-surface border border-border text-sm font-bold active:scale-[0.98] transition-all hover:border-accent/40"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* PIN入力 */}
        {selected && (
          <div>
            <div className="text-center mb-6">
              <div className="text-base font-bold">{selected.name}</div>
              <div className="text-xs text-muted mt-1">PINを入力してください</div>
            </div>

            {/* PIN表示 */}
            <div className="flex justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all
                    ${i < pin.length ? 'bg-accent border-accent text-bg' : 'bg-surface border-border'}`}
                >
                  {i < pin.length ? '●' : ''}
                </div>
              ))}
            </div>

            {/* エラー */}
            {error && (
              <div className="text-center text-xs text-red-400 mb-3">
                {locked ? `🔒 ロック中 あと${lockRemain}秒` : error}
              </div>
            )}

            {/* テンキー */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button
                  key={n}
                  onClick={() => handlePinDigit(String(n))}
                  disabled={locked}
                  className="py-4 rounded-xl bg-surface border border-border text-lg font-bold active:bg-surface2 disabled:opacity-40 transition-all"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={handleBack}
                className="py-4 rounded-xl text-xs text-muted active:bg-surface2 transition-all"
              >
                戻る
              </button>
              <button
                onClick={() => handlePinDigit('0')}
                disabled={locked}
                className="py-4 rounded-xl bg-surface border border-border text-lg font-bold active:bg-surface2 disabled:opacity-40 transition-all"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                disabled={locked}
                className="py-4 rounded-xl text-lg text-muted active:bg-surface2 disabled:opacity-40 transition-all"
              >
                ⌫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
