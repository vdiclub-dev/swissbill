const SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co"
const SUPABASE_KEY = "sb_publishable_AkBuF7AiMVxXuvTF1Mx3Zw_8AuW3gGb"

const { createClient } = supabase

const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
)
