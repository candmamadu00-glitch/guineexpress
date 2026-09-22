// ==============================================================
// 1. ESCUTA A NOTIFICAÇÃO CHEGANDO DO SERVIDOR
// ==============================================================
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    
    const titulo = data.title || "Guineexpress";
    const opcoes = {
        body: data.body || "Você tem uma nova atualização!",
        icon: data.icon || '/logo.png', // Logo grande da notificação
        badge: data.badge || '/logo.png', // Ícone pequenininho na barra de cima
        vibrate: [200, 100, 200, 100, 200, 100, 200], // Faz o celular vibrar bem forte!
        data: { url: data.url || '/dashboard-client.html' } // Salva o link de destino
    };

    // Mostra a notificação na tela
    event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// ==============================================================
// 2. O QUE ACONTECE QUANDO O CLIENTE CLICA NA NOTIFICAÇÃO?
// ==============================================================
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Fecha o aviso da tela
    // Abre o site direto na página certa (fatura, box, vídeo)
    event.waitUntil(clients.openWindow(event.notification.data.url));
});