// ============================================================
//  push-manager.js — Gestion des notifications push
// ============================================================

const VAPID_PUBLIC_KEY = 'BOKiPuVJhpBqbIOH-5zjqUEFtx5VJ0HBHTtXrm5dIb-b7qDeJLXuEZph6wYgx1BCQ6qe-dGDyrRATUar4QS-lgg';

// ── Désinscrire l'ancien SW et réinscrire le nouveau ──
async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        // Désinscrire TOUS les anciens SW
        const regs = await navigator.serviceWorker.getRegistrations();
        for(const reg of regs) {
            await reg.unregister();
            console.log('[Push] Ancien SW désinscrit:', reg.scope);
        }
        // Réinscrire le nouveau
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[Push] Nouveau SW enregistré:', reg.scope);
        return reg;
    } catch(e) {
        console.error('[Push] Erreur SW:', e);
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function subscribePush(userId) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const reg = await registerSW();
    if (!reg) return null;

    try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        if (window.SUPABASE_CLIENT && userId) {
            await window.SUPABASE_CLIENT.from('push_subscriptions').upsert([{
                user_id:    userId,
                endpoint:   sub.endpoint,
                p256dh:     btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                auth:       btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
                updated_at: new Date().toISOString()
            }], { onConflict: 'user_id' });
        }
        return sub;
    } catch(e) {
        console.error('[Push] Erreur abonnement:', e);
        return null;
    }
}

async function showLocalNotification(title, body, options = {}) {
    if(Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
        body,
        icon:    '/icon-192.png',
        badge:   '/icon-72.png',
        vibrate: [200, 100, 200],
        tag:     options.tag  || 'leman-notif',
        data:    options.data || {},
        requireInteraction: options.requireInteraction || false
    });
}

async function notifyDriver(driverId, title, body, data = {}) {
    if (!window.SUPABASE_CLIENT) return;
    try {
        await window.SUPABASE_CLIENT.from('notifications').insert([{
            user_id:    driverId,
            title, body,
            data:       JSON.stringify(data),
            read:       false,
            created_at: new Date().toISOString()
        }]);
    } catch(e) {
        console.error('[Push] Erreur envoi:', e);
    }
}

// Désinscrire automatiquement au chargement si ancien SW présent
(async function autoCleanSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for(const reg of regs) {
            // Si l'ancien SW sert des fichiers HTML (ancien comportement)
            const sw = reg.active || reg.installing || reg.waiting;
            if(sw) {
                // Forcer mise à jour
                await reg.update();
            }
        }
    } catch(e) {}
})();

window.LémanPush = { registerSW, subscribePush, showLocalNotification, notifyDriver };
