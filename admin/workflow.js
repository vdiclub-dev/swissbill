// ============================================================
// workflow.js — Colixo Transport Workflow Engine
// Requires window.SUPABASE_CLIENT (provided by config.js)
// Status flow: pending → planned → in_transit → delivered → completed
// NEVER delete missions or tournées — update statuses only
// ============================================================
(function(window) {
'use strict';

function getDB() {
    return window.SUPABASE_CLIENT;
}

function nowISO() {
    return new Date().toISOString();
}

// ── assignTourToDriver ────────────────────────────────────────────────────────
// Sets driver_id on every active mission in the tour, marks them planned,
// and updates tournee_affectations for the day.

async function assignTourToDriver(tourId, driverId) {
    var db = getDB();
    if (!db) throw new Error('DB non disponible');

    var today = new Date().toISOString().slice(0, 10);
    var now = nowISO();

    // 1. Set driver_id + planned status on all active missions in this tour
    var payload = {
        driver_id:    driverId,
        assigned_at:  driverId ? now : null,
        admin_status: 'accepted',
        status:       'planned'
    };

    var r = await db.from('transport_orders_simple')
        .update(payload)
        .eq('tournee_id', tourId)
        .not('status', 'in', '("delivered","refused","cancelled","completed")');

    if (r.error) throw r.error;

    // 2. Keep tournee_affectations in sync
    await db.from('tournee_affectations').delete().eq('tournee_id', tourId).eq('date', today);
    if (driverId) {
        await db.from('tournee_affectations').insert([{
            tournee_id: tourId,
            date:       today,
            employe_id: driverId
        }]);
    }

    // 3. Push notification to driver
    try {
        if (window.ColixoPush && window.ColixoPush.notifyDriver) {
            var disp  = window.ColixoDispatch;
            var t     = disp ? disp.tournees.find(function(x) { return x.id === tourId; }) : null;
            var count = disp ? disp.rows.filter(function(r2) { return r2.tournee_id === tourId; }).length : '?';
            await window.ColixoPush.notifyDriver(
                driverId,
                '🗺 Tournée assignée' + (t ? ' : ' + t.nom : ''),
                count + ' livraison(s) vous attendent',
                { type: 'tour_assigned', tour_id: tourId }
            );
        }
    } catch(_) {}

    return { ok: true };
}

// ── startTour ─────────────────────────────────────────────────────────────────
// Marks all planned/pending missions in a tour as in_transit.
// Call this when the driver picks up the first parcel of a tour.

async function startTour(tourId) {
    var db = getDB();
    if (!db) throw new Error('DB non disponible');

    var r = await db.from('transport_orders_simple')
        .update({ status: 'in_transit', picked_up_at: nowISO() })
        .eq('tournee_id', tourId)
        .in('status', ['pending', 'planned']);

    if (r.error) throw r.error;
    return { ok: true };
}

// ── completeMission ───────────────────────────────────────────────────────────
// Marks a single mission as delivered, then checks if the whole tour is done.

async function completeMission(missionId, data) {
    var db = getDB();
    if (!db) throw new Error('DB non disponible');

    data = data || {};
    var payload = { status: 'delivered', delivered_at: nowISO() };
    if (data.note) payload.instructions = data.note;

    var r = await db.from('transport_orders_simple')
        .update(payload)
        .eq('id', missionId)
        .select('tournee_id')
        .single();

    if (r.error) throw r.error;

    var tourneeId = r.data && r.data.tournee_id;
    if (tourneeId) {
        checkTourCompletion(tourneeId);
    }

    return { ok: true, tourneeId: tourneeId || null };
}

// ── checkTourCompletion ───────────────────────────────────────────────────────
// Returns true if every mission in the tour is done.
// When fully done, fires 'colixo:tour_completed' event and auto-moves to billing.

async function checkTourCompletion(tourId) {
    var db = getDB();
    if (!db) return false;

    var r = await db.from('transport_orders_simple')
        .select('id, status')
        .eq('tournee_id', tourId);

    var missions = r.data || [];
    if (!missions.length) return false;

    var allDone = missions.every(function(m) {
        return ['delivered', 'refused', 'cancelled', 'completed'].indexOf(m.status) >= 0;
    });

    if (allDone) {
        window.dispatchEvent(new CustomEvent('colixo:tour_completed', {
            detail: { tourId: tourId, missionCount: missions.length }
        }));
        moveDeliveredToInvoicing(tourId);
    }

    return allDone;
}

// ── moveDeliveredToInvoicing ──────────────────────────────────────────────────
// Moves delivered missions to 'completed' (billing-ready).
// Pass tourId to restrict to one tour, or omit for all delivered missions.

async function moveDeliveredToInvoicing(tourId) {
    var db = getDB();
    if (!db) return;

    var q = db.from('transport_orders_simple')
        .update({ status: 'completed' })
        .eq('status', 'delivered');

    if (tourId) q = q.eq('tournee_id', tourId);

    var r = await q;
    if (r.error) console.warn('[Workflow] moveDeliveredToInvoicing:', r.error.message);

    // Notify dispatch UI to refresh
    window.dispatchEvent(new CustomEvent('colixo:billing_ready', {
        detail: { tourId: tourId || null }
    }));

    return { ok: !r.error };
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoWorkflow = {
    assignTourToDriver:       assignTourToDriver,
    startTour:                startTour,
    completeMission:          completeMission,
    checkTourCompletion:      checkTourCompletion,
    moveDeliveredToInvoicing: moveDeliveredToInvoicing
};

})(window);
