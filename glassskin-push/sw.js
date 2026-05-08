/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — Service Worker v4
   Cache + Push notifications (cliente + admin)
   ══════════════════════════════════════════ */

const CACHE  = 'gsb-v5';
const ASSETS = ['./', './index.html', './js/app.js', './js/push.js', './manifest.json'];

// ── INSTALL ──
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

// ── ACTIVATE: pulisce cache vecchie ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: serve da cache se offline ──
self.addEventListener('fetch', e => {
  if (
    e.request.url.includes('/notify/') ||
    e.request.url.includes('/subscribe') ||
    e.request.url.includes('/vapid') ||
    e.request.url.includes('/health') ||
    e.request.url.includes('/unsubscribe')
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ══════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════

// Azioni per tipo di notifica
const ACTIONS = {
  // Lato CLIENTE
  'booking-confirm': [
    { action: 'view',  title: '📅 Vedi appuntamento' },
    { action: 'close', title: '✕ Chiudi' }
  ],
  'reminder': [
    { action: 'view',  title: '📍 Dettagli' },
    { action: 'close', title: '✕ OK' }
  ],
  'cancellation': [
    { action: 'view',  title: '🔄 Riprenota' },
    { action: 'close', title: '✕ OK' }
  ],
  'edit': [
    { action: 'view',  title: '📅 Vedi appuntamento' },
    { action: 'close', title: '✕ OK' }
  ],
  'promo': [
    { action: 'view',  title: '✨ Scopri offerta' },
    { action: 'close', title: '✕ Dopo' }
  ],
  // Lato ADMIN
  'admin-booking': [
    { action: 'view',  title: '🗓️ Vedi agenda' },
    { action: 'close', title: '✕ OK' }
  ],
  'admin-cancellation': [
    { action: 'view',  title: '🗓️ Vedi agenda' },
    { action: 'close', title: '✕ OK' }
  ],
  'admin-edit': [
    { action: 'view',  title: '🗓️ Vedi agenda' },
    { action: 'close', title: '✕ OK' }
  ],
};

// Ricezione push dal server
self.addEventListener('push', e => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = {
      title: 'Glass Skin Beauty',
      body:  e.data.text(),
      icon:  '/icons/icon-192.png',
      tag:   'gsb-generic'
    };
  }

  const options = {
    body:     data.body,
    icon:     data.icon  || '/icons/icon-192.png',
    badge:    data.badge || '/icons/icon-192.png',
    tag:      data.tag   || 'gsb',
    renotify: true,
    vibrate:  [200, 100, 200, 100, 200],
    data:     data.data  || {},
    actions:  ACTIONS[data.tag] || [],
    // Mostra timestamp
    timestamp: Date.now(),
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click su notifica → apre l'app alla pagina giusta
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;

  // URL di destinazione dalla notifica
  const url = (e.notification.data && e.notification.data.url)
    ? e.notification.data.url
    : '/index.html';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Se l'app è già aperta → portala in primo piano e naviga
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url });
          return client.focus();
        }
      }
      // Altrimenti apri nuova finestra
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Notifica chiusa dall'utente
self.addEventListener('notificationclose', e => {
  console.log('[SW] Notifica chiusa:', e.notification.tag);
});
