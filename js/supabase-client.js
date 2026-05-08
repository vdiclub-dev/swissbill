const supabase = window.supabase.createClient(
  window.COLIXO_SUPABASE_URL,
  window.COLIXO_SUPABASE_ANON_KEY
);

window.supabaseClient = supabase;
if (!window.SUPABASE_CLIENT) {
  window.SUPABASE_CLIENT = supabase;
}
