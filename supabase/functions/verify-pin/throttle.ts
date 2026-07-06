// SPEC-AUTH-VERIFYPIN-TIMELOCK-01 — pure throttle helpers.
// No Deno / network imports so both the Edge Function (Deno) and vitest (Node) can import it.

// Capped exponential backoff (SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01, hiro-confirmed,
// OWASP/Cognito-style 5-attempt start):
//   fails 1-4 -> 0s (silent grace), 5 -> 4s, 6 -> 8s, 7+ -> 8s cap.
// This is a TIME LOCK (throttle), never a hard lock. >=50 fails still returns the 8s cap.
export function throttleDelaySec(failCount: number): number {
  if (failCount < 5) return 0;
  return Math.min(8, 4 * 2 ** (failCount - 5));
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

// SPEC-AUTH-AUTHLOGS-WAITUNTIL-AWAIT-01: audit-log writes MUST be awaited (EdgeRuntime.waitUntil
// is dropped when the isolate shuts down after responding, so login_success/login_failed rows
// were probabilistically lost). Awaiting guarantees the row commits before the Response returns.
// try/catch: a logging failure must NEVER break login (console.error only, for Sentry).
type AuthLogRow = { staff_id: string; action: string; ip_address: string; user_agent: string };
export async function writeAuthLog(
  db: { from: (t: string) => { insert: (row: AuthLogRow) => Promise<{ error: unknown }> } },
  row: AuthLogRow,
): Promise<void> {
  try {
    const { error } = await db.from("auth_logs").insert(row);
    if (error) throw error;
  } catch (e) {
    console.error("[verify-pin] auth_logs insert failed", row?.action, e);
  }
}

// SPEC-AUTH-TIMELOCK-TUNE-AND-SPINNER-01 change_C: JWT-metadata refresh is fire-and-forget so
// the success path issues the session with a SINGLE signInWithPassword (the double signIn was
// the 4-5s spinner). The session returned to the client is the first issue; a slightly stale
// JWT metadata is harmless because the app authorizes off the response body's role, and the
// next login refreshes it. An updateUserById failure must NEVER break login (console.error only).
export function updateUserMetaAsync(
  admin: { auth: { admin: { updateUserById: (id: string, attrs: unknown) => Promise<unknown> } } },
  userId: string,
  attrs: unknown,
): void {
  try {
    // invoke synchronously (fire-and-forget); guard both a sync throw and an async rejection
    Promise.resolve(admin.auth.admin.updateUserById(userId, attrs))
      .catch((e: unknown) => console.error("[verify-pin] updateUserById failed", e));
  } catch (e) {
    console.error("[verify-pin] updateUserById failed", e);
  }
}
