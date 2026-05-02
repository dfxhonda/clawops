import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';

Sentry.init({
  dsn: process.env.SENTRY_DSN_BACKEND,
  environment: process.env.VERCEL_ENV || 'unknown',
  enabled: !!process.env.SENTRY_DSN_BACKEND,
  tracesSampleRate: 0,
});

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const checks = {
    db: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );
    const { error } = await supabase
      .from('stores')
      .select('id')
      .limit(1);
    if (error) throw error;
    checks.db = true;
  } catch (err) {
    Sentry.captureException(err, { tags: { check: 'db' } });
    await Sentry.flush(2000);
    return res.status(500).json({ status: 'fail', checks, error: err.message });
  }

  await Sentry.flush(2000);
  return res.status(200).json({ status: 'ok', checks });
}
