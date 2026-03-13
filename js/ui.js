// /js/ui.js - VERSION CORRECTE
export function showMessage(texte, couleur) {
    console.log(`📢 ${texte}`);
    
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.background = couleur;
    toast.style.color = 'white';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.animation = 'slideIn 0.3s';
    toast.innerHTML = texte;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

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
            const trajet = await calculerDistance(precedent, t);
            
            // Si trajet est un objet {distance, duree}
            if (typeof trajet === 'object') {
                distance += trajet.distance || 0;
                duree += trajet.duree || 0;
            } else {
                // Si trajet est juste un nombre (distance)
                distance += trajet;
                duree += (trajet / 45) * 60;
            }
            
            duree += 5; // 5 min de service
            poids += t.weight || 1;
            precedent = t;
        } else {
            distance += 30;
            duree += 45;
            poids += t.weight || 1;
        }
    }
    
    if (transports.length > 0 && transports[transports.length-1].lat) {
        const retour = await calculerDistance(transports[transports.length-1], depot);
        
        if (typeof retour === 'object') {
            distance += retour.distance || 0;
            duree += retour.duree || 0;
        } else {
            distance += retour;
            duree += (retour / 45) * 60;
        }
    }
    
    return { 
        distance: Math.round(distance), 
        duree: Math.round(duree),
        poids: Math.round(poids)
    };
}

// Ajouter l'animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

console.log("✅ Module ui.js chargé");
