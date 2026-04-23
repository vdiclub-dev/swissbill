// ============================================================
// ai-dispatch.js — Smart Dispatch Engine (Colixo)
// Requires window.ColixoDispatch exposed by transports-dispatch.html
// ============================================================
(function(window) {
'use strict';

var DEPOT = { lat: 46.8006, lng: 6.7611 }; // Yvonand
var MAX_ORDERS = 20;
var MAX_KM = 200;
var COLORS = ['#e8311a','#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6','#f97316','#ec4899','#06b6d4','#84cc16','#fb7185','#818cf8'];

var autoTimer = null;
var autoEnabled = false;

// ── MATH ─────────────────────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function centroid(orders) {
    var n = orders.length;
    var lat = 0, lng = 0;
    orders.forEach(function(o){ lat += parseFloat(o.delivery_lat); lng += parseFloat(o.delivery_lng); });
    return { lat: lat/n, lng: lng/n };
}

function routeKm(orders) {
    var km = 0;
    for (var i = 0; i < orders.length - 1; i++) {
        km += haversine(
            parseFloat(orders[i].delivery_lat), parseFloat(orders[i].delivery_lng),
            parseFloat(orders[i+1].delivery_lat), parseFloat(orders[i+1].delivery_lng)
        );
    }
    if (orders.length > 0) {
        km += haversine(DEPOT.lat, DEPOT.lng, parseFloat(orders[0].delivery_lat), parseFloat(orders[0].delivery_lng));
        km += haversine(parseFloat(orders[orders.length-1].delivery_lat), parseFloat(orders[orders.length-1].delivery_lng), DEPOT.lat, DEPOT.lng);
    }
    return Math.round(km);
}

// ── K-MEANS CLUSTERING ────────────────────────────────────────────────────────

function kMeansCluster(orders) {
    if (!orders.length) return [];
    var k = Math.max(1, Math.ceil(orders.length / MAX_ORDERS));
    if (orders.length <= k) return orders.map(function(o){ return [o]; });

    // Deterministic init: spread centroids across longitude range
    var sorted = orders.slice().sort(function(a,b){ return parseFloat(a.delivery_lng)-parseFloat(b.delivery_lng); });
    var centroids = [];
    for (var ci = 0; ci < k; ci++) {
        var idx = Math.floor(ci * sorted.length / k);
        centroids.push({ lat: parseFloat(sorted[idx].delivery_lat), lng: parseFloat(sorted[idx].delivery_lng) });
    }

    var assignments = new Array(orders.length).fill(0);

    // K-means iterations
    for (var iter = 0; iter < 20; iter++) {
        var prev = assignments.slice();

        // Assign
        for (var oi = 0; oi < orders.length; oi++) {
            var minD = Infinity, minIdx = 0;
            for (var ki = 0; ki < centroids.length; ki++) {
                var d = haversine(parseFloat(orders[oi].delivery_lat), parseFloat(orders[oi].delivery_lng), centroids[ki].lat, centroids[ki].lng);
                if (d < minD) { minD = d; minIdx = ki; }
            }
            assignments[oi] = minIdx;
        }

        // Update centroids
        for (var ki2 = 0; ki2 < k; ki2++) {
            var group = orders.filter(function(_, j){ return assignments[j] === ki2; });
            if (group.length) centroids[ki2] = centroid(group);
        }

        // Convergence
        var converged = true;
        for (var ai = 0; ai < assignments.length; ai++) {
            if (assignments[ai] !== prev[ai]) { converged = false; break; }
        }
        if (converged) break;
    }

    // Build clusters
    var clusters = [];
    for (var ki3 = 0; ki3 < k; ki3++) clusters.push([]);
    assignments.forEach(function(ci2, i){ clusters[ci2].push(orders[i]); });

    // Split oversized clusters
    var result = [];
    clusters.filter(function(c){ return c.length > 0; }).forEach(function(cluster) {
        if (cluster.length <= MAX_ORDERS) {
            result.push(cluster);
        } else {
            var c = centroid(cluster);
            var cl = cluster.slice().sort(function(a, b){
                return haversine(parseFloat(a.delivery_lat), parseFloat(a.delivery_lng), c.lat, c.lng) -
                       haversine(parseFloat(b.delivery_lat), parseFloat(b.delivery_lng), c.lat, c.lng);
            });
            for (var i = 0; i < cl.length; i += MAX_ORDERS) result.push(cl.slice(i, i + MAX_ORDERS));
        }
    });

    return result;
}

// ── 2-OPT LOCAL IMPROVEMENT ───────────────────────────────────────────────────

function twoOpt(orders) {
    if (orders.length < 3) return orders;
    var route = orders.slice();

    function dist(a, b) {
        return haversine(parseFloat(a.delivery_lat), parseFloat(a.delivery_lng), parseFloat(b.delivery_lat), parseFloat(b.delivery_lng));
    }

    var improved = true;
    for (var pass = 0; pass < 4 && improved; pass++) {
        improved = false;
        for (var i = 0; i < route.length - 1; i++) {
            for (var j = i + 2; j < route.length; j++) {
                var d1 = dist(route[i], route[i+1]) + dist(route[j], route[(j+1) % route.length]);
                var d2 = dist(route[i], route[j])   + dist(route[i+1], route[(j+1) % route.length]);
                if (d2 < d1 - 0.001) {
                    var seg = route.slice(i+1, j+1).reverse();
                    route = route.slice(0, i+1).concat(seg).concat(route.slice(j+1));
                    improved = true;
                }
            }
        }
    }
    return route;
}

// ── TOUR SCORE ────────────────────────────────────────────────────────────────

function computeScore(orders, km) {
    if (!orders.length) return 0;
    var fill   = Math.min(orders.length / MAX_ORDERS, 1) * 35;
    var kmEff  = km > 0 ? Math.max(0, 1 - km / MAX_KM) * 35 : 35;
    var density= km > 0 ? Math.min(orders.length / (km / 12), 1) * 30 : 0;
    return Math.round(fill + kmEff + density);
}

window.getAITourScore = function(tid) {
    var disp = window.ColixoDispatch;
    if (!disp) return null;
    var orders = disp.rows.filter(function(r){ return r.tournee_id === tid; });
    if (!orders.length) return null;
    var km = routeKm(orders.filter(function(r){ return r.delivery_lat && r.delivery_lng; }));
    var score = computeScore(orders, km);
    if (score >= 75) return { cls:'score-a', label: score+'%' };
    if (score >= 50) return { cls:'score-b', label: score+'%' };
    return { cls:'score-c', label: score+'%' };
};

// ── DRIVER SUGGESTION ─────────────────────────────────────────────────────────

window.getAIDriverSuggestion = function(tid) {
    var disp = window.ColixoDispatch;
    if (!disp || !disp.chauffeurs.length) return null;
    var load = {};
    disp.chauffeurs.forEach(function(c){ load[c.id] = 0; });
    disp.rows.forEach(function(r){
        if (r.driver_id && load[r.driver_id] !== undefined && ['pending','planned','in_transit'].includes(r.status)) {
            load[r.driver_id]++;
        }
    });
    var tourOrders = disp.rows.filter(function(r){ return r.tournee_id === tid; });
    var currentDrvId = tourOrders.length ? tourOrders[0].driver_id : null;
    var candidates = disp.chauffeurs.filter(function(c){ return c.id !== currentDrvId; });
    if (!candidates.length) return null;
    candidates.sort(function(a,b){ return (load[a.id]||0)-(load[b.id]||0); });
    var best = candidates[0];
    return { id: best.id, name: ((best.prenom||'')+' '+(best.nom||'')).trim(), load: load[best.id]||0 };
};

// ── SET PROGRESS ─────────────────────────────────────────────────────────────

function setMsg(msg) {
    var el = document.getElementById('aiProgressMsg');
    var bar = document.getElementById('aiProgressBar');
    if (el) el.textContent = msg;
    if (bar) bar.style.display = msg ? 'flex' : 'none';
}

// ── CREATE SMART TOURS ────────────────────────────────────────────────────────

async function createSmartTours() {
    var disp = window.ColixoDispatch;
    if (!disp) { alert('ColixoDispatch non initialisé'); return; }
    var rows = disp.rows, db = disp.db;

    var unassigned = rows.filter(function(r){ return !r.tournee_id && ['pending','planned'].includes(r.status); });
    var withCoords = unassigned.filter(function(r){ return r.delivery_lat && r.delivery_lng; });
    var noCoords   = unassigned.filter(function(r){ return !r.delivery_lat || !r.delivery_lng; });

    if (!unassigned.length) { disp.toast('Aucune commande non assignée', false); return; }

    setMsg('Clustering IA…');
    try {
        var clusters = kMeansCluster(withCoords);
        if (noCoords.length) clusters.push(noCoords);

        var today = new Date().toISOString().split('T')[0];
        var created = 0;

        for (var ci = 0; ci < clusters.length; ci++) {
            var cluster = clusters[ci];
            if (!cluster.length) continue;
            setMsg('Tournée '+(ci+1)+'/'+clusters.length+'…');

            var col = COLORS[created % COLORS.length];
            var nom = noCoords.includes ? (noCoords.includes(cluster[0]) ? 'Non géolocalisé' : 'Tournée IA '+(ci+1)) : 'Tournée IA '+(ci+1);

            var ins = await db.from('tournees').insert([{ nom:nom, date:today, couleur:col, jours:[1,2,3,4,5] }]).select('id').single();
            if (ins.error) throw ins.error;

            var ids = cluster.map(function(r){ return r.id; });
            var upd = await db.from('transport_orders_simple').update({ tournee_id:ins.data.id, status:'planned' }).in('id', ids);
            if (upd.error) throw upd.error;
            cluster.forEach(function(r){ r.tournee_id=ins.data.id; r.status='planned'; });
            created++;
        }

        setMsg('✅ '+created+' tournée(s) créée(s)');
        setTimeout(function(){ setMsg(''); }, 2500);
        await disp.reload();
        disp.toast('🤖 '+created+' tournée(s) IA créée(s)', true);

    } catch(e) {
        setMsg('');
        disp.toast('Erreur IA : '+(e.message||String(e)), false);
    }
}

// ── OPTIMIZE SINGLE TOUR ─────────────────────────────────────────────────────

async function optimizeSingleTour(tid) {
    var disp = window.ColixoDispatch;
    if (!disp) return;
    var tOrders = disp.rows.filter(function(r){ return r.tournee_id===tid && r.delivery_lat && r.delivery_lng; });
    if (tOrders.length < 2) return;

    var ordered = tOrders;

    if (tOrders.length <= 12) {
        try {
            var coords = tOrders.map(function(r){ return r.delivery_lng+','+r.delivery_lat; }).join(';');
            var url = 'https://router.project-osrm.org/trip/v1/driving/'+coords+'?source=first&roundtrip=false';
            var resp = await fetch(url);
            if (resp.ok) {
                var data = await resp.json();
                if (data.code === 'Ok') {
                    var orderedIds = new Array(tOrders.length).fill(null);
                    data.waypoints.forEach(function(wp, i){ orderedIds[wp.waypoint_index] = tOrders[i].id; });
                    ordered = orderedIds.filter(Boolean).map(function(id){ return tOrders.find(function(o){ return o.id===id; }); }).filter(Boolean);
                }
            }
        } catch(_) {
            ordered = twoOpt(tOrders);
        }
    } else {
        ordered = twoOpt(tOrders);
    }

    if (!window.tourneeOptimizedOrder) window.tourneeOptimizedOrder = {};
    window.tourneeOptimizedOrder[tid] = ordered.map(function(r){ return r.id; });
}

// ── OPTIMIZE ALL ──────────────────────────────────────────────────────────────

async function optimizeAll() {
    var disp = window.ColixoDispatch;
    if (!disp) return;
    var active = disp.tournees.filter(function(t){
        var tr = disp.rows.filter(function(r){ return r.tournee_id===t.id && r.delivery_lat && r.delivery_lng; });
        return tr.length >= 2;
    });
    if (!active.length) { disp.toast('Aucune tournée à optimiser', false); return; }

    setMsg('Optimisation en cours…');
    var done = 0;
    for (var i = 0; i < active.length; i++) {
        setMsg('Optimisation '+active[i].nom+' ('+( i+1)+'/'+active.length+')…');
        await optimizeSingleTour(active[i].id);
        done++;
        if (i < active.length - 1) await new Promise(function(r){ setTimeout(r, 600); });
    }
    setMsg('✅ '+done+' tournée(s) optimisée(s)');
    setTimeout(function(){ setMsg(''); }, 2500);
    if (disp.renderTournees) disp.renderTournees();
    if (window.renderMap) window.renderMap();
    disp.toast('⚡ '+done+' tournée(s) optimisée(s)', true);
}

// ── AUTO MODE ─────────────────────────────────────────────────────────────────

function toggleAutoMode() {
    autoEnabled = !autoEnabled;
    var btn = document.getElementById('btnAutoMode');
    if (autoEnabled) {
        autoTimer = setInterval(async function(){
            var disp = window.ColixoDispatch;
            if (!disp) return;
            var pending = disp.rows.filter(function(r){ return !r.tournee_id && ['pending','planned'].includes(r.status); });
            if (pending.length >= 5) {
                disp.toast('🤖 Auto-dispatch : '+pending.length+' commandes…', true);
                await createSmartTours();
            }
        }, 60000);
        if (btn) { btn.textContent = '🟢 AUTO ON'; btn.style.color = 'var(--green)'; btn.style.borderColor = 'rgba(34,197,94,0.4)'; }
    } else {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        if (btn) { btn.textContent = '⚫ AUTO OFF'; btn.style.color = ''; btn.style.borderColor = ''; }
    }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoAI = {
    createSmartTours:  createSmartTours,
    optimizeAll:       optimizeAll,
    optimizeSingle:    optimizeSingleTour,
    toggleAutoMode:    toggleAutoMode
};

})(window);
