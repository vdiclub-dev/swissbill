// ============================================================
// profit.js — Colixo Profit Engine
// Requires window.ColixoDispatch exposed by transports-dispatch.html
// ============================================================
(function(window) {
'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

var KM_COST        = 0.25;  // CHF/km (electric vehicle)
var FIXED_COST     = 20;    // CHF fixed per tour (insurance, platform, etc.)
var TIME_CHF_PER_H = 25;    // CHF/hr (driver time)
var AVG_SPEED      = 35;    // km/h average urban delivery speed
var FALLBACK_PRICE = { same_day:35, express:25, prio:18, vinologue:16, standard:12, eco:9 };
var DEPOT          = { lat: 46.8006, lng: 6.7611 }; // Yvonand

// ── HAVERSINE + ROUTE KM ──────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2)
          + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Calcule les km réels aller-retour : dépôt → stops → dépôt
function realRouteKm(missions) {
    var geo = missions.filter(function(m) { return m.delivery_lat && m.delivery_lng; });
    if (!geo.length) {
        // Pas de coordonnées : fallback sum des distance_km individuels
        return missions.reduce(function(s, m) { return s + (parseFloat(m.distance_km) || 8); }, 0);
    }
    var km = 0;
    // Dépôt → première livraison
    km += haversine(DEPOT.lat, DEPOT.lng, parseFloat(geo[0].delivery_lat), parseFloat(geo[0].delivery_lng));
    // Entre chaque livraison
    for (var i = 0; i < geo.length - 1; i++) {
        km += haversine(
            parseFloat(geo[i].delivery_lat),   parseFloat(geo[i].delivery_lng),
            parseFloat(geo[i+1].delivery_lat), parseFloat(geo[i+1].delivery_lng)
        );
    }
    // Dernière livraison → retour dépôt
    km += haversine(parseFloat(geo[geo.length-1].delivery_lat), parseFloat(geo[geo.length-1].delivery_lng), DEPOT.lat, DEPOT.lng);
    return km;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function fmtCHF(n) {
    return new Intl.NumberFormat('fr-CH', {
        style:'currency', currency:'CHF',
        minimumFractionDigits:2, maximumFractionDigits:2
    }).format(Number(n) || 0);
}

function missionRevenue(m) {
    var p = parseFloat(m.price_chf);
    if (!isNaN(p) && p > 0) return p;
    var type = m.service_type || m.speed || 'standard';
    var qty  = parseInt(m.quantity, 10) || 1;
    return (FALLBACK_PRICE[type] || 12) * qty;
}

// ── calculateMissionCost ──────────────────────────────────────────────────────

function calculateMissionCost(mission) {
    var km = parseFloat(mission.distance_km) || 0;
    if (!km) {
        // Estimate from address if no distance: fallback 8 km per stop
        km = 8;
    }
    var kmCost   = km * KM_COST;
    var timeCost = (km / AVG_SPEED) * TIME_CHF_PER_H;
    return Math.round((kmCost + timeCost) * 100) / 100;
}

// ── calculateTourProfit ───────────────────────────────────────────────────────

function calculateTourProfit(missions) {
    if (!missions || !missions.length) return null;

    var revenue = missions.reduce(function(s, m) { return s + missionRevenue(m); }, 0);

    // Km réels : dépôt → toutes livraisons chaînées → retour dépôt
    var km = realRouteKm(missions);

    var kmCost   = km * KM_COST;
    var timeCost = (km / AVG_SPEED) * TIME_CHF_PER_H;
    var cost     = FIXED_COST + kmCost + timeCost;

    var profit        = revenue - cost;
    var marginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
        revenue:       Math.round(revenue * 100) / 100,
        cost:          Math.round(cost    * 100) / 100,
        profit:        Math.round(profit  * 100) / 100,
        marginPercent: marginPercent,
        km:            Math.round(km),
        missionCount:  missions.length
    };
}

// ── suggestPrice ──────────────────────────────────────────────────────────────
// Returns the minimum viable price for a mission given tour context

function suggestPrice(mission, tourContext) {
    var km   = parseFloat(mission.distance_km) || 8;
    var type = mission.service_type || mission.speed || 'standard';
    var qty  = parseInt(mission.quantity, 10) || 1;

    // Tour density: missions per km — high density = better efficiency
    var density = tourContext && tourContext.km > 0
        ? tourContext.missionCount / tourContext.km
        : 0.05;

    // Cost per mission (allocated portion of fixed cost)
    var missions = tourContext ? Math.max(tourContext.missionCount, 1) : 5;
    var missionFixed = FIXED_COST / missions;
    var missionCost  = (km * KM_COST) + (km / AVG_SPEED * TIME_CHF_PER_H) + missionFixed;

    // Target margin: 35% base
    var targetMargin = 1.35;

    // Density bonus: dense tour can afford lower price
    var densityFactor = density > 0.15 ? 0.88 : density > 0.08 ? 1.0 : 1.28;

    // Service type multiplier
    var typeMultiplier = {
        same_day:1.9, express:1.6, prio:1.35, vinologue:1.2, standard:1.0, eco:0.78
    }[type] || 1.0;

    var suggested = missionCost * targetMargin * densityFactor * typeMultiplier * qty;

    // Never go below fallback market price
    return Math.max(Math.ceil(suggested * 2) / 2, FALLBACK_PRICE[type] || 12);
}

// ── getTourAIAdvice ───────────────────────────────────────────────────────────

function getTourAIAdvice(profit, missions) {
    if (!profit || !missions) return [];
    var advice = [];

    if (profit.marginPercent < 0) {
        advice.push({
            type: 'danger',
            msg:  '⚠ Tournée non rentable — perte ' + fmtCHF(-profit.profit)
        });
        // Find the most isolated mission (highest km, lowest revenue)
        var sorted = missions.slice().sort(function(a, b) {
            var scoreA = missionRevenue(a) / Math.max(parseFloat(a.distance_km) || 8, 1);
            var scoreB = missionRevenue(b) / Math.max(parseFloat(b.distance_km) || 8, 1);
            return scoreA - scoreB;
        });
        var worst = sorted[0];
        if (worst) {
            var wkm     = Math.round(parseFloat(worst.distance_km) || 8);
            var wrev    = Math.round(missionRevenue(worst));
            var suggest = suggestPrice(worst, profit);
            advice.push({
                type: 'action',
                msg:  '→ Mission ' + (worst.order_number || worst.id.slice(0,8)) + ' : ' + wkm + ' km pour ' + wrev + ' CHF — prix suggéré : ' + suggest + ' CHF'
            });
        }
        if (missions.length < 5) {
            advice.push({ type: 'action', msg: '→ Regrouper avec d\'autres missions pour diluer le coût fixe' });
        }
    } else if (profit.marginPercent < 15) {
        advice.push({ type: 'warning', msg: '⚡ Marge faible (' + profit.marginPercent + '%) — ajouter des missions ou réviser les prix' });
    }

    return advice;
}

// ── profitClass ───────────────────────────────────────────────────────────────

function profitClass(marginPercent) {
    if (marginPercent >= 30) return 'profit-good';
    if (marginPercent >= 0)  return 'profit-ok';
    return 'profit-bad';
}

// ── renderProfitBadge ─────────────────────────────────────────────────────────
// Returns HTML string for inline use in renderTourneePanel

function renderProfitBadge(tid) {
    var disp = window.ColixoDispatch;
    if (!disp) return '';
    var missions = disp.rows.filter(function(r) { return r.tournee_id === tid; });
    if (!missions.length) return '';

    var profit = calculateTourProfit(missions);
    if (!profit) return '';

    var cls    = profitClass(profit.marginPercent);
    var sign   = profit.profit >= 0 ? '+' : '';
    var advice = getTourAIAdvice(profit, missions);

    var advHtml = advice.map(function(a) {
        return '<div class="profit-advice profit-adv-' + a.type + '">' + a.msg + '</div>';
    }).join('');

    return '<div class="profit-badge ' + cls + '">'
        + '<div class="profit-row">'
        + '<span class="profit-item"><span class="profit-lbl">CA</span><b>' + fmtCHF(profit.revenue) + '</b></span>'
        + '<span class="profit-sep">·</span>'
        + '<span class="profit-item"><span class="profit-lbl">Coût</span><b>' + fmtCHF(profit.cost) + '</b></span>'
        + '<span class="profit-sep">·</span>'
        + '<span class="profit-item profit-result"><span class="profit-lbl">Profit</span><b>' + sign + fmtCHF(profit.profit) + '</b></span>'
        + '<span class="profit-margin-pill ' + cls + '">' + profit.marginPercent + '%</span>'
        + '</div>'
        + advHtml
        + '</div>';
}

// ── updateProfitDisplay ───────────────────────────────────────────────────────
// Refresh all profit badges already in the DOM (useful after data reload)

function updateProfitDisplay() {
    var disp = window.ColixoDispatch;
    if (!disp) return;
    disp.tournees.forEach(function(t) {
        var el = document.getElementById('profit-' + t.id);
        if (el) el.innerHTML = renderProfitBadge(t.id);
    });
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoProfit = {
    calculateTourProfit:  calculateTourProfit,
    calculateMissionCost: calculateMissionCost,
    suggestPrice:         suggestPrice,
    getTourAIAdvice:      getTourAIAdvice,
    renderProfitBadge:    renderProfitBadge,
    updateProfitDisplay:  updateProfitDisplay,
    profitClass:          profitClass
};

})(window);
