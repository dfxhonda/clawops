/**
 * useFeatureFlag — feature_flags テーブルを参照してフラグの on/off を返す
 *
 * Kill Switch: VITE_FF_KILL_<FLAG_KEY_UPPER>=true の環境変数で強制 false
 *   例: VITE_FF_KILL_PATROL_CORE=true → patrol_core を強制無効
 *
 * 戻り値:
 *   { enabled: boolean, loading: boolean }
 *
 * 使用例:
 *   const { enabled } = useFeatureFlag('patrol_core')
 *   if (!enabled) return <FeatureDisabled />
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const cache = new Map()

export function useFeatureFlag(flagKey) {
  const killKey = `VITE_FF_KILL_${flagKey.toUpperCase().replace(/-/g, '_')}`
  const killed = import.meta.env[killKey] === 'true'

  const [state, setState] = useState(() => ({
    enabled: !killed && (cache.get(flagKey) ?? true),
    loading: !killed && !cache.has(flagKey),
  }))

  useEffect(() => {
    if (killed) {
      setState({ enabled: false, loading: false })
      return
    }
    if (cache.has(flagKey)) {
      setState({ enabled: cache.get(flagKey), loading: false })
      return
    }
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_key', flagKey)
      .maybeSingle()
      .then(({ data }) => {
        // 未登録フラグは有効扱い（フラグなし = 使える）
        const enabled = data ? data.enabled : true
        cache.set(flagKey, enabled)
        setState({ enabled, loading: false })
      })
  }, [flagKey, killed])

  return state
}
