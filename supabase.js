// supabase.js
const SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_AkBuF7AiMVxXuvTF1Mx3Zw_8AuW3gGb"

// La librairie expose window.supabase
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Optionnel : rendre accessible partout (si d'autres fichiers en ont besoin)
window.supabaseClient = supabaseClient;
