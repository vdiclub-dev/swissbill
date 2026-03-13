// Initialisation du client Supabase
console.log("🔄 Chargement de Supabase...");

// Vérifier que la config est chargée
if (!window.SUPABASE_CONFIG) {
    console.error("❌ SUPABASE_CONFIG non trouvé. Vérifiez que config.js est chargé AVANT ce fichier.");
}

// Créer le client Supabase
export const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key
);

console.log("✅ Client Supabase prêt");
