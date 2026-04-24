// ============================================================
// driver-pod.js — Colixo Proof of Delivery Engine
// Requires window.SUPABASE_CLIENT (config.js)
//
// Bucket setup (run once in Supabase dashboard):
//   Storage → New bucket → name: "deliveries" → Public: OFF
//
// SQL (run once in Supabase SQL editor):
//   ALTER TABLE transport_orders_simple
//     ADD COLUMN IF NOT EXISTS receiver_name  text,
//     ADD COLUMN IF NOT EXISTS photo_url      text,
//     ADD COLUMN IF NOT EXISTS signature_url  text,
//     ADD COLUMN IF NOT EXISTS pod_status     boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS pod_mode       text    DEFAULT 'full';
//
//   ALTER TABLE deliveries
//     ADD COLUMN IF NOT EXISTS receiver_name  text,
//     ADD COLUMN IF NOT EXISTS photo_url      text,
//     ADD COLUMN IF NOT EXISTS signature_url  text,
//     ADD COLUMN IF NOT EXISTS pod_status     boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS pod_mode       text    DEFAULT 'full';
// ============================================================
(function(window) {
'use strict';

var BUCKET = 'deliveries';

function db()  { return window.SUPABASE_CLIENT; }
function now() { return new Date().toISOString(); }

// ── dataUrlToBlob ─────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl) {
    var parts  = dataUrl.split(',');
    var mime   = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var raw    = atob(parts[1]);
    var buf    = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    return new Blob([buf], { type: mime });
}

// ── uploadToStorage ───────────────────────────────────────────────────────────
// Uploads a data URL to Supabase Storage.
// Returns the public URL string or null on failure (graceful degradation).

async function uploadToStorage(missionId, filename, dataUrl) {
    var client = db();
    if (!client || !dataUrl || !missionId) return null;
    try {
        var blob = dataUrlToBlob(dataUrl);
        var path = 'missions/' + missionId + '/' + filename;
        var r = await client.storage.from(BUCKET).upload(path, blob, {
            contentType: blob.type,
            upsert: true
        });
        if (r.error) {
            console.warn('[POD] Storage upload failed:', r.error.message);
            return null;
        }
        var pub = client.storage.from(BUCKET).getPublicUrl(path);
        return pub.data ? pub.data.publicUrl : null;
    } catch(e) {
        console.warn('[POD] Upload error:', e.message);
        return null;
    }
}

// ── validateDelivery ──────────────────────────────────────────────────────────
//
// params:
//   missionId    {string}  — required
//   driverId     {string}  — required
//   receiverName {string}  — required
//   photoB64     {string}  — base64 data URL, optional
//   sigCanvas    {Element} — canvas element, optional
//   note         {string}  — optional
//   gpsLat       {number}  — optional
//   gpsLng       {number}  — optional
//   mode         {string}  — 'full' | 'quick'
//
// Returns: { ok, photoUrl, signatureUrl, podStatus, error }

async function validateDelivery(params) {
    var client = db();
    if (!client) return { ok: false, error: 'DB non disponible' };

    var missionId    = params.missionId;
    var driverId     = params.driverId     || null;
    var receiverName = (params.receiverName || '').trim();
    var photoB64     = params.photoB64     || null;
    var sigCanvas    = params.sigCanvas    || null;
    var note         = (params.note        || '').trim();
    var gpsLat       = params.gpsLat       || null;
    var gpsLng       = params.gpsLng       || null;
    var mode         = params.mode         || 'full';

    var hasSig = sigCanvas && !sigCanvas.classList.contains('empty') &&
                 sigCanvas.classList.contains('signed');

    // ── Validation ────────────────────────────────────────────────────────────
    if (!receiverName) {
        return { ok: false, error: 'Le nom du réceptionnaire est obligatoire' };
    }
    if (mode === 'full' && !photoB64 && !hasSig) {
        return { ok: false, error: 'Ajoutez une photo ou une signature' };
    }

    var ts = now();
    var podFull   = (photoB64 || hasSig) ? true : false;
    var podStatus = mode === 'quick' ? false : podFull;

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    var photoUrl     = null;
    var signatureUrl = null;

    if (photoB64) {
        photoUrl = await uploadToStorage(missionId, 'photo.jpg', photoB64);
    }
    if (hasSig && sigCanvas) {
        var sigDataUrl = sigCanvas.toDataURL('image/png', 0.9);
        signatureUrl   = await uploadToStorage(missionId, 'signature.png', sigDataUrl);
    }

    // Keep base64 as fallback in case Storage is not configured
    var sigB64Fallback  = (hasSig && sigCanvas) ? sigCanvas.toDataURL('image/jpeg', 0.75) : null;

    // ── Update transport_orders_simple ────────────────────────────────────────
    var orderPayload = {
        status:        'delivered',
        delivered_at:  ts,
        receiver_name: receiverName,
        pod_status:    podStatus,
        pod_mode:      mode
    };
    if (photoUrl)     orderPayload.photo_url     = photoUrl;
    if (signatureUrl) orderPayload.signature_url = signatureUrl;
    if (note)         orderPayload.instructions  = note;

    var { error: orderErr } = await client
        .from('transport_orders_simple')
        .update(orderPayload)
        .eq('id', missionId);

    if (orderErr) return { ok: false, error: orderErr.message };

    // ── Save to deliveries table ──────────────────────────────────────────────
    var record = {
        order_id:         missionId,
        driver_id:        driverId,
        delivered_at:     ts,
        receiver_name:    receiverName,
        has_signature:    hasSig,
        signature_data:   sigB64Fallback,
        signature_url:    signatureUrl,
        photo_data:       photoB64,
        photo_url:        photoUrl,
        pod_status:       podStatus,
        pod_mode:         mode,
        note_livraison:   note || null,
        gps_lat:          gpsLat,
        gps_lng:          gpsLng,
        created_at:       ts
    };

    try {
        var { error: de } = await client
            .from('deliveries')
            .upsert([record], { onConflict: 'order_id' });
        if (de) await client.from('deliveries').insert([record]);
    } catch(_) {}

    return { ok: true, photoUrl: photoUrl, signatureUrl: signatureUrl, podStatus: podStatus };
}

// ── fetchPOD ──────────────────────────────────────────────────────────────────
// Retrieve POD data for a mission (used by dispatch).

async function fetchPOD(missionId) {
    var client = db();
    if (!client || !missionId) return null;
    var r = await client
        .from('deliveries')
        .select('receiver_name, delivered_at, has_signature, photo_url, signature_url, signature_data, photo_data, pod_status, pod_mode, note_livraison, gps_lat, gps_lng')
        .eq('order_id', missionId)
        .maybeSingle();
    return r.data || null;
}

// ── getSignedUrl ──────────────────────────────────────────────────────────────
// Get a short-lived signed URL for a private storage file (1 hour).

async function getSignedUrl(fullUrlOrPath) {
    var client = db();
    if (!client || !fullUrlOrPath) return null;
    try {
        var path = fullUrlOrPath;
        var marker = '/object/public/' + BUCKET + '/';
        var idx = fullUrlOrPath.indexOf(marker);
        if (idx >= 0) path = fullUrlOrPath.slice(idx + marker.length);
        var r = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
        return (r.data && r.data.signedUrl) ? r.data.signedUrl : null;
    } catch(_) { return null; }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoPOD = {
    validateDelivery: validateDelivery,
    uploadToStorage:  uploadToStorage,
    fetchPOD:         fetchPOD,
    getSignedUrl:     getSignedUrl
};

})(window);
