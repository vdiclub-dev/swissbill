/**
 * COLIXO - Configuration Supabase
 * 
 * IMPORTANT: Utiliser uniquement la clé ANON côté frontend
 * Ne jamais exposer la clé service_role dans le navigateur
 */

// Configuration Supabase - À adapter avec vos propres valeurs
const SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_ANON_KEY'
};

// Initialisation de Supabase
let supabase = null;

function initSupabase() {
    if (!supabase) {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase JS library not loaded. Include the script tag.');
            return null;
        }
        supabase = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
    }
    return supabase;
}

// Récupérer le client connecté depuis la table clients
async function getCurrentClient() {
    const db = initSupabase();
    if (!db) return null;

    try {
        const { data: { user } } = await db.auth.getUser();
        
        if (!user) {
            console.warn('No authenticated user');
            return null;
        }

        // Récupérer le profil client depuis la table clients
        const { data: client, error } = await db
            .from('clients')
            .select('id, company_name, email, default_pickup_address')
            .eq('user_id', user.id)
            .single();

        if (error || !client) {
            console.error('Client profile not found:', error);
            return null;
        }

        return {
            id: client.id,
            userId: user.id,
            email: user.email,
            companyName: client.company_name,
            defaultPickupAddress: client.default_pickup_address
        };
    } catch (err) {
        console.error('Error getting current client:', err);
        return null;
    }
}

// Vérifier si l'utilisateur est connecté
async function checkAuth() {
    const db = initSupabase();
    if (!db) return false;

    const { data: { session } } = await db.auth.getSession();
    return !!session;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initSupabase, getCurrentClient, checkAuth, SUPABASE_CONFIG };
}
