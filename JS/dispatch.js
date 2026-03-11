// dispatch.js - Version professionnelle LEMAN DISPATCH
console.log("🚚 LEMAN DISPATCH - Version Professionnelle chargée");

/* ------------------ */
/* CONFIGURATION */
/* ------------------ */
const CONFIG = {
    map: {
        center: [46.52, 6.63],
        zoom: 9,
        maxZoom: 18
    },
    colors: {
        pending: '#6B7280',    // Gris
        planned: '#F59E0B',     // Orange
        urgent: '#EF4444',       // Rouge
        delivered: '#10B981',    // Vert
        pickup: '#3B82F6',       // Bleu
        delivery: '#EF4444'       // Rouge
    },
    refreshInterval: 10000,      // 10 secondes
    depot: {                      // Dépôt Yverdon
        lat: 46.7785,
        lng: 6.6411,
        city: 'Yverdon-les-Bains'
    }
};

/* ------------------ */
/* STATE MANAGEMENT */
/* ------------------ */
const DispatchState = {
    orders: [],
    tours: [],
    drivers: [],
    selectedOrder: null,
    filters: {
        status: 'all',
        search: '',
        tour: null
    },
    
    async refresh() {
        await Promise.all([
            this.loadOrders(),
            this.loadTours()
        ]);
        await Promise.all([
            MapManager.updateMarkers(),
            UIManager.updateOrdersList()
        ]);
    },
    
    async loadOrders() {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
            
        // Appliquer les filtres
        if (this.filters.status !== 'all') {
            query = query.eq('status', this.filters.status);
        }
        
        const { data, error } = await query;
        if (error) {
            console.error('Erreur chargement orders:', error);
            return;
        }
        
        this.orders = data;
        return data;
    },
    
    async loadTours() {
        const { data, error } = await supabase
            .from('tours')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (!error) this.tours = data || [];
    },
    
    getPendingOrders() {
        return this.orders.filter(o => o.status === 'pending');
    },
    
    getOrdersByTour(tourId) {
        return this.orders.filter(o => o.tour_id === tourId);
    }
};

/* ------------------ */
/* GÉOCODAGE AVANCÉ */
/* ------------------ */
const GeocodingService = {
    cache: new Map(),
    queue: [],
    processing: false,
    
    async geocode(address) {
        const key = address.toLowerCase().trim();
        
        // Vérifier le cache
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        // Construire l'adresse complète pour la Suisse
        const fullAddress = `${address}, Suisse`;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(fullAddress)}&` +
                `countrycodes=ch&limit=1`,
                {
                    headers: {
                        'User-Agent': 'LEMAN-DISPATCH/1.0'
                    }
                }
            );
            
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    displayName: data[0].display_name
                };
                this.cache.set(key, result);
                return result;
            }
        } catch (error) {
            console.error('Erreur géocodage:', error);
        }
        
        return null;
    },
    
    async geocodeOrder(order) {
        // Géocoder pickup et delivery avec adresses complètes
        const pickupAddress = `${order.pickup_street} ${order.pickup_number}, ${order.pickup_postal} ${order.pickup_city}`.trim();
        const deliveryAddress = `${order.delivery_street} ${order.delivery_number}, ${order.delivery_postal} ${order.delivery_city}`.trim();
        
        const [pickup, delivery] = await Promise.all([
            this.geocode(pickupAddress),
            this.geocode(deliveryAddress)
        ]);
        
        return { pickup, delivery };
    }
};

/* ------------------ */
/* CALCUL DE ROUTE */
/* ------------------ */
const RoutingService = {
    async calculateRoute(pickup, delivery) {
        if (!pickup || !delivery) return null;
        
        const url = `https://router.project-osrm.org/route/v1/driving/` +
            `${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}` +
            `?overview=full&geometries=geojson`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.routes || !data.routes.length) return null;
            
            const route = data.routes[0];
            
            return {
                distance: route.distance / 1000, // km
                duration: Math.round(route.duration / 60), // minutes
                geometry: route.geometry,
                waypoints: [
                    { lat: pickup.lat, lng: pickup.lng },
                    { lat: delivery.lat, lng: delivery.lng }
                ]
            };
        } catch (error) {
            console.error('Erreur calcul route:', error);
            return null;
        }
    },
    
    async calculateTourRoute(waypoints) {
        if (waypoints.length < 2) return null;
        
        const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.routes || !data.routes.length) return null;
            
            const route = data.routes[0];
            
            return {
                distance: route.distance / 1000,
                duration: Math.round(route.duration / 60),
                geometry: route.geometry
            };
        } catch (error) {
            console.error('Erreur calcul tournée:', error);
            return null;
        }
    }
};

