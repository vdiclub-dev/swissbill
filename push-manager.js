// ============================================================
//  push-manager.js — Gestion des notifications push
//  À inclure dans driver-app.html et dashboard.html
// ============================================================

const VAPID_PUBLIC_KEY = 'BOKiPuVJhpBqbIOH-5zjqUEFtx5VJ0HBHTtXrm5dIb-b7qDeJLXuEZph6wYgx1BCQ6qe-dGDyrRATUar4QS-lgg';

// ── Convertir clé VAPID base64 → Uint8Array ──
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// ── Enregistrer le Service Worker ──
async function registerSW() {
    if (!('serviceWorker' in navigator)) {
        console.warn('[Push] Service Worker non supporté');
        return null;
    }
    try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[Push] SW enregistré:', reg.scope);
        return reg;
    } catch(e) {
        console.error('[Push] Erreur SW:', e);
        return null;
    }
}

// ── Demander permission + s'abonner ──
async function subscribePush(userId) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('[Push] Permission refusée');
        return null;
    }

    const reg = await registerSW();
    if (!reg) return null;

    try {
        // Vérifier si déjà abonné
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        console.log('[Push] Abonnement OK:', sub.endpoint.slice(0,50) + '...');

        // Sauvegarder l'abonnement dans Supabase
        if (window.SUPABASE_CLIENT && userId) {
            await window.SUPABASE_CLIENT.from('push_subscriptions').upsert([{
                user_id:      userId,
                endpoint:     sub.endpoint,
                p256dh:       btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                auth:         btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
                updated_at:   new Date().toISOString()
            }], { onConflict: 'user_id' });
        }

        return sub;
    } catch(e) {
        console.error('[Push] Erreur abonnement:', e);
        return null;
    }
}

// ── Afficher une notification locale (sans serveur) ──
async function showLocalNotification(title, body, options = {}) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
        body,
        icon:    '/icon-192.png',
        badge:   '/icon-72.png',
        vibrate: [200, 100, 200],
        tag:     options.tag     || 'leman-notif',
        data:    options.data    || {},
        requireInteraction: options.requireInteraction || false,
        actions: options.actions || [
            { action: 'open', title: '📱 Ouvrir' }
        ]
    });
}

// ── Notifier depuis le dispatch (côté admin) ──
// Utilise Supabase Realtime pour déclencher une notification locale
async function notifyDriver(driverId, title, body, data = {}) {
    if (!window.SUPABASE_CLIENT) return;
    try {
        // Insérer dans une table notifications pour trigger Realtime
        await window.SUPABASE_CLIENT.from('notifications').insert([{
            user_id:    driverId,
            title,
            body,
            data:       JSON.stringify(data),
            read:       false,
            created_at: new Date().toISOString()
        }]);
        console.log('[Push] Notification envoyée à', driverId);
    } catch(e) {
        console.error('[Push] Erreur envoi:', e);
    }
}

window.LémanPush = { registerSW, subscribePush, showLocalNotification, notifyDriver };
