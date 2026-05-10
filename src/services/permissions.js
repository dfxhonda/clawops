export function isAdmin(staffRole) {
  return staffRole === 'admin'
}

export function canEditMeter(staffRole) {
  return staffRole === 'admin'
}
