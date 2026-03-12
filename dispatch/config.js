// config.js - Configuration Supabase
console.log("✅ config.js chargé");

// 🔴 Configuration directe (SANS variables intermédiaires)
window.SUPABASE_CONFIG = {
    url: 'https://iubbsnntcreneakbdkmv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y'

    // Créer le client Supabase
const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key
);

// Rendre supabase accessible globalement
window.supabaseClient = supabase;
};
// Configuration RH
window.RH_CONFIG = {
    heures_nuit_debut: 23,      // 23h
    heures_nuit_fin: 5,          // 5h
    majoration_nuit: 0.10,       // +10%
    majoration_dimanche: 0.50,   // +50%
    majoration_ferie: 1.00,      // +100%
    seuil_heures_sup_25: 8,      // 8h
    seuil_heures_sup_50: 10,     // 10h
    pause_minimale_apres: 4.5,   // 4h30 de conduite
    duree_pause: 0.75            // 45 minutes
};

console.log("✅ Configuration prête");

// Ajoutez votre clé OpenRouteService
window.ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUxMmJjYzg5NTQ4MGNiYWU2NGFjMzg3ZDFlNjJhY2ZmYWUwNmUxYmM0YzY3NmZmMDI5NjVmOTlhIiwiaCI6Im11cm11cjY0In0=';

