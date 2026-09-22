const CACHE_NAME = 'guineexpress-v2';
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

// --- LÓGICA DE CACHE (Já existia) ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// --- LÓGICA DE CACHE BLINDADA PARA XIAOMI E ANDROID ---
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request).then(response => {
                    // 1. Se achou no cache, retorna o arquivo salvo
                    if (response) {
                        return response;
                    }
                    // 2. Se for uma requisição de página, joga para o Início
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    // 3. SE NÃO ACHAR NADA, cria uma resposta "falsa" para não travar o app
                    return new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
    );
});
// --- NOVO: LÓGICA DE NOTIFICAÇÃO PUSH (Estilo Shein) ---
self.addEventListener('push', function(event) {
    let data = {};
    if (event.data) {
        data = event.data.json();
    }

    const options = {
        body: data.body || 'Novidade na Guineexpress!',
        icon: data.icon || '/logo.png', // Ícone da sua empresa
        badge: data.badge || '/logo.png', // Ícone pequeno da barra
        vibrate: [200, 100, 200],
        data: { url: data.url || '/dashboard-client.html' } 
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Guineexpress', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});