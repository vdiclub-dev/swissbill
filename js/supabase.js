const supabaseUrl = "https://iubbsnntcreneakbdkmv.supabase.co"

const supabaseKey = "sb_publishable_AkBuF7AiMVxXuvTF1Mx3Zw_8AuW3gGb"

const supabaseClient = supabase.createClient(
  supabaseUrl,
  supabaseKey
)

window.supabaseClient = supabaseClient
if (!window.SUPABASE_CLIENT) {
  window.SUPABASE_CLIENT = supabaseClient
}
