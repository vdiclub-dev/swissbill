// REMPLACEZ le contenu de /js/routing.js par ceci :

const routeCache = new Map();

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

export async function calculerDistanceRoute(origine, destination) {
    if (!origine || !destination) return { distance: 30, duree: 40 };
    
    const key = `${origine.lat},${origine.lng}-${destination.lat},${destination.lng}`;
    if (routeCache.has(key)) {
        return routeCache.get(key);
    }
    
    const url = `https://router.project-osrm.org/route/v1/driving/${origine.lng},${origine.lat};${destination.lng},${destination.lat}?overview=false`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const result = {
                distance: route.distance / 1000,
                duree: route.duration / 60  // temps en minutes
            };
            routeCache.set(key, result);
            return result;
        }
    } catch(e) {
        console.warn("Erreur OSRM, utilisation du calcul approximatif");
    }
    
    const fallbackDistance = calculerDistanceVolOiseau(origine.lat, origine.lng, destination.lat, destination.lng);
    const result = {
        distance: fallbackDistance,
        duree: (fallbackDistance / 45) * 60
    };
    routeCache.set(key, result);
    return result;
}

export async function calculerMatriceDistances(points) {
    const matrice = [];
    for (let i = 0; i < points.length; i++) {
        matrice[i] = [];
        for (let j = 0; j < points.length; j++) {
            if (i === j) {
                matrice[i][j] = { distance: 0, duree: 0 };
            } else {
                matrice[i][j] = await calculerDistanceRoute(points[i], points[j]);
            }
        }
    }
    return matrice;
}
