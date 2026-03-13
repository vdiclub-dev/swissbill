export async function calculerStatsTournee(transports, depot, calculerDistance) {
    if (!transports || transports.length === 0) {
        return { distance: 0, duree: 0, poids: 0 };
    }
    
    let distance = 0;
    let duree = 0;
    let poids = 0;
    let precedent = depot;
    
    for (const t of transports) {
        if (t.lat && t.lng) {
            // Maintenant calculerDistance retourne {distance, duree}
            const trajet = await calculerDistance(precedent, t);
            
            distance += trajet.distance;
            duree += trajet.duree; // Temps réel d'OSRM !
            duree += 5; // +5 min de service
            poids += t.weight || 1;
            precedent = t;
        } else {
            distance += 30;
            duree += 45;
            poids += t.weight || 1;
        }
    }
    
    // Retour au dépôt
    if (transports.length > 0 && transports[transports.length-1].lat) {
        const retour = await calculerDistance(transports[transports.length-1], depot);
        distance += retour.distance;
        duree += retour.duree;
    }
    
    return { 
        distance: Math.round(distance), 
        duree: Math.round(duree),
        poids: Math.round(poids)
    };
}
