// 🔴 REMPLACEZ CES VALEURS PAR VOS IDENTIFIANTS SUPABASE
const SUPABASE_URL = 'https://iubbsnntcreneakbdkmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y';

// Rendre disponible globalement
window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
};

// Initialisation globale de Supabase (optionnel)
window.supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
