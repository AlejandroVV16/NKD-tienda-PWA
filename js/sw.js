const CACHE_NAME = 'nkd-pereira-v1.0.0';
const STATIC_CACHE = 'nkd-static-v1.0.0';
const DYNAMIC_CACHE = 'nkd-dynamic-v1.0.0';

// Recursos estáticos para cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/carrito.html',
  '/css/main.css',
  '/js/main.js',
  '/js/carrito.js',
  '/js/menu.js',
  '/js/productos.json',
  '/js/db.js',
  '/js/pwa.js',
  '/manifest.json',
  '/img/logo/logo.png',
  // CDN resources
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.9.1/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
  'https://cdn.jsdelivr.net/npm/toastify-js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Instalación completada');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error durante la instalación:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activación completada');
        return self.clients.claim();
      })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Estrategia para páginas HTML
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Estrategia para recursos estáticos
  if (STATIC_ASSETS.includes(request.url) || request.url.includes('/css/') || request.url.includes('/js/')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Estrategia para imágenes
  if (request.url.includes('/img/')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Estrategia para CDN
  if (url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Para todo lo demás, red primero
  event.respondWith(networkFirstStrategy(request));
});

// Estrategia: Cache primero
async function cacheFirstStrategy(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Sirviendo desde cache:', request.url);
      return cachedResponse;
    }

    console.log('Service Worker: Obteniendo de red:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Error en cache first:', error);
    
    // Página offline para navegación
    if (request.mode === 'navigate') {
      return await caches.match('/offline.html') || new Response('Aplicación offline', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// Estrategia: Red primero
async function networkFirstStrategy(request) {
  try {
    console.log('Service Worker: Intentando red primero:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Red falló, buscando en cache:', request.url);
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // Buscar en cache estático
    const staticCache = await caches.open(STATIC_CACHE);
    const staticCachedResponse = await staticCache.match(request);
    
    if (staticCachedResponse) {
      return staticCachedResponse;
    }

    // Página offline para navegación
    if (request.mode === 'navigate') {
      return await caches.match('/offline.html') || new Response(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>NKD Pereira - Offline</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
            .offline-container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            h1 { color: #ff0000; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 20px; }
            .retry-btn { background: #ff0000; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <h1>🚫 Sin Conexión</h1>
            <p>No hay conexión a internet. Algunas funciones pueden estar limitadas.</p>
            <button class="retry-btn" onclick="window.location.reload()">Intentar de nuevo</button>
          </div>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// Manejar mensajes del cliente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Ejecutando sincronización en segundo plano');
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    // Aquí puedes sincronizar datos cuando haya conexión
    console.log('Service Worker: Sincronizando datos...');
    
    // Ejemplo: sincronizar carritos pendientes, etc.
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      console.log('Service Worker: Sincronización completada');
    }
  } catch (error) {
    console.error('Service Worker: Error en sincronización:', error);
  }
}

// Manejar notificaciones push (opcional)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nueva actualización disponible',
      icon: '/img/icons/icon-192x192.png',
      badge: '/img/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: 'Ver',
          icon: '/img/icons/view-icon.png'
        },
        {
          action: 'close',
          title: 'Cerrar',
          icon: '/img/icons/close-icon.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'NKD Pereira', options)
    );
  }
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});