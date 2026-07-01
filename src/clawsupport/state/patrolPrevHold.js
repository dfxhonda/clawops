// SPEC-PATROL-SWIPE-LATENCY-FIX-03: module-level in-memory hold for synced baseline prev.
// Mirrors swipeTransition.js pattern: module-level, router/sessionStorage avoided.
// tier-0 prev cache: microsecond reads vs IDB milliseconds, zero Supabase per swipe.
//
// Store-scoped: setPrevHold replaces the entire map on store entry (one store at a time).
// clearPrevHold on store exit. Only synced baseline held — unsynced edits remain tier-1 (IDB).
// IDB baseline stays source of truth; hold is a fast read layer only. No writes go through hold.

let _currentStoreCode = null
let _holdMap = new Map()  // boothCode -> prev row

export function setPrevHold(storeCode, boothToPrevMap) {
  _currentStoreCode = storeCode
  _holdMap = new Map(Object.entries(boothToPrevMap))
}

export function getPrevHold(boothCode) {
  return _holdMap.get(boothCode) ?? null
}

export function clearPrevHold(storeCode) {
  if (storeCode == null || storeCode === _currentStoreCode) {
    _currentStoreCode = null
    _holdMap = new Map()
  }
}

export function _resetPrevHold() {
  _currentStoreCode = null
  _holdMap = new Map()
}
