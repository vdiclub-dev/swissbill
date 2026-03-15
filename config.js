// ============================================================
//  config.js — Configuration Supabase pour Léman-Courses
//  ⚠️  Ne jamais committer ce fichier dans un dépôt public !
// ============================================================

window.SUPABASE_CONFIG = {
    url: "https://iubbsnntcreneakbdkmv.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
};

// Client unique partagé — même storageKey sur toutes les pages
window.SUPABASE_CLIENT = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key,
    {
        auth: {
            persistSession: true,
            storageKey: 'leman-courses-auth',
            storage: window.localStorage,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

console.log('✅ Configuration Supabase chargée');
