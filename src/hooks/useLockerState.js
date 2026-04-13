// ============================================
// useLockerState: ロッカースロット状態管理
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { ensureLockerSlots, updateLockerSlot } from '../services/patrolV2'

export function useLockerState(lockers = []) {
  // lockers: [{ locker_id, locker_number, slot_count, lock_type }]
  const [slotsByLocker, setSlotsByLocker] = useState({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!lockers.length) return
    setLoading(true)
    const results = await Promise.all(lockers.map(l => ensureLockerSlots(l.locker_id, l.slot_count || 5)))
    const map = {}
    lockers.forEach((l, i) => { map[l.locker_id] = results[i] })
    setSlotsByLocker(map)
    setLoading(false)
  }, [lockers.map(l => l.locker_id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  const summary = Object.values(slotsByLocker).flat().reduce(
    (acc, s) => ({
      total: acc.total + (s.status === 'filled' ? (s.prize_value || 0) : 0),
      empty: acc.empty + (s.status === 'empty' ? 1 : 0),
    }),
    { total: 0, empty: 0 }
  )

  const wonSlot = useCallback(async (slotId, staffId) => {
    await updateLockerSlot(slotId, { prizeName: null, prizeValue: 0, status: 'empty', staffId, action: 'won' })
    await refresh()
  }, [refresh])

  const fillSlot = useCallback(async (slotId, { name, value }, staffId) => {
    await updateLockerSlot(slotId, { prizeName: name, prizeValue: value, status: 'filled', staffId, action: 'set' })
    await refresh()
  }, [refresh])

  const removeSlot = useCallback(async (slotId, staffId) => {
    await updateLockerSlot(slotId, { prizeName: null, prizeValue: 0, status: 'empty', staffId, action: 'remove' })
    await refresh()
  }, [refresh])

  const swapSlot = useCallback(async (slotId, { name, value }, staffId) => {
    await updateLockerSlot(slotId, { prizeName: name, prizeValue: value, status: 'filled', staffId, action: 'swap' })
    await refresh()
  }, [refresh])

  return { slotsByLocker, loading, refresh, summary, wonSlot, fillSlot, removeSlot, swapSlot }
}
