const CACHE_NAME = 'hinario-v1.0.0';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './favicon.svg',
    './icon-192.png',
    './icon-512.png',
    './src/index.css',
    './src/app.js',
    './src/assets/elements/back.svg',
    './src/assets/elements/check.svg',
    './src/assets/elements/gear.svg',
    './src/assets/elements/playlist.svg',
    './src/assets/elements/report_a_bug.svg',
    './src/assets/elements/search.svg',
    './src/assets/elements/spotify.svg',
    './src/assets/elements/title.svg',
    './src/assets/elements/trash.svg',
    './src/assets/elements/yt_music.svg',
    './src/assets/font/Montserrat/Montserrat-Black.ttf',
    './src/assets/font/Montserrat/Montserrat-SemiBold.ttf',
    './src/assets/font/Montserrat/Montserrat-Italic.ttf'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                urlsToCache.map(url => cache.add(url).catch(err => {
                    console.warn('Falha no pré-cache de:', url, err);
                }))
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./') || caches.match('./index.html');
                    }
                });

            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