/* ------------------ */
/* GESTIONNAIRE CARTE */
/* ------------------ */
const MapManager = {
    map: null,
    markers: null,
    routeLayer: null,
    currentRoute: null,
    
    init() {
        // Initialiser la carte
        this.map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: CONFIG.map.maxZoom,
            attribution: '© OpenStreetMap | LEMAN DISPATCH'
        }).addTo(this.map);
        
        // Cluster pour les marqueurs
        this.markers = L.markerClusterGroup({
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="cluster-marker">${count}</div>`,
                    className: 'cluster-icon',
                    iconSize: [40, 40]
                });
            }
        });
        
        this.map.addLayer(this.markers);
        
        // Ajouter le dépôt (Yverdon)
        this.addDepotMarker();
        
        return this;
    },
    
    addDepotMarker() {
        const depotIcon = L.divIcon({
            html: '🏢',
            className: 'depot-marker',
            iconSize: [30, 30]
        });
        
        const marker = L.marker([CONFIG.depot.lat, CONFIG.depot.lng], { icon: depotIcon });
        marker.bindPopup(`<b>Dépôt</b><br>${CONFIG.depot.city}`);
        marker.addTo(this.map);
    },
    
    createOrderIcon(order, index) {
        let color = CONFIG.colors[order.status] || CONFIG.colors.pending;
        
        // Si c'est un pickup, utiliser bleu
        if (order.type === 'pickup') color = CONFIG.colors.pickup;
        
        const icon = L.divIcon({
            className: 'order-marker',
            html: `
                <div class="marker-content" style="background: ${color}">
                    ${index || ''}
                    ${order.status === 'urgent' ? '<span class="urgent-pulse"></span>' : ''}
                </div>
            `,
            iconSize: [30, 30]
        });
        
        return icon;
    },
    
    async updateMarkers() {
        this.markers.clearLayers();
        
        const orders = DispatchState.orders;
        const bounds = [];
        
        // Grouper par tournée pour les numéros
        const tours = {};
        orders.forEach(order => {
            if (order.tour_id) {
                if (!tours[order.tour_id]) tours[order.tour_id] = [];
                tours[order.tour_id].push(order);
            }
        });
        
        // Ajouter les marqueurs
        for (const order of orders) {
            // Priorité à l'adresse complète si disponible
            const address = order.delivery_lat && order.delivery_lng 
                ? { lat: order.delivery_lat, lng: order.delivery_lng }
                : await GeocodingService.geocode(order.delivery_city);
            
            if (!address) continue;
            
            // Déterminer le numéro dans la tournée
            let index = '';
            if (order.tour_id && tours[order.tour_id]) {
                const tourOrders = tours[order.tour_id];
                const pos = tourOrders.findIndex(o => o.id === order.id);
                if (pos !== -1) index = pos + 1;
            }
            
            const icon = this.createOrderIcon(order, index);
            const marker = L.marker([address.lat, address.lng], { icon });
            
            // Popup détaillé
            marker.bindPopup(this.createOrderPopup(order));
            
            marker.on('click', () => {
                DispatchState.selectedOrder = order;
                this.drawOrderRoute(order);
            });
            
            this.markers.addLayer(marker);
            bounds.push([address.lat, address.lng]);
        }
        
        // Ajuster la vue si des marqueurs existent
        if (bounds.length > 0) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    },
    
    createOrderPopup(order) {
        return `
            <div class="order-popup">
                <div class="popup-header">
                    <strong>${order.client_name || 'Sans client'}</strong>
                    <span class="status-badge status-${order.status}">${order.status}</span>
                </div>
                <div class="popup-content">
                    <div class="popup-address">
                        📦 <strong>Pickup:</strong><br>
                        ${order.pickup_street || ''} ${order.pickup_number || ''}<br>
                        ${order.pickup_postal || ''} ${order.pickup_city || ''}
                    </div>
                    <div class="popup-address">
                        📍 <strong>Delivery:</strong><br>
                        ${order.delivery_street || ''} ${order.delivery_number || ''}<br>
                        ${order.delivery_postal || ''} ${order.delivery_city || ''}
                    </div>
                    ${order.distance_km ? `
                        <div class="popup-stats">
                            📏 ${order.distance_km.toFixed(1)} km | ⏱️ ${order.duration_min} min
                        </div>
                    ` : ''}
                    <div class="popup-actions">
                        <button onclick="Actions.assignToTour('${order.id}')" class="btn-small">➕ Tournée</button>
                        <button onclick="Actions.viewOnMap('${order.id}')" class="btn-small">🗺️ Voir</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    async drawOrderRoute(order) {
        // Effacer l'ancienne route
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        
        // Obtenir les coordonnées précises
        const pickup = order.pickup_lat && order.pickup_lng 
            ? { lat: order.pickup_lat, lng: order.pickup_lng }
            : await GeocodingService.geocode(`${order.pickup_city}, Suisse`);
            
        const delivery = order.delivery_lat && order.delivery_lng
            ? { lat: order.delivery_lat, lng: order.delivery_lng }
            : await GeocodingService.geocode(`${order.delivery_city}, Suisse`);
        
        if (!pickup || !delivery) return;
        
        const route = await RoutingService.calculateRoute(pickup, delivery);
        
        if (route && route.geometry) {
            this.routeLayer = L.geoJSON(route.geometry, {
                style: {
                    color: '#3B82F6',
                    weight: 4,
                    opacity: 0.7,
                    lineJoin: 'round'
                }
            }).addTo(this.map);
            
            // Ajouter les marqueurs de début/fin
            L.marker([pickup.lat, pickup.lng], {
                icon: L.divIcon({ html: '🚩', className: 'waypoint-marker', iconSize: [20, 20] })
            }).addTo(this.map);
            
            L.marker([delivery.lat, delivery.lng], {
                icon: L.divIcon({ html: '🏁', className: 'waypoint-marker', iconSize: [20, 20] })
            }).addTo(this.map);
        }
    },
    
    async drawTourRoute(tourId) {
        const orders = DispatchState.getOrdersByTour(tourId);
        if (orders.length < 1) return;
        
        // Construire les waypoints: départ -> pickups -> deliveries
        const waypoints = [
            CONFIG.depot, // Départ du dépôt
            ...orders.map(o => ({ 
                lat: o.pickup_lat || CONFIG.depot.lat,
                lng: o.pickup_lng || CONFIG.depot.lng 
            })),
            ...orders.map(o => ({
                lat: o.delivery_lat || CONFIG.depot.lat,
                lng: o.delivery_lng || CONFIG.depot.lng
            }))
        ];
        
        const route = await RoutingService.calculateTourRoute(waypoints);
        
        if (route && route.geometry) {
            if (this.routeLayer) this.map.removeLayer(this.routeLayer);
            
            this.routeLayer = L.geoJSON(route.geometry, {
                style: {
                    color: '#10B981',
                    weight: 5,
                    opacity: 0.8,
                    lineJoin: 'round'
                }
            }).addTo(this.map);
        }
    }
};

/* ------------------ */
/* INTERFACE UTILISATEUR */
/* ------------------ */
const UIManager = {
    async updateOrdersList() {
        const list = document.getElementById('orders-list');
        if (!list) return;
        
        const orders = DispatchState.orders;
        
        let html = '';
        
        for (const order of orders) {
            const tour = DispatchState.tours.find(t => t.id === order.tour_id);
            
            html += `
                <div class="order-item ${order.status}" data-id="${order.id}">
                    <div class="order-item-header">
                        <span class="client-name">${order.client_name || 'Sans client'}</span>
                        <span class="status status-${order.status}">${order.status}</span>
                    </div>
                    <div class="order-item-address">
                        📍 ${order.pickup_city} → ${order.delivery_city}
                    </div>
                    <div class="order-item-details">
                        ${order.distance_km ? `<span>📏 ${order.distance_km.toFixed(1)} km</span>` : ''}
                        ${order.duration_min ? `<span>⏱️ ${order.duration_min} min</span>` : ''}
                        ${tour ? `<span>🚚 Tournée #${tour.id.slice(-4)}</span>` : ''}
                    </div>
                    <div class="order-item-actions">
                        ${!order.tour_id ? `
                            <button onclick="Actions.assignToTour('${order.id}')" class="btn-small">
                                ➕ Assigner
                            </button>
                        ` : ''}
                        <button onclick="Actions.viewOrder('${order.id}')" class="btn-small">
                            👁️ Voir
                        </button>
                    </div>
                </div>
            `;
        }
        
        list.innerHTML = html || '<div class="no-orders">Aucun transport</div>';
    },
    
    showNotification(message, type = 'info') {
        // Créer une notification toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-supprimer après 5 secondes
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 5000);
    }
};

/* ------------------ */
/* OPTIMISATION DES TOURNÉES */
/* ------------------ */
const TourOptimizer = {
    async createOptimizedTours() {
        const pendingOrders = DispatchState.getPendingOrders();
        
        if (pendingOrders.length === 0) {
            UIManager.showNotification('Aucun transport en attente', 'warning');
            return;
        }
        
        UIManager.showNotification('Optimisation en cours...', 'info');
        
        // 1. Regrouper par proximité géographique
        const clusters = await this.clusterByProximity(pendingOrders);
        
        // 2. Pour chaque cluster, créer une tournée
        const tours = [];
        
        for (const cluster of clusters) {
            if (cluster.orders.length === 0) continue;
            
            // Trier par priorité et optimiser l'ordre
            const optimized = await this.optimizeOrderSequence(cluster.orders);
            
            // Calculer la route
            const route = await RoutingService.calculateTourRoute([
                CONFIG.depot,
                ...optimized.map(o => ({ 
                    lat: o.pickup_lat, 
                    lng: o.pickup_lng 
                })),
                ...optimized.map(o => ({ 
                    lat: o.delivery_lat, 
                    lng: o.delivery_lng 
                }))
            ]);
            
            tours.push({
                orders: optimized,
                distance: route?.distance || 0,
                duration: route?.duration || 0,
                geometry: route?.geometry
            });
        }
        
        return tours;
    },
    
    async clusterByProximity(orders, maxDistance = 10) { // 10km max
        const clusters = [];
        const used = new Set();
        
        for (const order of orders) {
            if (used.has(order.id)) continue;
            
            const cluster = {
                center: { 
                    lat: order.pickup_lat, 
                    lng: order.pickup_lng 
                },
                orders: [order]
            };
            
            used.add(order.id);
            
            // Chercher les orders proches
            for (const other of orders) {
                if (used.has(other.id)) continue;
                
                const distance = this.calculateDistance(
                    cluster.center.lat, cluster.center.lng,
                    other.pickup_lat, other.pickup_lng
                );
                
                if (distance <= maxDistance) {
                    cluster.orders.push(other);
                    used.add(other.id);
                    
                    // Recalculer le centre
                    cluster.center.lat = (cluster.center.lat + other.pickup_lat) / 2;
                    cluster.center.lng = (cluster.center.lng + other.pickup_lng) / 2;
                }
            }
            
            clusters.push(cluster);
        }
        
        return clusters;
    },
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },
    
    deg2rad(deg) {
        return deg * (Math.PI/180);
    },
    
    async optimizeOrderSequence(orders) {
        // Algorithme du plus proche voisin pour l'ordre des pickups
        if (orders.length <= 1) return orders;
        
        const unvisited = [...orders];
        const sequence = [unvisited.shift()]; // Commencer par un order
        
        while (unvisited.length > 0) {
            const last = sequence[sequence.length - 1];
            
            // Trouver le pickup le plus proche du dernier point
            let bestIdx = 0;
            let bestDist = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const dist = this.calculateDistance(
                    last.pickup_lat, last.pickup_lng,
                    unvisited[i].pickup_lat, unvisited[i].pickup_lng
                );
                
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            }
            
            sequence.push(unvisited[bestIdx]);
            unvisited.splice(bestIdx, 1);
        }
        
        return sequence;
    }
};

/* ------------------ */
/* ACTIONS UTILISATEUR */
/* ------------------ */
const Actions = {
    async createTransport(formData) {
        // 1. Géocoder les adresses
        const pickupAddress = `${formData.pickup_street} ${formData.pickup_number}, ${formData.pickup_postal} ${formData.pickup_city}`;
        const deliveryAddress = `${formData.delivery_street} ${formData.delivery_number}, ${formData.delivery_postal} ${formData.delivery_city}`;
        
        const [pickup, delivery] = await Promise.all([
            GeocodingService.geocode(pickupAddress),
            GeocodingService.geocode(deliveryAddress)
        ]);
        
        if (!pickup || !delivery) {
            UIManager.showNotification('Adresse non trouvée', 'error');
            return;
        }
        
        // 2. Calculer la route
        const route = await RoutingService.calculateRoute(pickup, delivery);
        
        // 3. Créer l'order dans Supabase
        const { data, error } = await supabase
            .from('orders')
            .insert([{
                ...formData,
                pickup_lat: pickup.lat,
                pickup_lng: pickup.lng,
                delivery_lat: delivery.lat,
                delivery_lng: delivery.lng,
                distance_km: route?.distance || null,
                duration_min: route?.duration || null,
                status: 'pending',
                created_at: new Date()
            }])
            .select();
        
        if (error) {
            console.error('Erreur création:', error);
            UIManager.showNotification('Erreur lors de la création', 'error');
            return;
        }
        
        UIManager.showNotification('Transport créé avec succès', 'success');
        closeModal();
        await DispatchState.refresh();
    },
    
    async assignToTour(orderId) {
        const order = DispatchState.orders.find(o => o.id === orderId);
        if (!order) return;
        
        // Proposer une tournée existante ou en créer une nouvelle
        const tours = DispatchState.tours;
        
        if (tours.length === 0) {
            // Créer nouvelle tournée
            const tourId = `TOUR-${Date.now()}`;
            
            await supabase
                .from('orders')
                .update({ tour_id: tourId, status: 'planned' })
                .eq('id', orderId);
                
            UIManager.showNotification('Nouvelle tournée créée', 'success');
        } else {
            // Afficher liste des tournées pour assignation
            this.showTourSelector(orderId);
        }
        
        await DispatchState.refresh();
    },
    
    async optimizeAll() {
        const tours = await TourOptimizer.createOptimizedTours();
        
        if (!tours || tours.length === 0) return;
        
        // Afficher les propositions
        let message = `🎯 ${tours.length} tournées optimisées :\n\n`;
        tours.forEach((tour, i) => {
            message += `Tournée ${i+1}: ${tour.orders.length} transports, ${tour.distance.toFixed(1)} km\n`;
        });
        
        if (confirm(message + '\n\nAppliquer ces tournées ?')) {
            for (const tour of tours) {
                const tourId = `TOUR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                
                for (const order of tour.orders) {
                    await supabase
                        .from('orders')
                        .update({ tour_id: tourId, status: 'planned' })
                        .eq('id', order.id);
                }
            }
            
            UIManager.showNotification(`${tours.length} tournées créées`, 'success');
            await DispatchState.refresh();
        }
    },
    
    async viewOrder(orderId) {
        const order = DispatchState.orders.find(o => o.id === orderId);
        if (!order) return;
        
        // Centrer la carte sur l'order
        if (order.delivery_lat && order.delivery_lng) {
            MapManager.map.setView([order.delivery_lat, order.delivery_lng], 13);
            await MapManager.drawOrderRoute(order);
        }
    }
};

