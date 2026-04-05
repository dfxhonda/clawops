// ============================================
// useDrafts: ドラフト永続化ユーティリティ
// MainInput / BoothInput / PatrolInput 共通
// ============================================

const DRAFT_KEY = 'clawops_drafts_v2'

export function getDrafts() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') } catch { return {} }
}

export function setDrafts(d) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
}

export function clearDraftBooth(boothId) {
  const d = getDrafts()
  delete d[boothId]
  setDrafts(d)
}

export function clearDraftBooths(boothIds) {
  const d = getDrafts()
  for (const id of boothIds) delete d[id]
  setDrafts(d)
}

export function saveDraftBooth(boothId, data) {
  const d = getDrafts()
  d[boothId] = data
  setDrafts(d)
}

export function getDraftBooth(boothId) {
  return getDrafts()[boothId] || null
}
