// Initialisation globale de Supabase (optionnel)
window.supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// config.js - Configuration Supabase
console.log("✅ config.js chargé");

// 🔴 REMPLACEZ CES VALEURS PAR VOS IDENTIFIANTS SUPABASE
window.SUPABASE_CONFIG = {
    url: 'https://iubbsnntcreneakbdkmv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y'
};

// NE PAS CRÉER LE CLIENT ICI ! On le fera dans chaque page
console.log("✅ Configuration disponible");
