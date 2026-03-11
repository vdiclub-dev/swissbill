// dispatch.js - Version CORRECTE et FONCTIONNELLE
console.log("✅ dispatch.js chargé avec succès");

// Configuration Supabase (à remplacer avec vos vraies clés)
const supabaseUrl = 'https://votre-projet.supabase.co';
const supabaseKey = 'votre-cle-anon';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales
let map;
let markers;
let routeLine = null;
const geoCache = {};

/* ------------------ */
/* MODAL */
/* ------------------ */
window.openModal = function(title, content) {
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-content").innerHTML = content;
    document.getElementById("modal").style.display = "flex";
}

window.closeModal = function() {
    document.getElementById("modal").style.display = "none";
}

/* ------------------ */
/* CARTE */
/* ------------------ */
// Initialisation de la carte au chargement
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔄 Initialisation de la carte...");
    
    try {
        map = L.map("map").setView([46.52, 6.63], 9);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: '© OpenStreetMap'
        }).addTo(map);
        
        markers = L.markerClusterGroup();
        map.addLayer(markers);
        
        console.log("✅ Carte initialisée");
        
        // Charger les données
        loadOrdersMap();
        loadOrdersList();
        
    } catch (error) {
        console.error("❌ Erreur initialisation carte:", error);
    }
});

/* ------------------ */
/* GEOCODAGE */
/* ------------------ */
async function geocodeCity(city) {
    if (!city) return null;
    
    const key = city.toLowerCase();
    if (geoCache[key]) return geoCache[key];
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Suisse')}`
        );
        const data = await response.json();
        
        if (!data.length) return null;
        
        const coords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
        
        geoCache[key] = coords;
        return coords;
        
    } catch (error) {
        console.error("Erreur géocodage:", error);
        return null;
    }
}

