// /js/supabase.js - VERSION CORRECTE
console.log("🔄 Chargement de Supabase...");

if (!window.SUPABASE_CONFIG) {
    console.error("❌ SUPABASE_CONFIG non trouvé. Vérifiez que config.js est chargé AVANT ce fichier.");
}

export const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key
);

console.log("✅ Client Supabase prêt");
