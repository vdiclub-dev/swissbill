// ============================================================
// pricing.js — Colixo Dynamic Pricing Engine
// Requires window.ColixoDispatch (exposed by transports-dispatch.html)
// ============================================================
(function(window) {
'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

var BASE_PRICE       = 6;     // CHF
var MIN_PRICE        = 7;     // CHF floor
var KM_THRESHOLD     = 5;     // km before per-km charge kicks in
var KM_RATE          = 0.5;   // CHF / km beyond threshold
var HISTORY_KEY      = 'colixo_price_history'; // localStorage key

// ── getSystemLoad ─────────────────────────────────────────────────────────────
// Returns 'low' | 'normal' | 'high' based on active mission count

function getSystemLoad() {
    var disp = window.ColixoDispatch;
    if (!disp) return 'normal';
    var active = disp.rows.filter(function(r) {
        return ['pending','planned','in_transit'].indexOf(r.status) >= 0;
    }).length;
    var drivers = disp.chauffeurs.length || 1;
    var ratio = active / (drivers * 8); // 8 missions/driver = normal load
    if (ratio < 0.4) return 'low';
    if (ratio > 0.8) return 'high';
    return 'normal';
}

// ── getTourDensity ────────────────────────────────────────────────────────────

function getTourDensity(tourneeId) {
    if (!tourneeId) return 'empty';
    var disp = window.ColixoDispatch;
    if (!disp) return 'normal';
    var missions = disp.rows.filter(function(r) { return r.tournee_id === tourneeId; });
    if (missions.length >= 10) return 'dense';
    if (missions.length <= 2)  return 'empty';
    return 'normal';
}

// ── adjustBasedOnHistory ──────────────────────────────────────────────────────
// Applies a learned multiplier from past acceptance/refusal data

function adjustBasedOnHistory(basePrice, serviceType) {
    try {
        var raw  = localStorage.getItem(HISTORY_KEY);
        var hist = raw ? JSON.parse(raw) : {};
        var entry = hist[serviceType];
        if (!entry || entry.samples < 3) return 0; // not enough data yet
        // Positive adjustment = price was too low (refusals); negative = too high (fast accepts)
        return Math.round(entry.adjustment * 10) / 10;
    } catch (_) { return 0; }
}

// ── recordOutcome ─────────────────────────────────────────────────────────────
// Call after a transport is accepted (fast = price ok) or refused

function recordOutcome(serviceType, price, accepted) {
    try {
        var raw  = localStorage.getItem(HISTORY_KEY);
        var hist = raw ? JSON.parse(raw) : {};
        if (!hist[serviceType]) hist[serviceType] = { adjustment: 0, samples: 0 };
        var e = hist[serviceType];
        e.samples++;
        // Refused → price too low → increase next time
        // Accepted fast → price ok → keep or slight decrease
        if (!accepted) {
            e.adjustment = (e.adjustment * (e.samples - 1) + 2) / e.samples;
        } else {
            e.adjustment = (e.adjustment * (e.samples - 1) - 0.3) / e.samples;
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch (_) {}
}

// ── calculateDynamicPrice ─────────────────────────────────────────────────────
// params: { km, serviceType, isUrgent, tourneeId }
// Returns: { price, breakdown, label }

function calculateDynamicPrice(params) {
    var km          = parseFloat(params.km) || 0;
    var serviceType = params.serviceType || 'standard';
    var isUrgent    = !!params.isUrgent;
    var tourneeId   = params.tourneeId || null;

    var steps = [];
    var price = BASE_PRICE;
    steps.push({ label: 'Base', value: BASE_PRICE });

    // Distance adjustment
    if (km > KM_THRESHOLD) {
        var distAdj = Math.round((km - KM_THRESHOLD) * KM_RATE * 100) / 100;
        price += distAdj;
        steps.push({ label: 'Distance (' + Math.round(km) + ' km)', value: +distAdj });
    }

    // Tour density
    var density = getTourDensity(tourneeId);
    var densityAdj = 0;
    if (density === 'dense') {
        densityAdj = -1;
        steps.push({ label: 'Tournée dense', value: -1 });
    } else if (density === 'empty') {
        densityAdj = 2;
        steps.push({ label: 'Tournée vide', value: +2 });
    }
    price += densityAdj;

    // Urgency / service type
    var urgencyAdj = 0;
    if (isUrgent || serviceType === 'prio') {
        urgencyAdj = 5;
        steps.push({ label: 'Urgent', value: +5 });
    } else if (serviceType === 'express' || serviceType === 'same_day') {
        urgencyAdj = 10;
        steps.push({ label: serviceType === 'same_day' ? 'Same Day' : 'Express', value: +10 });
    } else if (serviceType === 'vinologue') {
        urgencyAdj = 4;
        steps.push({ label: 'Vinologue', value: +4 });
    } else if (serviceType === 'eco') {
        urgencyAdj = -1;
        steps.push({ label: 'Eco', value: -1 });
    }
    price += urgencyAdj;

    // System load
    var load = getSystemLoad();
    var loadAdj = 0;
    if (load === 'high') {
        loadAdj = 2;
        steps.push({ label: 'Forte activité', value: +2 });
    } else if (load === 'low') {
        loadAdj = -1;
        steps.push({ label: 'Faible activité', value: -1 });
    }
    price += loadAdj;

    // History learning
    var histAdj = adjustBasedOnHistory(price, serviceType);
    if (histAdj !== 0) {
        price += histAdj;
        steps.push({ label: 'Correction historique', value: histAdj });
    }

    // Floor
    price = Math.max(price, MIN_PRICE);
    price = Math.round(price * 2) / 2; // round to 0.50

    return {
        price:     price,
        steps:     steps,
        load:      load,
        density:   density,
        breakdown: steps.map(function(s) {
            return s.label + ' ' + (s.value >= 0 ? '+' : '') + s.value + ' CHF';
        }).join(' · ')
    };
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoPrice = {
    calculateDynamicPrice: calculateDynamicPrice,
    adjustBasedOnHistory:  adjustBasedOnHistory,
    getSystemLoad:         getSystemLoad,
    recordOutcome:         recordOutcome
};

})(window);
