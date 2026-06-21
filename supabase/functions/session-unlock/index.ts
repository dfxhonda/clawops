// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: session-unlock 廃止 (ロック解除不要、idle=logout化)
// This Edge Function has been deactivated. Lock-screen flow removed; idle timeout now logs out directly.
Deno.serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ error: 'session-unlock is retired. Idle timeout now calls logout directly.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
});
