export function isInternalNote(notes) {
  if (!notes) return false
  return notes.startsWith('backfilled') || notes.includes('from order_source')
}

const STATUS_LABELS = {
  ordered: '発注済',
  shipped: '発送済',
  arrived: '入荷済',
  cancelled: 'キャンセル',
}

export function statusLabel(status) {
  if (!status) return status
  return STATUS_LABELS[status] ?? status
}
