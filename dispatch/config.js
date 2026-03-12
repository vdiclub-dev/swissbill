// config.js - Configuration Supabase
console.log("✅ config.js chargé");

// Configuration Supabase
window.SUPABASE_CONFIG = {
    url: 'https://iubbsnntcreneakbdkmv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y'
};

// Configuration RH
window.RH_CONFIG = {
    heures_nuit_debut: 23,
    heures_nuit_fin: 5,
    majoration_nuit: 0.10,
    majoration_dimanche: 0.50,
    majoration_ferie: 1.00,
    seuil_heures_sup_25: 8,
    seuil_heures_sup_50: 10,
    pause_minimale_apres: 4.5,
    duree_pause: 0.75
};

// Configuration OpenRouteService
window.ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUxMmJjYzg5NTQ4MGNiYWU2NGFjMzg3ZDFlNjJhY2ZmYWUwNmUxYmM0YzY3NmZmMDI5NjVmOTlhIiwiaCI6Im11cm11cjY0In0=';

console.log("✅ Configuration prête");

// NE PAS CRÉER LE CLIENT SUPABASE ICI !
// Le client sera créé dans chaque page individuellement
// car window.supabase n'est pas encore chargé
