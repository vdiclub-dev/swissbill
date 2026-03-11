<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Léman Dispatch - Professionnel</title>
    
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css" />
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        body {
            background: #111;
            height: 100vh;
            overflow: hidden;
        }
        
        /* HEADER */
        header {
            background: #111;
            color: white;
            padding: 15px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #2a2a2a;
            height: 70px;
        }
        
        .logo {
            font-size: 22px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .logo span {
            color: #facc15;
        }
        
        .header-stats {
            display: flex;
            gap: 30px;
            font-size: 14px;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .stat-value {
            background: #2a2a2a;
            padding: 4px 10px;
            border-radius: 20px;
            font-weight: bold;
            color: #facc15;
        }
        
        .btn {
            background: #facc15;
            color: #111;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: 0.2s;
        }
        
        .btn:hover {
            background: #eab308;
            transform: translateY(-2px);
        }
        
        /* LAYOUT */
        .container {
            display: flex;
            height: calc(100vh - 70px);
        }
        
        /* SIDEBAR GAUCHE */
        .sidebar {
            width: 250px;
            background: #111;
            color: white;
            padding: 20px;
            border-right: 1px solid #2a2a2a;
            overflow-y: auto;
        }
        
        .sidebar button {
            width: 100%;
            padding: 12px 15px;
            margin-bottom: 5px;
            background: #1f2937;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: 0.2s;
        }
        
        .sidebar button:hover {
            background: #facc15;
            color: #111;
        }
        
        .sidebar button.active {
            background: #facc15;
            color: #111;
            font-weight: bold;
        }
        
        .sidebar hr {
            border: none;
            border-top: 1px solid #2a2a2a;
            margin: 20px 0;
        }
        
        /* CARTE */
        .map-container {
            flex: 1;
            position: relative;
            background: #1a1a1a;
        }
        
        #map {
            height: 100%;
            width: 100%;
            z-index: 1;
        }
        
        .map-controls {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 2;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .map-btn {
            width: 40px;
            height: 40px;
            background: #111;
            border: 1px solid #2a2a2a;
            color: white;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: 0.2s;
        }
        
        .map-btn:hover {
            background: #facc15;
            color: #111;
        }
        
        /* PANNEAU DROIT */
        .right-panel {
            width: 380px;
            background: #111;
            border-left: 1px solid #2a2a2a;
            display: flex;
            flex-direction: column;
        }
        
        .panel-header {
            padding: 15px;
            border-bottom: 1px solid #2a2a2a;
        }
        
        .panel-header h3 {
            color: white;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .panel-content {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
        }
        
        /* LISTE DES TRANSPORTS */
        .orders-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .order-card {
            background: #1f2937;
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #2a2a2a;
            transition: 0.2s;
            cursor: pointer;
        }
        
        .order-card:hover {
            border-color: #facc15;
            transform: translateX(-2px);
        }
        
        .order-card.urgent {
            border-left: 4px solid #ef4444;
        }
        
        .order-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .client-name {
            font-weight: bold;
            color: white;
        }
        
        .status-badge {
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 20px;
            background: #2a2a2a;
            color: #aaa;
        }
        
        .status-badge.urgent {
            background: #ef4444;
            color: white;
        }
        
        .status-badge.planned {
            background: #facc15;
            color: #111;
        }
        
        .address {
            color: #aaa;
            font-size: 13px;
            margin: 8px 0;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .route-info {
            display: flex;
            gap: 15px;
            margin: 10px 0;
            font-size: 12px;
            color: #888;
        }
        
        .route-info span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .route-info strong {
            color: #facc15;
            margin-left: 4px;
        }
        
        /* LISTE DES CHAUFFEURS */
        .drivers-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .driver-card {
            background: #1f2937;
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #2a2a2a;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .driver-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #facc15;
            color: #111;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
        }
        
        .driver-info {
            flex: 1;
        }
        
        .driver-name {
            font-weight: bold;
            color: white;
            margin-bottom: 4px;
        }
        
        .driver-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
        }
        
        .status-dot.offline {
            background: #6b7280;
        }
        
        .driver-position {
            color: #888;
            font-size: 11px;
            margin-top: 4px;
        }
        
        /* MODAL */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal-box {
            background: #1f2937;
            border-radius: 12px;
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            overflow-y: auto;
            border: 1px solid #2a2a2a;
        }
        
        .modal-header {
            background: #111;
            color: white;
            padding: 15px 20px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header button {
            background: none;
            border: none;
            color: #888;
            font-size: 22px;
            cursor: pointer;
        }
        
        .modal-header button:hover {
            color: #facc15;
        }
        
        .modal-content {
            padding: 20px;
        }
        
        /* FORMULAIRE */
        .form-section {
            background: #111;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid #2a2a2a;
        }
        
        .form-section h4 {
            color: #facc15;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        
        .form-field {
            margin-bottom: 10px;
        }
        
        .form-field.full-width {
            grid-column: span 2;
        }
        
        .form-field label {
            display: block;
            margin-bottom: 5px;
            color: #aaa;
            font-size: 12px;
        }
        
        .form-field input,
        .form-field select,
        .form-field textarea {
            width: 100%;
            padding: 10px;
            background: #1f2937;
            border: 1px solid #2a2a2a;
            color: white;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
            outline: none;
            border-color: #facc15;
        }
        
        /* LOADER */
        .loader {
            border: 3px solid #2a2a2a;
            border-top: 3px solid #facc15;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* UTILS */
        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>

<header>
    <div class="logo">
        🚚 Léman <span>Dispatch</span>
    </div>
    
    <div class="header-stats" id="dispatchStats">
        <div class="stat-item">
            <span>⏳ En attente</span>
            <span class="stat-value" id="pendingCount">0</span>
        </div>
        <div class="stat-item">
            <span>⚠️ Urgents</span>
            <span class="stat-value" id="urgentCount">0</span>
        </div>
        <div class="stat-item">
            <span>🚚 En ligne</span>
            <span class="stat-value" id="onlineDrivers">0</span>
        </div>
    </div>
    
    <button class="btn" onclick="UI.newTransport()">
        ➕ Créer transport
    </button>
</header>

<div class="container">
    <!-- SIDEBAR GAUCHE -->
    <div class="sidebar">
        <button class="active" onclick="switchView('dispatch')">
            🗺️ Dispatch
        </button>
        <button onclick="switchView('dashboard')">
            📊 Dashboard
        </button>
        <button onclick="switchView('transports')">
            📦 Transports
        </button>
        <button onclick="switchView('tours')">
            🗺️ Tournées
        </button>
        <button onclick="switchView('clients')">
            👤 Clients
        </button>
        <button onclick="switchView('drivers')">
            🚚 Chauffeurs
        </button>
        <button onclick="switchView('vehicles')">
            🚛 Véhicules
        </button>
        
        <hr>
        
        <button onclick="switchView('tracking')" style="background: #1f2937; border: 1px solid #facc15;">
            📡 Suivi temps réel
        </button>
        <button onclick="window.open('/client', '_blank')" style="background: #facc15; color: #111;">
            🌐 Portail client
        </button>
    </div>

    <!-- CARTE CENTRALE -->
    <div class="map-container">
        <div id="map"></div>
        
        <div class="map-controls">
            <button class="map-btn" onclick="map.setView([46.8, 8.2], 8)" title="Vue Suisse">
                🗺️
            </button>
            <button class="map-btn" onclick="map.zoomIn()" title="Zoom +">
                +
            </button>
            <button class="map-btn" onclick="map.zoomOut()" title="Zoom -">
                −
            </button>
            <button class="map-btn" onclick="refreshAll()" title="Rafraîchir">
                🔄
            </button>
            <button class="map-btn" onclick="toggleDriverTracking()" title="Suivi chauffeurs">
                🚚
            </button>
        </div>
    </div>

    <!-- PANNEAU DROIT -->
    <div class="right-panel">
        <div class="panel-header">
            <h3 id="panelTitle">📋 Transports en attente</h3>
        </div>
        
        <div class="panel-content" id="panelContent">
            <!-- Le contenu change dynamiquement -->
            <div class="loader"></div>
        </div>
    </div>
</div>

<!-- MODAL -->
<div id="modal" class="modal">
    <div class="modal-box">
        <div class="modal-header">
            <h3 id="modalTitle">Nouveau transport</h3>
            <button onclick="UI.closeModal()">✖</button>
        </div>
        <div class="modal-content" id="modalContent"></div>
    </div>
</div>

<!-- SCRIPTS -->
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
// ==================== CONFIGURATION ====================
// 🔴 REMPLACEZ PAR VOS IDENTIFIANTS SUPABASE
const SUPABASE_URL = 'https://votre-projet.supabase.co';
const SUPABASE_KEY = 'votre-cle-anon';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== VARIABLES GLOBALES ====================
let map;
let markers;
let driverMarkers = [];
let currentView = 'dispatch';
let driverTrackingEnabled = false;
const geoCache = {};

// ==================== INITIALISATION CARTE ====================
function initMap() {
    map = L.map('map').setView([46.8, 8.2], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Marqueurs pour les transports
    markers = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: `<div style="background:#facc15; color:#111; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; border:2px solid white;">${cluster.getChildCount()}</div>`,
                className: '',
                iconSize: [30, 30]
            });
        }
    });
    
    map.addLayer(markers);
    console.log('✅ Carte initialisée');
}

// ==================== GÉOCODAGE ====================
async function geocodeCity(city) {
    if (!city) return null;
    
    const key = city.toLowerCase().trim();
    if (geoCache[key]) return geoCache[key];
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Suisse')}&limit=1`,
            { headers: { 'User-Agent': 'LemanDispatch/1.0' } }
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
            geoCache[key] = coords;
            return coords;
        }
    } catch (e) {
        console.warn('Erreur géocodage:', e);
    }
    return null;
}

