const CACHE_NAME = 'hinario-v32';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './songs.js',
    './manifest.json',
    './font/Montserrat-Black.ttf',
    './font/Montserrat-Medium.ttf'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) return;
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                // Atualiza o cache com a resposta fresca
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => {
                // Se offline, usa o cache
                return caches.match(event.request).then(r => r || caches.match('./index.html'));
            })
    );
});

self.addEventListener('activate', event => {
    const cacheAllowlist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
