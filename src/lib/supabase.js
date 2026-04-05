import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gedxzunoyzmvbqgwjalx.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHh6dW5veXptdmJxZ3dqYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0ODA1OCwiZXhwIjoyMDg5NzI0MDU4fQ.ATjGmg5kdm-cs_663ddOUvwTZ8vbn24aSjz6uUYm4Fs'

export const supabase = createClient(supabaseUrl, supabaseKey)
