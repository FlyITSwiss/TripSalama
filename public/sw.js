/**
 * TripSalama - Service Worker
 * PWA avec cache stratégique et sync en arrière-plan
 */

const CACHE_NAME = 'tripsalama-v1';
const STATIC_CACHE = 'tripsalama-static-v1';
const DYNAMIC_CACHE = 'tripsalama-dynamic-v1';

// Ressources statiques à mettre en cache
const STATIC_ASSETS = [
    '/',
    '/offline.html',
    '/assets/css/tripsalama-design-system.css',
    '/assets/js/core/app-config.js',
    '/assets/js/core/api-service.js',
    '/assets/js/core/event-bus.js',
    '/assets/js/core/state-manager.js',
    '/assets/js/core/i18n.js',
    '/assets/js/core/geolocation-service.js',
    '/assets/js/core/tracking-service.js',
    '/assets/js/components/toast-notification.js',
    '/assets/js/components/modal.js',
    '/assets/lang/fr.json',
    '/assets/lang/en.json',
    '/assets/images/logo.svg',
    '/assets/manifest.json'
];

// URLs à toujours récupérer du réseau
const NETWORK_ONLY = [
    '/api/',
    '/login',
    '/logout',
    '/register'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('tripsalama-') &&
                                   name !== STATIC_CACHE &&
                                   name !== DYNAMIC_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ignorer les requêtes vers d'autres domaines
    if (url.origin !== location.origin) {
        return;
    }

    // Network only pour les APIs et auth
    if (NETWORK_ONLY.some(path => url.pathname.startsWith(path))) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Retourner une réponse d'erreur pour les APIs
                    if (url.pathname.startsWith('/api/')) {
                        return new Response(
                            JSON.stringify({ error: 'offline', message: 'Vous êtes hors ligne' }),
                            { status: 503, headers: { 'Content-Type': 'application/json' } }
                        );
                    }
                    return caches.match('/offline.html');
                })
        );
        return;
    }

    // Cache First pour les assets statiques
    if (isStaticAsset(url.pathname)) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        // Mettre à jour le cache en arrière-plan
                        fetchAndCache(event.request, STATIC_CACHE);
                        return response;
                    }
                    return fetchAndCache(event.request, STATIC_CACHE);
                })
        );
        return;
    }

    // Network First pour les pages HTML
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Mettre en cache les réponses réussies
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then((cache) => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then((response) => response || caches.match('/offline.html'));
            })
    );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === 'position-sync') {
        event.waitUntil(syncPendingPositions());
    }
});

// Notification push
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'TripSalama',
        body: 'Nouvelle notification',
        icon: '/assets/images/icons/icon-192x192.png',
        badge: '/assets/images/icons/badge-72x72.png',
        tag: 'tripsalama-notification'
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            vibrate: [200, 100, 200],
            data: data.data || {},
            actions: data.actions || []
        })
    );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Chercher une fenêtre existante
                for (const client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Ouvrir une nouvelle fenêtre
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// === FONCTIONS UTILITAIRES ===

function isStaticAsset(pathname) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.json'];
    return staticExtensions.some(ext => pathname.endsWith(ext)) ||
           pathname.startsWith('/assets/');
}

function fetchAndCache(request, cacheName) {
    return fetch(request)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const responseClone = response.clone();
            caches.open(cacheName)
                .then((cache) => cache.put(request, responseClone));
            return response;
        });
}

async function syncPendingPositions() {
    try {
        // Récupérer les positions en attente depuis IndexedDB ou localStorage
        const clients = await self.clients.matchAll();
        for (const client of clients) {
            client.postMessage({ type: 'SYNC_POSITIONS' });
        }
    } catch (error) {
        console.error('[SW] Failed to sync positions:', error);
    }
}

// Message depuis le client
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_URLS') {
        caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.addAll(event.data.urls));
    }
});
