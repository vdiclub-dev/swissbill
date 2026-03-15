// ============================================================
//  sw.js — Service Worker Léman Driver
//  À placer à la RACINE du site (même niveau que index.html)
// ============================================================

const CACHE_NAME = 'leman-driver-v1';
const VAPID_PUBLIC_KEY = 'BOKiPuVJhpBqbIOH-5zjqUEFtx5VJ0HBHTtXrm5dIb-b7qDeJLXuEZph6wYgx1BCQ6qe-dGDyrRATUar4QS-lgg';

// ── Installation ──
self.addEventListener('install', e => {
    console.log('[SW] Installé');
    self.skipWaiting();
});

// ── Activation ──
self.addEventListener('activate', e => {
    console.log('[SW] Activé');
    e.waitUntil(clients.claim());
});

// ── Push Notification reçue ──
self.addEventListener('push', e => {
    console.log('[SW] Push reçu:', e.data?.text());

    let data = { title: 'Léman Driver', body: 'Nouvelle notification', icon: '/icon-192.png', badge: '/icon-72.png', tag: 'leman-notif', data: {} };

    try {
        if (e.data) data = { ...data, ...JSON.parse(e.data.text()) };
    } catch(err) {
        if (e.data) data.body = e.data.text();
    }

    const options = {
        body:    data.body,
        icon:    data.icon   || '/icon-192.png',
        badge:   data.badge  || '/icon-72.png',
        tag:     data.tag    || 'leman-notif',
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction || false,
        data:    data.data   || {},
        actions: data.actions || [
            { action: 'open',    title: '📱 Ouvrir l\'app' },
            { action: 'dismiss', title: 'Ignorer' }
        ]
    };

    e.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ── Clic sur notification ──
self.addEventListener('notificationclick', e => {
    console.log('[SW] Notification cliquée:', e.action);
    e.notification.close();

    if (e.action === 'dismiss') return;

    const urlToOpen = e.notification.data?.url || '/admin/driver-app.html';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Si l'app est déjà ouverte, la focus
            for (const client of clientList) {
                if (client.url.includes('driver-app') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Sinon ouvrir une nouvelle fenêtre
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// ── Message depuis l'app ──
self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (e.data?.type === 'PING') {
        e.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
    }
});
