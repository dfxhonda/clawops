export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    return res.status(500).json({ error: 'VITE_SUPABASE_URL not set' });
  }

  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/verify-pin`, { method: 'GET' });
    return res.status(200).json({ ok: true, status: r.status });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
