// SPEC-LIST-FILTER-SORT-01: 全リスト共通の列ソート hook。
// 初期 sortKey=null (挿入順)、同キー再クリックで asc/desc トグル、
// 別キークリックで新 key+asc に切替。値型を自動判定 (数値 / 日付文字列 / 文字列)
// して比較する。null/undefined は常に末尾に並ぶ (asc/desc とも)。
import { useCallback, useMemo, useState } from 'react'

const ISO_DATE_HEAD = /^\d{4}-\d{2}-\d{2}/

function typeOfValue(v) {
  if (v == null) return 'null'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'string') {
    if (ISO_DATE_HEAD.test(v)) return 'date'
    if (/^-?\d+(\.\d+)?$/.test(v)) return 'number'
    return 'string'
  }
  return 'string'
}

export function compareValues(a, b) {
  // null は常に末尾扱い
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const tA = typeOfValue(a)
  const tB = typeOfValue(b)
  if (tA === 'number' && tB === 'number') return Number(a) - Number(b)
  if (tA === 'date' && tB === 'date') {
    return new Date(a).getTime() - new Date(b).getTime()
  }
  return String(a).localeCompare(String(b), 'ja')
}

export function useListSort(initial = { sortKey: null, sortDir: 'asc' }) {
  const [sortKey, setSortKey] = useState(initial.sortKey)
  const [sortDir, setSortDir] = useState(initial.sortDir || 'asc')

  const onSort = useCallback((key) => {
    if (!key) return
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortDir('asc')
      return key
    })
  }, [])

  const sorted = useCallback((data) => {
    if (!Array.isArray(data)) return data
    if (!sortKey) return data
    const copy = data.slice()
    copy.sort((a, b) => {
      const va = a?.[sortKey]
      const vb = b?.[sortKey]
      // null/undefined は常に末尾 (asc/desc とも変えない、direction 反転対象外)。
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = compareValues(va, vb)
      return sortDir === 'desc' ? -cmp : cmp
    })
    return copy
  }, [sortKey, sortDir])

  const reset = useCallback(() => {
    setSortKey(initial.sortKey)
    setSortDir(initial.sortDir || 'asc')
  }, [initial.sortKey, initial.sortDir])

  return useMemo(() => ({ sortKey, sortDir, onSort, sorted, reset }), [sortKey, sortDir, onSort, sorted, reset])
}