async function geocodeAddress(address) {
    if (!address) return null;
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=ch&limit=1`,
            { headers: { 'User-Agent': 'LemanDispatch/1.0' } }
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                display_name: data[0].display_name
            };
        }
    } catch (e) {
        console.warn('Erreur géocodage:', e);
    }
    
    return geocodeCity(address.split(',')[0]);
}

// ==================== CALCUL DISTANCE ====================
async function calculateRoute(pickupCity, deliveryCity) {
    const p1 = await geocodeCity(pickupCity);
    const p2 = await geocodeCity(deliveryCity);
    
    if (!p1 || !p2) return null;
    
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=false`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            return {
                km: (data.routes[0].distance / 1000).toFixed(1),
                min: Math.round(data.routes[0].duration / 60)
            };
        }
    } catch (e) {
        console.warn('Erreur calcul route:', e);
    }
    return null;
}

// ==================== CHARGEMENT DES DONNÉES ====================
async function loadOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erreur Supabase:', error);
        return [];
    }
    return data || [];
}

async function loadDrivers() {
    const { data, error } = await supabase
        .from('drivers')
        .select('*');
    
    if (error) {
        console.error('Erreur chargement drivers:', error);
        return [];
    }
    return data || [];
}

// ==================== MISE À JOUR CARTE TRANSPORTS ====================
async function updateMap() {
    if (!markers) return;
    
    markers.clearLayers();
    const orders = await loadOrders();
    const bounds = [];
    let count = 1;
    
    for (const order of orders) {
        const geo = await geocodeCity(order.delivery_city);
        if (!geo) continue;
        
        // Couleur selon le statut
        let bgColor = '#facc15'; // pending
        if (order.status === 'planned') bgColor = '#3b82f6';
        if (order.status === 'urgent') bgColor = '#ef4444';
        if (order.status === 'delivered') bgColor = '#10b981';
        
        const icon = L.divIcon({
            html: `<div style="background:${bgColor}; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; border:2px solid white; ${order.status === 'urgent' ? 'animation:pulse 1.5s infinite;' : ''}">${count}</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const marker = L.marker([geo.lat, geo.lng], { icon });
        
        marker.bindPopup(`
            <div style="min-width:200px;">
                <div style="font-weight:bold; margin-bottom:5px;">📦 ${order.client_name || 'Sans client'}</div>
                <div style="margin:5px 0;">📍 ${order.pickup_city} → ${order.delivery_city}</div>
                ${order.distance_km ? `<div>📏 ${order.distance_km} km (${order.duration_min} min)</div>` : ''}
                <div style="margin-top:10px;">
                    <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_city)}')" style="background:#facc15; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗺️ Itinéraire</button>
                </div>
            </div>
        `);
        
        markers.addLayer(marker);
        bounds.push([geo.lat, geo.lng]);
        count++;
    }
    
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }
    
    return orders;
}

// ==================== SUIVI DES CHAUFFEURS ====================
async function updateDriverTracking() {
    if (!driverTrackingEnabled) return;
    
    // Supprimer les anciens marqueurs
    driverMarkers.forEach(m => map.removeLayer(m));
    driverMarkers = [];
    
    const drivers = await loadDrivers();
    
    for (const driver of drivers) {
        if (!driver.lat || !driver.lng) continue;
        
        // Icône camion pour les chauffeurs
        const icon = L.divIcon({
            html: `<div style="background:#3b82f6; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; border:2px solid white; transform:rotate(${driver.heading || 0}deg);">🚚</div>`,
            className: '',
            iconSize: [30, 30]
        });
        
        const marker = L.marker([driver.lat, driver.lng], { icon });
        
        marker.bindPopup(`
            <div>
                <b>${driver.name}</b><br>
                📱 ${driver.phone}<br>
                🚚 ${driver.vehicle}<br>
                <span style="color:${driver.status === 'online' ? '#10b981' : '#6b7280'}">● ${driver.status}</span>
            </div>
        `);
        
        marker.addTo(map);
        driverMarkers.push(marker);
    }
}

// ==================== MISE À JOUR LISTE ====================
async function updateOrdersList() {
    const orders = await loadOrders();
    const content = document.getElementById('panelContent');
    
    let pending = 0, urgent = 0;
    let html = '<div class="orders-list">';
    
    for (const order of orders) {
        if (order.status === 'pending') pending++;
        if (order.status === 'urgent') urgent++;
        
        html += `
            <div class="order-card ${order.priority === 'urgent' ? 'urgent' : ''}">
                <div class="order-header">
                    <span class="client-name">${order.client_name || 'Sans client'}</span>
                    <span class="status-badge ${order.status}">${order.status}</span>
                </div>
                <div class="address">
                    📍 ${order.pickup_city || '?'} → ${order.delivery_city || '?'}
                </div>
                <div class="route-info">
                    <span>📏 Distance: <strong>${order.distance_km ? order.distance_km + ' km' : '...'}</strong></span>
                    <span>⏱️ Durée: <strong>${order.duration_min ? order.duration_min + ' min' : '...'}</strong></span>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    content.innerHTML = html;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('urgentCount').textContent = urgent;
}

async function updateDriversList() {
    const drivers = await loadDrivers();
    const content = document.getElementById('panelContent');
    
    let online = 0;
    let html = '<div class="drivers-list">';
    
    for (const driver of drivers) {
        if (driver.status === 'online') online++;
        
        html += `
            <div class="driver-card">
                <div class="driver-avatar">${driver.name.charAt(0)}</div>
                <div class="driver-info">
                    <div class="driver-name">${driver.name}</div>
                    <div class="driver-status">
                        <span class="status-dot ${driver.status !== 'online' ? 'offline' : ''}"></span>
                        <span>${driver.status}</span>
                    </div>
                    <div class="driver-position">
                        📍 ${driver.current_city || 'Position inconnue'}
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    content.innerHTML = html;
    document.getElementById('onlineDrivers').textContent = online;
}

// ==================== INTERFACE UTILISATEUR ====================
const UI = {
    newTransport: function() {
        document.getElementById('modalTitle').innerText = '➕ Nouveau transport';
        document.getElementById('modalContent').innerHTML = `
            <form onsubmit="event.preventDefault(); UI.saveTransport();">
                <div class="form-section">
                    <h4>👤 Client</h4>
                    <div class="form-grid">
                        <div class="form-field full-width">
                            <label>Nom complet *</label>
                            <input type="text" id="clientName" required placeholder="Jean Dupont">
                        </div>
                        <div class="form-field">
                            <label>Téléphone</label>
                            <input type="tel" id="clientPhone" placeholder="079 123 45 67">
                        </div>
                        <div class="form-field">
                            <label>Email</label>
                            <input type="email" id="clientEmail" placeholder="client@email.com">
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>📍 Ramassage</h4>
                    <div class="form-grid">
                        <div class="form-field full-width">
                            <label>Rue *</label>
                            <input type="text" id="pickupStreet" required placeholder="Rue du Simplon">
                        </div>
                        <div class="form-field">
                            <label>N°</label>
                            <input type="text" id="pickupNumber" placeholder="12">
                        </div>
                        <div class="form-field">
                            <label>Code postal *</label>
                            <input type="text" id="pickupPostal" required placeholder="1000">
                        </div>
                        <div class="form-field">
                            <label>Ville *</label>
                            <input type="text" id="pickupCity" required placeholder="Lausanne">
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>🎯 Livraison</h4>
                    <div class="form-grid">
                        <div class="form-field full-width">
                            <label>Rue *</label>
                            <input type="text" id="deliveryStreet" required placeholder="Rue du Mont-Blanc">
                        </div>
                        <div class="form-field">
                            <label>N°</label>
                            <input type="text" id="deliveryNumber" placeholder="8">
                        </div>
                        <div class="form-field">
                            <label>Code postal *</label>
                            <input type="text" id="deliveryPostal" required placeholder="1200">
                        </div>
                        <div class="form-field">
                            <label>Ville *</label>
                            <input type="text" id="deliveryCity" required placeholder="Genève">
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>📦 Colis</h4>
                    <div class="form-grid">
                        <div class="form-field">
                            <label>Poids (kg)</label>
                            <input type="number" id="weight" value="1" step="0.1">
                        </div>
                        <div class="form-field">
                            <label>Priorité</label>
                            <select id="priority">
                                <option value="normal">Normal</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button type="button" onclick="UI.closeModal()" style="flex:1; padding:12px; background:#2a2a2a; color:white; border:none; border-radius:6px; cursor:pointer;">Annuler</button>
                    <button type="submit" style="flex:2; padding:12px; background:#facc15; color:#111; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Créer transport</button>
                </div>
            </form>
        `;
        document.getElementById('modal').style.display = 'flex';
    },
    
    closeModal: function() {
        document.getElementById('modal').style.display = 'none';
    },
    
    saveTransport: async function() {
        const transport = {
            client_name: document.getElementById('clientName')?.value,
            client_phone: document.getElementById('clientPhone')?.value,
            client_email: document.getElementById('clientEmail')?.value,
            pickup_street: document.getElementById('pickupStreet')?.value,
            pickup_number: document.getElementById('pickupNumber')?.value,
            pickup_postal: document.getElementById('pickupPostal')?.value,
            pickup_city: document.getElementById('pickupCity')?.value,
            delivery_street: document.getElementById('deliveryStreet')?.value,
            delivery_number: document.getElementById('deliveryNumber')?.value,
            delivery_postal: document.getElementById('deliveryPostal')?.value,
            delivery_city: document.getElementById('deliveryCity')?.value,
            weight: parseFloat(document.getElementById('weight')?.value) || 1,
            priority: document.getElementById('priority')?.value || 'normal',
            status: 'pending',
            created_at: new Date()
        };
        
        if (!transport.pickup_city || !transport.delivery_city) {
            alert('Veuillez remplir les villes');
            return;
        }
        
        // Calculer la distance
        const route = await calculateRoute(transport.pickup_city, transport.delivery_city);
        if (route) {
            transport.distance_km = route.km;
            transport.duration_min = route.min;
        }
        
        const { error } = await supabase.from('orders').insert([transport]);
        
        if (error) {
            console.error('Erreur:', error);
            alert('❌ Erreur création');
        } else {
            alert('✅ Transport créé');
            UI.closeModal();
            refreshAll();
        }
    }
};

// ==================== FONCTIONS DE VUE ====================
function switchView(view) {
    currentView = view;
    
    // Mettre à jour les boutons
    document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Mettre à jour le titre
    const titles = {
        'dispatch': '📋 Transports en attente',
        'dashboard': '📊 Dashboard',
        'transports': '📦 Tous les transports',
        'tours': '🗺️ Tournées',
        'clients': '👤 Clients',
        'drivers': '🚚 Chauffeurs',
        'vehicles': '🚛 Véhicules',
        'tracking': '📡 Suivi temps réel'
    };
    document.getElementById('panelTitle').innerHTML = titles[view] || '📋 Liste';
    
    // Charger le contenu
    if (view === 'dispatch' || view === 'transports') {
        updateOrdersList();
    } else if (view === 'drivers' || view === 'tracking') {
        updateDriversList();
    } else {
        document.getElementById('panelContent').innerHTML = '<div style="text-align:center; color:#666; padding:30px;">En cours de développement...</div>';
    }
}

function toggleDriverTracking() {
    driverTrackingEnabled = !driverTrackingEnabled;
    if (driverTrackingEnabled) {
        updateDriverTracking();
        alert('✅ Suivi des chauffeurs activé');
    } else {
        driverMarkers.forEach(m => map.removeLayer(m));
        driverMarkers = [];
    }
}

async function refreshAll() {
    await updateMap();
    if (currentView === 'dispatch' || currentView === 'transports') {
        await updateOrdersList();
    } else if (currentView === 'drivers' || currentView === 'tracking') {
        await updateDriversList();
    }
    if (driverTrackingEnabled) {
        await updateDriverTracking();
    }
}

// ==================== INITIALISATION ====================
window.addEventListener('load', async () => {
    initMap();
    await updateMap();
    await updateOrdersList();
    
    // Rafraîchissement automatique
    setInterval(refreshAll, 30000);
});

// Style pour l'animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
`;
document.head.appendChild(style);
</script>

</body>
</html>
