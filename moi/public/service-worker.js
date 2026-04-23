// QMS Terminal Service Worker
// Enables offline functionality and background sync

const CACHE_VERSION = 'qms-terminal-v2';
const RUNTIME_CACHE = 'qms-runtime-v2';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/desk/qms_terminal',
  '/api/method/frappe.client.get_list?doctype=QMS%20Service',
];

// Install event - cache critical assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[Service Worker] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Some assets failed to cache:', err);
        // Continue even if some assets fail
        return Promise.resolve();
      });
    })
  );

  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_VERSION && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache first for assets
  if (shouldCacheAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network first with fallback to cache
  event.respondWith(networkFirstWithFallback(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  if (cached) {
    console.log('[Service Worker] Serving from cache:', request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[Service Worker] Fetch failed:', request.url, error);
    return caches.match('/app/qms-terminal');
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[Service Worker] Network failed:', request.url);
    const cache = await caches.open(RUNTIME_CACHE);
    return cache.match(request) || offlineResponse();
  }
}

// Network first with cache fallback
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.warn('[Service Worker] Network failed, trying cache:', request.url);
    return caches.match(request) || offlineResponse();
  }
}

// Determine if asset should be cached
function shouldCacheAsset(pathname) {
  return (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.woff2')
  );
}

// Offline response
function offlineResponse() {
  return new Response(
    `<html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>QMS Terminal - Offline</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 400px;
          }
          h1 { font-size: 32px; margin: 0 0 10px 0; }
          p { font-size: 16px; opacity: 0.9; line-height: 1.6; }
          .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <p style="font-size: 14px; margin-top: 20px; opacity: 0.7;">
            Your ticket will be saved and synced when you're back online.
          </p>
        </div>
      </body>
    </html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/html; charset=utf-8'
      })
    }
  );
}

// Background sync for offline tickets
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-tickets') {
    event.waitUntil(syncPendingTickets());
  }
});

async function syncPendingTickets() {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('pendingTickets', 'readonly');
    const store = tx.objectStore('pendingTickets');
    const pendingTickets = await store.getAll();

    console.log('[Service Worker] Syncing', pendingTickets.length, 'pending tickets');

    for (const ticket of pendingTickets) {
      try {
        const response = await fetch('/api/method/moi.api.qms.create_ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': frappe.csrf_token,
          },
          body: JSON.stringify(ticket)
        });

        if (response.ok) {
          // Remove from pending
          const writeTx = db.transaction('pendingTickets', 'readwrite');
          const writeStore = writeTx.objectStore('pendingTickets');
          await writeStore.delete(ticket.id);
          console.log('[Service Worker] Synced ticket:', ticket.id);
        }
      } catch (err) {
        console.error('[Service Worker] Failed to sync ticket:', ticket.id, err);
        // Will retry on next sync
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// IndexedDB helper
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QMSTerminal', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingTickets')) {
        db.createObjectStore('pendingTickets', { keyPath: 'id' });
      }
    };
  });
}

// Message handler for client-service worker communication
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] Loaded and ready');
