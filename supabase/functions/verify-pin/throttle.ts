// SPEC-AUTH-VERIFYPIN-TIMELOCK-01 — pure throttle helpers.
// No Deno / network imports so both the Edge Function (Deno) and vitest (Node) can import it.

// Capped exponential backoff (hiro-confirmed curve):
//   fails 1-2 -> 0s (silent grace), 3 -> 1s, 4 -> 2s, 5 -> 4s, 6+ -> 8s cap.
// This is a TIME LOCK (throttle), never a hard lock. >=50 fails still returns the 8s cap.
export function throttleDelaySec(failCount: number): number {
  if (failCount < 3) return 0;
  return Math.min(8, 2 ** (failCount - 3));
}

// verify_staff_pin returns this text for unknown / inactive staff. Used to stay
// enumeration-safe: such attempts get the SAME generic 401 and persist NO auth_logs row.
export function isStaffNotFound(errorMsg?: string | null): boolean {
  return typeof errorMsg === "string" && errorMsg.includes("スタッフが見つかりません");
}

// Count login_failed since the most recent login_success, over rows already scoped to the
// rolling window and ordered created_at DESC. A login_success is a reset point
// (counter_reset case 1: successful login). Rolling-window expiry (case 3) is handled by
// the caller only fetching the last 60 minutes.
export function failsSinceLastSuccess(rows: Array<{ action: string }>): number {
  let count = 0;
  for (const r of rows) {
    if (r.action === "login_success") break;
    if (r.action === "login_failed") count++;
  }
  return count;
}
