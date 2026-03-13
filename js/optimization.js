import { calculerMatriceDistances } from './routing.js';
import { geocoderTournee } from './geocoding.js';

/**
 * Optimise l'ordre d'une tournée en testant plusieurs points de départ
 * @param {Array} transports - Liste des transports
 * @param {Object} depot - {lat, lng}
 * @param {Function} showMessage - Fonction d'affichage
 * @returns {Promise<Array|null>} Tournée optimisée ou null
 */
export async function optimiserTournee(transports, depot, showMessage) {
    if (!transports || transports.length === 0) return null;
    
    showMessage("🔄 Optimisation en cours...", "#3b82f6");
    
    // 1. Géocoder si nécessaire
    await geocoderTournee(transports, showMessage);
    
    // 2. Filtrer les transports avec coordonnées
    const avecCoords = transports.filter(t => t.lat && t.lng);
    
    if (avecCoords.length === 0) {
        showMessage("❌ Aucune coordonnée disponible", "#ef4444");
        return null;
    }
    
    // 3. Construire la matrice des distances
    const points = [depot, ...avecCoords];
    const matrice = await calculerMatriceDistances(points);
    
    // 4. Trouver le meilleur itinéraire
    let meilleurItineraire = null;
    let meilleureDistance = Infinity;
    
    // Essayer chaque point comme départ potentiel
    for (let depart = 1; depart < points.length; depart++) {
        let itineraire = [];
        let visites = new Set();
        let distance = 0;
        let courant = 0; // dépôt
        
        // Premier point
        itineraire.push(points[depart]);
        visites.add(depart);
        distance += matrice[0][depart];
        courant = depart;
        
        // Points suivants
        while (visites.size < points.length - 1) {
            let prochain = -1;
            let minDist = Infinity;
            
            for (let i = 1; i < points.length; i++) {
                if (!visites.has(i) && matrice[courant][i] < minDist) {
                    minDist = matrice[courant][i];
                    prochain = i;
                }
            }
            
            if (prochain !== -1) {
                itineraire.push(points[prochain]);
                visites.add(prochain);
                distance += minDist;
                courant = prochain;
            } else {
                break;
            }
        }
        
        // Retour au dépôt
        distance += matrice[courant][0];
        
        if (distance < meilleureDistance) {
            meilleureDistance = distance;
            meilleurItineraire = itineraire;
        }
    }
    
    if (meilleurItineraire) {
        showMessage(`✅ Optimisation terminée: ${Math.round(meilleureDistance)} km`, "#10b981");
        return meilleurItineraire;
    }
    
    showMessage("❌ Échec de l'optimisation", "#ef4444");
    return null;
}
