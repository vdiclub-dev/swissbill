/**
 * Affiche un toast de notification
 * @param {string} texte - Message à afficher
 * @param {string} couleur - Code couleur CSS
 */
export function showMessage(texte, couleur) {
    // Supprimer les anciens toasts
    const anciens = document.querySelectorAll('.toast-message');
    anciens.forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
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

/**
 * Calcule les statistiques d'une tournée
 * @param {Array} transports - Liste des transports
 * @param {Object} depot - {lat, lng}
 * @param {Function} calculerDistance - Fonction de calcul de distance
 * @returns {Promise<Object>} Statistiques {distance, duree, poids}
 */
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
            distance += trajet;
            duree += (trajet / 45) * 60 + 20; // 20 min de service
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
        distance += retour;
        duree += (retour / 45) * 60;
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