/* ------------------ */
/* CALCUL ROUTE */
/* ------------------ */
async function calculateRoute(pickupCity, deliveryCity) {
    const p1 = await geocodeCity(pickupCity);
    const p2 = await geocodeCity(deliveryCity);
    
    if (!p1 || !p2) return null;
    
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=false`
        );
        const data = await response.json();
        
        if (!data.routes || !data.routes.length) return null;
        
        return {
            km: (data.routes[0].distance / 1000).toFixed(1),
            min: Math.round(data.routes[0].duration / 60)
        };
        
    } catch (error) {
        console.error("Erreur calcul route:", error);
        return null;
    }
}

/* ------------------ */
/* CREER TRANSPORT */
/* ------------------ */
window.newTransport = function() {
    console.log("🆕 Ouverture formulaire");
    
    openModal(
        "Créer transport",
        `
        <div style="padding: 10px;">
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px; font-weight:bold;">Client</label>
                <input id="client" type="text" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" placeholder="Nom du client">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px; font-weight:bold;">Téléphone</label>
                <input id="phone" type="text" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" placeholder="079 000 00 00">
            </div>
            
            <h4 style="margin:15px 0 10px; color:#007bff;">📍 Ramassage</h4>
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px;">Ville *</label>
                <input id="pickup_city" type="text" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" placeholder="Lausanne">
            </div>
            
            <h4 style="margin:15px 0 10px; color:#dc3545;">📦 Livraison</h4>
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px;">Ville *</label>
                <input id="delivery_city" type="text" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" placeholder="Genève">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px;">Poids (kg)</label>
                <input id="weight" type="number" value="1" min="0" step="0.1" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display:block; margin-bottom:5px;">Priorité</label>
                <select id="priority" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>
            
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="closeModal()" style="flex:1; padding:10px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer;">Annuler</button>
                <button onclick="createTransport()" style="flex:1; padding:10px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">Créer transport</button>
            </div>
        </div>
        `
    );
}

window.createTransport = async function() {
    console.log("📝 Création transport...");
    
    const client = document.getElementById("client")?.value || '';
    const phone = document.getElementById("phone")?.value || '';
    const pickup = document.getElementById("pickup_city")?.value;
    const delivery = document.getElementById("delivery_city")?.value;
    const weight = document.getElementById("weight")?.value || 1;
    const priority = document.getElementById("priority")?.value || 'normal';
    
    if (!pickup || !delivery) {
        alert("Veuillez remplir les villes de ramassage et livraison");
        return;
    }
    
    try {
        // Calculer la route pour avoir les km et durée
        const route = await calculateRoute(pickup, delivery);
        
        const { error } = await supabase
            .from("orders")
            .insert([{
                client_name: client,
                phone: phone,
                pickup_city: pickup,
                delivery_city: delivery,
                weight: parseFloat(weight),
                priority: priority,
                status: "pending",
                distance_km: route ? parseFloat(route.km) : null,
                duration_min: route ? route.min : null,
                created_at: new Date()
            }]);
        
        if (error) throw error;
        
        alert("✅ Transport créé avec succès !");
        closeModal();
        
        // Recharger les données
        await loadOrdersMap();
        await loadOrdersList();
        
    } catch (error) {
        console.error("❌ Erreur création:", error);
        alert("Erreur lors de la création du transport");
    }
}

/* ------------------ */
/* CHARGEMENT CARTE */
/* ------------------ */
async function loadOrdersMap() {
    if (!markers) return;
    
    markers.clearLayers();
    
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`📦 ${data.length} transports chargés`);
        
        const bounds = [];
        let index = 1;
        
        for (const order of data) {
            const geo = await geocodeCity(order.delivery_city);
            if (!geo) continue;
            
            // Couleur selon le statut
            let color = "#6c757d"; // gris par défaut
            if (order.status === "pending") color = "#ffc107"; // jaune
            if (order.status === "planned") color = "#17a2b8"; // bleu
            if (order.status === "urgent") color = "#dc3545"; // rouge
            if (order.status === "delivered") color = "#28a745"; // vert
            
            const icon = L.divIcon({
                className: "route-number",
                html: `<div style="background:${color}; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);">${index}</div>`,
                iconSize: [30, 30]
            });
            
            const marker = L.marker([geo.lat, geo.lng], { icon });
            
            // Popup avec infos
            marker.bindPopup(`
                <div style="min-width:200px;">
                    <div style="font-weight:bold; margin-bottom:5px;">📦 ${order.client_name || 'Sans client'}</div>
                    <div style="margin:5px 0;">📍 ${order.pickup_city} → ${order.delivery_city}</div>
                    ${order.distance_km ? `<div>📏 ${order.distance_km} km (${order.duration_min} min)</div>` : ''}
                    <div style="margin-top:10px;">
                        <button onclick="openRoute('${order.delivery_city}')" style="padding:5px 10px; background:#007bff; color:white; border:none; border-radius:3px; cursor:pointer;">🗺️ Itinéraire</button>
                    </div>
                </div>
            `);
            
            markers.addLayer(marker);
            bounds.push([geo.lat, geo.lng]);
            index++;
        }
        
        if (bounds.length && map) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Mettre à jour les stats
        updateStats(data);
        
    } catch (error) {
        console.error("❌ Erreur chargement carte:", error);
    }
}

/* ------------------ */
/* LISTE DES TRANSPORTS */
/* ------------------ */
async function loadOrdersList() {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const list = document.getElementById("orders-list");
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Aucun transport</div>';
            return;
        }
        
        let html = "";
        
        for (const order of data) {
            // Couleur de fond selon priorité
            const bgColor = order.priority === 'urgent' ? '#fff3f3' : 'white';
            const borderColor = order.priority === 'urgent' ? '#dc3545' : '#ddd';
            
            html += `
                <div style="background:${bgColor}; border:1px solid ${borderColor}; border-radius:5px; padding:10px; margin-bottom:8px; cursor:pointer;" onclick="selectOrder('${order.id}')">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-weight:bold;">${order.client_name || 'Sans client'}</span>
                        <span style="font-size:11px; padding:2px 6px; border-radius:3px; background:${order.status === 'urgent' ? '#dc3545' : '#e9ecef'}; color:${order.status === 'urgent' ? 'white' : '#333'};">${order.status}</span>
                    </div>
                    <div style="font-size:13px; margin:5px 0;">
                        📍 ${order.pickup_city} → ${order.delivery_city}
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#666;">
                        <span>⚖️ ${order.weight || 1} kg</span>
                        ${order.distance_km ? `<span>📏 ${order.distance_km} km</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        list.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Erreur chargement liste:", error);
        document.getElementById("orders-list").innerHTML = 'Erreur de chargement';
    }
}

/* ------------------ */
/* STATISTIQUES */
/* ------------------ */
function updateStats(orders) {
    if (!orders) return;
    
    const pending = orders.filter(o => o.status === 'pending').length;
    const planned = orders.filter(o => o.status === 'planned').length;
    const urgent = orders.filter(o => o.status === 'urgent').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    
    const statsDiv = document.getElementById('dispatchStats');
    if (statsDiv) {
        statsDiv.innerHTML = `
            <span style="margin-right:15px;">⏳ En attente: ${pending}</span>
            <span style="margin-right:15px;">🗺️ Planifiés: ${planned}</span>
            <span style="margin-right:15px; color:#dc3545;">⚠️ Urgents: ${urgent}</span>
            <span style="color:#28a745;">✅ Livrés: ${delivered}</span>
        `;
    }
}

/* ------------------ */
/* UTILITAIRES */
/* ------------------ */
function openRoute(city) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=Yverdon&destination=${encodeURIComponent(city)}`;
    window.open(url, "_blank");
}

function selectOrder(id) {
    console.log("Transport sélectionné:", id);
    // À implémenter : zoom sur le transport
}

window.proposeAITours = function() {
    alert("🤖 Proposition IA - Fonctionnalité à venir");
}

window.generateTour = function() {
    alert("🧠 Création tournée - Fonctionnalité à venir");
}

/* ------------------ */
/* RAFRAÎCHISSEMENT */
/* ------------------ */
async function refreshDispatch() {
    await loadOrdersMap();
    await loadOrdersList();
}

// Rafraîchir toutes les 30 secondes
setInterval(refreshDispatch, 30000);

console.log("✅ dispatch.js prêt !");
