const CACHE_NAME = 'guineexpress-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard-client.html',
  '/dashboard-employee.html',
  '/dashboard-admin.html',
  '/style.css',
  '/cici.css',
  '/script.js',
  '/cici.js',
  '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});