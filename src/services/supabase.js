// Supabase REST API クライアント
// TODO: 後でanon keyに切り替え＋Vercel環境変数へ移行

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gedxzunoyzmvbqgwjalx.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs'

async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 景品マスタ全件取得（1,434件を2バッチで）*/
export async function fetchAllPrizeMasters() {
  const cols = 'prize_id,prize_name,category,status,size,original_cost,jan_code,supplier_id,registered_at'
  const base = `prize_masters?select=${cols}&order=prize_id`
  const [b1, b2] = await Promise.all([
    sbFetch(`${base}&limit=1000&offset=0`),
    sbFetch(`${base}&limit=1000&offset=1000`),
  ])
  return [...b1, ...b2]
}
