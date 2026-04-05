// ============================================================
//  Service Worker Colixo — notifications push
//  Pas de clients.claim() ici (évite InvalidStateError sur certains navigateurs).
//  Pas de handler fetch vide (avertissement Chrome « no-op »).
// ============================================================

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        })
    );
});

self.addEventListener('push', function (event) {
    var title = 'Colixo';
    var body = '';
    var payload = {};
    try {
        if (event.data) {
            payload = event.data.json();
            title = payload.title || title;
            body = payload.body || '';
        }
    } catch (e) {
        body = event.data ? String(event.data.text()) : '';
    }
    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            data: payload.data || {},
            tag: payload.tag || 'colixo-push'
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length) {
                var c = clientList[0];
                if ('focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
