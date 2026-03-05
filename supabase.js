// supabase.js
const SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"

// La librairie expose window.supabase
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Optionnel : rendre accessible partout (si d'autres fichiers en ont besoin)
window.supabaseClient = supabaseClient;
