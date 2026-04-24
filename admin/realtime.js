// ============================================================
// realtime.js — Colixo Bidirectional Realtime Sync
// Requires window.SUPABASE_CLIENT (provided by config.js)
// ============================================================
(function(window) {
'use strict';

var channels = {};

function getDB() {
    return window.SUPABASE_CLIENT;
}

// ── initDispatch ──────────────────────────────────────────────────────────────
// Subscribe to all transport_orders_simple + tournees changes.
// callbacks: { onMissionChange(payload), onTourneeChange(payload) }

function initDispatch(callbacks) {
    var db = getDB();
    if (!db) return null;

    callbacks = callbacks || {};
    destroyChannel('dispatch');

    channels.dispatch = db.channel('colixo_dispatch_rt_v2')
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'transport_orders_simple'
        }, function(payload) {
            if (callbacks.onMissionChange) callbacks.onMissionChange(payload);
        })
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'tournees'
        }, function(payload) {
            if (callbacks.onTourneeChange) callbacks.onTourneeChange(payload);
        })
        .subscribe(function(status) {
            if (window.console) console.log('[Realtime] Dispatch:', status);
        });

    return channels.dispatch;
}

// ── initDriver ────────────────────────────────────────────────────────────────
// Subscribe to INSERT and UPDATE on transport_orders_simple for a specific driver.
// callbacks: { onNewMission(row), onMissionUpdate(newRow, oldRow) }

function initDriver(driverId, callbacks) {
    var db = getDB();
    if (!db || !driverId) return null;

    callbacks = callbacks || {};
    var key = 'driver_' + driverId;
    destroyChannel(key);

    channels[key] = db.channel('colixo_driver_rt_' + driverId)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'transport_orders_simple',
            filter: 'driver_id=eq.' + driverId
        }, function(payload) {
            if (callbacks.onNewMission) callbacks.onNewMission(payload.new);
        })
        .on('postgres_changes', {
            event:  'UPDATE',
            schema: 'public',
            table:  'transport_orders_simple',
            filter: 'driver_id=eq.' + driverId
        }, function(payload) {
            if (callbacks.onMissionUpdate) callbacks.onMissionUpdate(payload.new, payload.old);
        })
        .subscribe(function(status) {
            if (window.console) console.log('[Realtime] Driver', driverId, ':', status);
        });

    return channels[key];
}

// ── destroyChannel ────────────────────────────────────────────────────────────

function destroyChannel(key) {
    var db = getDB();
    if (!db || !channels[key]) return;
    try { db.removeChannel(channels[key]); } catch(_) {}
    delete channels[key];
}

function destroyAll() {
    Object.keys(channels).forEach(destroyChannel);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoRealtime = {
    initDispatch:   initDispatch,
    initDriver:     initDriver,
    destroyChannel: destroyChannel,
    destroyAll:     destroyAll
};

})(window);