/* ------------------ */
/* FORMULAIRE CRÉATION (AMÉLIORÉ) */
/* ------------------ */
window.newTransport = function() {
    openModal(
        "🚚 Nouveau transport",
        `
        <form id="transport-form" class="dispatch-form" onsubmit="event.preventDefault(); Actions.createTransport(getFormData())">
            <div class="dispatch-form__section">
                <h3>Client</h3>
                <div class="dispatch-form__grid">
                    <div class="dispatch-field">
                        <label>Nom du client *</label>
                        <input id="client_name" type="text" required placeholder="Jean Dupont">
                    </div>
                    <div class="dispatch-field">
                        <label>Téléphone</label>
                        <input id="phone" type="tel" placeholder="079 123 45 67">
                    </div>
                </div>
            </div>

            <div class="dispatch-form__section">
                <h3>📦 Ramassage</h3>
                <div class="dispatch-form__grid">
                    <div class="dispatch-field dispatch-field--span-2">
                        <label>Rue *</label>
                        <input id="pickup_street" type="text" required placeholder="Rue du Simplon">
                    </div>
                    <div class="dispatch-field">
                        <label>N°</label>
                        <input id="pickup_number" type="text" placeholder="12">
                    </div>
                    <div class="dispatch-field">
                        <label>Code postal *</label>
                        <input id="pickup_postal" type="text" required placeholder="1000">
                    </div>
                    <div class="dispatch-field dispatch-field--span-2">
                        <label>Ville *</label>
                        <input id="pickup_city" type="text" required placeholder="Lausanne">
                    </div>
                </div>
            </div>

            <div class="dispatch-form__section">
                <h3>📍 Livraison</h3>
                <div class="dispatch-form__grid">
                    <div class="dispatch-field dispatch-field--span-2">
                        <label>Rue *</label>
                        <input id="delivery_street" type="text" required placeholder="Rue du Mont-Blanc">
                    </div>
                    <div class="dispatch-field">
                        <label>N°</label>
                        <input id="delivery_number" type="text" placeholder="8">
                    </div>
                    <div class="dispatch-field">
                        <label>Code postal *</label>
                        <input id="delivery_postal" type="text" required placeholder="1200">
                    </div>
                    <div class="dispatch-field dispatch-field--span-2">
                        <label>Ville *</label>
                        <input id="delivery_city" type="text" required placeholder="Genève">
                    </div>
                </div>
            </div>

            <div class="dispatch-form__section">
                <h3>📦 Colis</h3>
                <div class="dispatch-form__grid">
                    <div class="dispatch-field">
                        <label>Poids (kg)</label>
                        <input id="weight" type="number" step="0.1" value="1">
                    </div>
                    <div class="dispatch-field">
                        <label>Priorité</label>
                        <select id="priority">
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                </div>
                <div class="dispatch-field">
                    <label>Notes</label>
                    <textarea id="note" placeholder="Fragile, signature requise, code d'accès..."></textarea>
                </div>
            </div>

            <div class="dispatch-form__actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn-primary">Créer transport</button>
            </div>
        </form>
        `
    );
    
    // Helper pour récupérer les données du formulaire
    window.getFormData = function() {
        return {
            client_name: document.getElementById('client_name')?.value,
            phone: document.getElementById('phone')?.value,
            pickup_street: document.getElementById('pickup_street')?.value,
            pickup_number: document.getElementById('pickup_number')?.value,
            pickup_postal: document.getElementById('pickup_postal')?.value,
            pickup_city: document.getElementById('pickup_city')?.value,
            delivery_street: document.getElementById('delivery_street')?.value,
            delivery_number: document.getElementById('delivery_number')?.value,
            delivery_postal: document.getElementById('delivery_postal')?.value,
            delivery_city: document.getElementById('delivery_city')?.value,
            weight: parseFloat(document.getElementById('weight')?.value) || 1,
            priority: document.getElementById('priority')?.value || 'normal',
            note: document.getElementById('note')?.value
        };
    };
};

/* ------------------ */
/* INITIALISATION */
/* ------------------ */
async function initDispatch() {
    console.log('🚀 Initialisation LEMAN DISPATCH...');
    
    // Initialiser la carte
    MapManager.init();
    
    // Charger les données
    await DispatchState.loadOrders();
    await DispatchState.loadTours();
    
    // Mettre à jour l'interface
    await MapManager.updateMarkers();
    await UIManager.updateOrdersList();
    
    // Démarrer le rafraîchissement automatique
    setInterval(async () => {
        await DispatchState.refresh();
    }, CONFIG.refreshInterval);
    
    // Exposer les actions globalement
    window.DispatchState = DispatchState;
    window.Actions = Actions;
    window.MapManager = MapManager;
    
    console.log('✅ LEMAN DISPATCH prêt');
}

// Démarrer quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initDispatch);
