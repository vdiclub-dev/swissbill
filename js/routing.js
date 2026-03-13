// Cache pour les distances routières
const routeCache = new Map();

/**
 * Calcule la distance à vol d'oiseau (formule Haversine)
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance en km
 */
export function calculerDistanceVolOiseau(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 30;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Calcule la distance routière avec OSRM
 * @param {Object} origine - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @returns {Promise<number>} Distance en km
 */
export async function calculerDistanceRoute(origine, destination) {
    if (!origine || !destination) return 30;
    
    const key = `${origine.lat},${origine.lng}-${destination.lat},${destination.lng}`;
    if (routeCache.has(key)) {
        return routeCache.get(key);
    }
    
    const url = `https://router.project-osrm.org/route/v1/driving/${origine.lng},${origine.lat};${destination.lng},${destination.lat}?overview=false`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const dist = data.routes[0].distance / 1000;
            routeCache.set(key, dist);
            return dist;
        }
    } catch(e) {
        console.warn("Erreur OSRM, utilisation du calcul à vol d'oiseau");
    }
    
    const fallback = calculerDistanceVolOiseau(origine.lat, origine.lng, destination.lat, destination.lng);
    routeCache.set(key, fallback);
    return fallback;
}

/**
 * Calcule une matrice de distances entre plusieurs points
 * @param {Array} points - Liste de points {lat, lng}
 * @returns {Promise<Array>} Matrice des distances
 */
export async function calculerMatriceDistances(points) {
    const matrice = [];
    for (let i = 0; i < points.length; i++) {
        matrice[i] = [];
        for (let j = 0; j < points.length; j++) {
            if (i === j) {
                matrice[i][j] = 0;
            } else {
                matrice[i][j] = await calculerDistanceRoute(points[i], points[j]);
            }
        }
    }
    return matrice;
}
