/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — Service Worker v8
   Background sync + Keep-alive + Push
   ══════════════════════════════════════════ */

const CACHE   = 'gsb-v8';
const SERVER  = 'https://glass-skin-beauty-production.up.railway.app';
const ASSETS  = ['/index.html', '/sw.js'];

// ── INSTALL ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      self.clients.claim();
      // Avvia keep-alive al primo avvio
      startKeepAlive();
    })
  );
});

// ── FETCH ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/notify/') ||
      e.request.url.includes('/subscribe') ||
      e.request.url.includes('/appointments') ||
      e.request.url.includes('/vapid') ||
      e.request.url.includes('/health') ||
      e.request.url.includes('/unsubscribe')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ══════════════════════════════════════════
//  KEEP-ALIVE — mantiene SW attivo in background
// ══════════════════════════════════════════
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  // Ping al server ogni 25 secondi per mantenere attivo
  keepAliveInterval = setInterval(async () => {
    try {
      await fetch(SERVER + '/health', { method: 'GET' });
    } catch(e) { /* server non raggiungibile — normale offline */ }
  }, 25000);
  console.log('[SW] Keep-alive avviato');
}

// ── MESSAGE: comandi dall'app ──
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'KEEP_ALIVE_START') startKeepAlive();
  if (e.data.type === 'KEEP_ALIVE_STOP') {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
  }
  if (e.data.type === 'SYNC_NOW') {
    // Notifica tutte le finestre di sincronizzare
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'REFRESH_DATA' }));
    });
  }
});

// ══════════════════════════════════════════
//  BACKGROUND SYNC
// ══════════════════════════════════════════
self.addEventListener('sync', e => {
  if (e.tag === 'sync-appointments') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'REFRESH_DATA' }));
      })
    );
  }
});

// ── Sync periodico ogni 30 secondi (quando SW è attivo) ──
setInterval(() => {
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    if (clients.length > 0) {
      clients.forEach(c => c.postMessage({ type: 'REFRESH_DATA' }));
    }
  });
}, 30000);

// ══════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════
const ACTIONS = {
  'booking-confirm':    [{action:'view',title:'📅 Vedi appuntamento'},{action:'close',title:'✕ Chiudi'}],
  'reminder':           [{action:'view',title:'📍 Dettagli'},{action:'close',title:'✕ OK'}],
  'cancellation':       [{action:'view',title:'🔄 Riprenota'},{action:'close',title:'✕ OK'}],
  'edit':               [{action:'view',title:'📅 Vedi appuntamento'},{action:'close',title:'✕ OK'}],
  'promo':              [{action:'view',title:'✨ Scopri offerta'},{action:'close',title:'✕ Dopo'}],
  'admin-booking':      [{action:'view',title:'🗓️ Vedi agenda'},{action:'close',title:'✕ OK'}],
  'admin-cancellation': [{action:'view',title:'🗓️ Vedi agenda'},{action:'close',title:'✕ OK'}],
  'admin-edit':         [{action:'view',title:'🗓️ Vedi agenda'},{action:'close',title:'✕ OK'}],
};

self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title:'Glass Skin Beauty', body:e.data.text(), icon:'/icons/icon-192.png', tag:'gsb' }; }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:      data.body,
      icon:      data.icon  || '/icons/icon-192.png',
      badge:     data.badge || '/icons/icon-192.png',
      tag:       data.tag   || 'gsb',
      renotify:  true,
      vibrate:   [200, 100, 200],
      data:      data.data  || {},
      actions:   ACTIONS[data.tag] || [],
      timestamp: Date.now(),
    }).then(() => {
      // Dopo ogni push, aggiorna i dati in tutte le finestre aperte
      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'REFRESH_DATA' }));
      });
    })
  );
});

// ── CLICK NOTIFICA ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;

  const tag = e.notification.tag || '';
  let msgType = 'NAVIGATE';
  let msgData = { url: '/index.html' };

  if (tag.startsWith('admin-')) {
    msgType = 'ADMIN_NAVIGATE';
    msgData = { page: 'agenda' };
  } else if (['booking-confirm','edit','cancellation'].includes(tag)) {
    msgData = { url: '/index.html#appointments' };
  }

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes('glass-skin-beauty') && 'focus' in c) {
          c.postMessage({ type: msgType, ...msgData });
          return c.focus();
        }
      }
      const openUrl = tag.startsWith('admin-') ? '/index.html?open=admin' : '/index.html';
      if (clients.openWindow) return clients.openWindow(openUrl);
    })
  );
});
