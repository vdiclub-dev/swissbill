// /js/optimization.js - VERSION CORRECTE
import { calculerMatriceDistances } from './routing.js';
import { geocoderTournee } from './geocoding.js';

export async function optimiserTournee(transports, depot, showMessage) {
    if (!transports || transports.length === 0) return null;
    
    if (showMessage) showMessage("🔄 Optimisation en cours...", "#3b82f6");
    
    await geocoderTournee(transports, showMessage);
    
    const avecCoords = transports.filter(t => t.lat && t.lng);
    
    if (avecCoords.length === 0) {
        if (showMessage) showMessage("❌ Aucune coordonnée disponible", "#ef4444");
        return null;
    }
    
    const points = [depot, ...avecCoords];
    const matrice = await calculerMatriceDistances(points);
    
    let meilleurItineraire = null;
    let meilleureDistance = Infinity;
    
    for (let depart = 1; depart < points.length; depart++) {
        let itineraire = [];
        let visites = new Set();
        let distance = 0;
        let courant = 0;
        
        itineraire.push(points[depart]);
        visites.add(depart);
        distance += matrice[0][depart].distance;
        courant = depart;
        
        while (visites.size < points.length - 1) {
            let prochain = -1;
            let minDist = Infinity;
            
            for (let i = 1; i < points.length; i++) {
                if (!visites.has(i) && matrice[courant][i].distance < minDist) {
                    minDist = matrice[courant][i].distance;
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
        
        distance += matrice[courant][0].distance;
        
        if (distance < meilleureDistance) {
            meilleureDistance = distance;
            meilleurItineraire = itineraire;
        }
    }
    
    if (meilleurItineraire) {
        if (showMessage) showMessage(`✅ Optimisation terminée: ${Math.round(meilleureDistance)} km`, "#10b981");
        return meilleurItineraire;
    }
    
    if (showMessage) showMessage("❌ Échec de l'optimisation", "#ef4444");
    return null;
}

console.log("✅ Module optimization.js chargé");
