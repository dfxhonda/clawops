export function isInternalNote(notes) {
  if (!notes) return false
  return notes.startsWith('backfilled') || notes.includes('from order_source')
}
