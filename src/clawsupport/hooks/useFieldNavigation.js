import { useState, useCallback } from 'react'

export function useFieldNavigation() {
  const [currentField, setCurrentField] = useState(null)

  const registerField = useCallback((field) => {
    setCurrentField(field)
  }, [])

  const clearField = useCallback(() => {
    setCurrentField(null)
  }, [])

  function navigateNext(fromTabindex) {
    const all = Array.from(document.querySelectorAll('[data-tabindex]'))
      .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
    const idx = all.findIndex(el => Number(el.dataset.tabindex) === fromTabindex)
    const next = all[idx + 1]
    if (next?._numpadActivate) next._numpadActivate()
    else if (next) next.focus()
  }

  return { navigateNext, currentField, registerField, clearField }
}
