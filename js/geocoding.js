
import { supabase } from './supabase.js';

// Cache pour éviter les appels répétés
const geocodeCache = new Map();

/**
 * Géocode une adresse avec Nominatim
 * @param {string} adresse - Adresse complète
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function geocoderAdresse(adresse) {
    if (!adresse) return null;
    
    // Vérifier le cache
    if (geocodeCache.has(adresse)) {
        return geocodeCache.get(adresse);
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse + ', Suisse')}&limit=1`,
            { headers: { 'User-Agent': 'LemanDispatch/1.0' } }
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
            geocodeCache.set(adresse, coords);
            return coords;
        }
    } catch(e) {
        console.warn("Erreur géocodage:", e);
    }
    return null;
}

/**
 * Géocode tous les transports d'une tournée qui n'ont pas de coordonnées
 * @param {Array} transports - Liste des transports
 * @param {Function} showMessage - Fonction d'affichage des messages
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function geocoderTournee(transports, showMessage) {
    let success = 0;
    let failed = 0;
    
    for (let t of transports) {
        if (!t.lat || !t.lng) {
            const coords = await geocoderAdresse(t.delivery_address);
            if (coords) {
                t.lat = coords.lat;
                t.lng = coords.lng;
                
                await supabase
                    .from('transport_orders_simple')
                    .update({ lat: coords.lat, lng: coords.lng })
                    .eq('id', t.id);
                
                success++;
            } else {
                failed++;
            }
        }
    }
    
    if (showMessage) {
        showMessage(`📍 Géocodage: ${success} OK, ${failed} échec`, success > 0 ? '#10b981' : '#ef4444');
    }
    
    return { success, failed };
}
