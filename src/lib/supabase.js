import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gedxzunoyzmvbqgwjalx.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs'

export const supabase = createClient(supabaseUrl, supabaseKey)

/** 景品マスタ全件取得（ページネーション） */
export async function fetchAllPrizeMasters() {
  const cols = 'prize_id,prize_name,category,status,size,original_cost,jan_code,supplier_id,registered_at'
  const pageSize = 1000
  let all = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('prize_masters')
      .select(cols)
      .order('prize_id')
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}
