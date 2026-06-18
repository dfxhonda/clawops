-- SPEC-LOGIN-AUTH-LATENCY-PHASE1-01 R1: verify-pin ウォームアップcron新設
-- Edge Function コールド起動を防ぐため5分毎GETを送信
-- GET分岐は既に {ok:true} 200を返す実装済み
SELECT cron.schedule(
  'verify-pin-warmup',
  '*/5 * * * *',
  $$SELECT net.http_get(
    url := 'https://gedxzunoyzmvbqgwjalx.supabase.co/functions/v1/verify-pin',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs"}'::jsonb,
    timeout_milliseconds := 5000
  );$$
);
