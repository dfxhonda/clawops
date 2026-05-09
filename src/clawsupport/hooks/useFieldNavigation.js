export function useFieldNavigation() {
  function navigateNext(fromTabindex) {
    const all = Array.from(document.querySelectorAll('[data-tabindex]'))
      .sort((a, b) => Number(a.dataset.tabindex) - Number(b.dataset.tabindex))
    const idx = all.findIndex(el => Number(el.dataset.tabindex) === fromTabindex)
    const next = all[idx + 1]
    if (next) {
      next.focus()
    }
  }
  return { navigateNext }
}
