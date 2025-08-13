// Service Worker for SwitchBot Auto Control PWA
const CACHE_NAME = 'switchbot-control-v1';
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/style.css',
    '/app.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install Event - Cache static assets
self.addEventListener('install', event => {
    console.log('SW: Install event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                // Take control immediately
                return self.skipWaiting();
            })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
    console.log('SW: Activate event');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Take control of all clients
                return self.clients.claim();
            })
    );
});

// Fetch Event - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API requests (handle them separately)
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    console.log('SW: Serving from cache:', event.request.url);
                    return response;
                }

                // Otherwise fetch from network
                console.log('SW: Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response for caching
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Return offline fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Background Sync (if supported)
self.addEventListener('sync', event => {
    console.log('SW: Background sync event:', event.tag);

    if (event.tag === 'location-sync') {
        event.waitUntil(
            // Handle background location sync
            syncLocationData()
        );
    }
});

// Push Notification Handler
self.addEventListener('push', event => {
    console.log('SW: Push event received');

    const options = {
        body: event.data ? event.data.text() : 'SwitchBot制御通知',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: '確認',
                icon: '/icons/icon-192x192.png'
            },
            {
                action: 'close',
                title: '閉じる',
                icon: '/icons/icon-192x192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('SwitchBot自動制御', options)
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
    console.log('SW: Notification click event');

    event.notification.close();

    if (event.action === 'explore') {
        // Open or focus the app
        event.waitUntil(
            clients.matchAll()
                .then(clientList => {
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});

// Helper function for background sync
async function syncLocationData() {
    try {
        // This would sync any pending location data
        // Implementation depends on specific requirements
        console.log('SW: Syncing location data in background');

        // Example: Send any cached location data to server
        const cache = await caches.open('location-data');
        // Process cached data...

        return Promise.resolve();
    } catch (error) {
        console.error('SW: Background sync failed:', error);
        return Promise.reject(error);
    }
}

// Message Handler (for communication with main thread)
self.addEventListener('message', event => {
    console.log('SW: Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Error Handler
self.addEventListener('error', event => {
    console.error('SW: Error occurred:', event.error);
});

// Unhandled Rejection Handler
self.addEventListener('unhandledrejection', event => {
    console.error('SW: Unhandled promise rejection:', event.reason);
    event.preventDefault();
});
