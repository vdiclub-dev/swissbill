// ============================================================
//  sw.js — Service Worker Léman Driver v3
// ============================================================
const CACHE_NAME = 'leman-driver-v3';

// Installation
self.addEventListener('install', e => {
    console.log('[SW] Installé v3');
    self.skipWaiting();
});

// Activation — vider TOUS les anciens caches
self.addEventListener('activate', e => {
    console.log('[SW] Activé v3 — nettoyage caches');
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => {
                console.log('[SW] Suppression cache:', k);
                return caches.delete(k);
            })))
            .then(() => clients.claim())
    );
});

// Fetch — JAMAIS cacher les HTML, toujours réseau
self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);

    // Pages HTML = toujours réseau
    if (req.mode === 'navigate' ||
        req.destination === 'document' ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/') {
        e.respondWith(
            fetch(req, { cache: 'no-store' })
                .catch(() => new Response('Hors ligne', { status: 503 }))
        );
        return;
    }

    // Tout le reste = réseau d'abord
    e.respondWith(
        fetch(req).catch(() => caches.match(req))
    );
});

// Push notifications
self.addEventListener('push', e => {
    let data = { title: 'Léman Courses', body: 'Nouvelle notification' };
    try { if(e.data) data = { ...data, ...JSON.parse(e.data.text()) }; } catch(err) {}
    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            tag: 'leman-notif',
            vibrate: [200, 100, 200],
            data: data.data || {}
        })
    );
});

// Clic notification
self.addEventListener('notificationclick', e => {
    e.notification.close();
    if(e.action === 'dismiss') return;
    const url = e.notification.data?.url || '/admin/driver-app.html';
    e.waitUntil(
        clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
            for(const c of list) {
                if(c.url.includes('driver-app') && 'focus' in c) return c.focus();
            }
            if(clients.openWindow) return clients.openWindow(url);
        })
    );
});

self.addEventListener('message', e => {
    if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
