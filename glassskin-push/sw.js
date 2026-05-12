/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — Service Worker v7
   Fix: Response body already used error
   ══════════════════════════════════════════ */

const CACHE = 'gsb-v7';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/index.html','/sw.js']).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Non intercettare chiamate API
  if (e.request.url.includes('/notify/') ||
      e.request.url.includes('/subscribe') ||
      e.request.url.includes('/appointments') ||
      e.request.url.includes('/vapid') ||
      e.request.url.includes('/health') ||
      e.request.url.includes('/unsubscribe')) return;

  // Solo GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Clona PRIMA di usare — fix "body already used"
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── PUSH ──
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
  catch { data = {title:'Glass Skin Beauty',body:e.data.text(),icon:'/icons/icon-192.png',tag:'gsb'}; }
  e.waitUntil(self.registration.showNotification(data.title, {
    body:data.body, icon:data.icon||'/icons/icon-192.png',
    badge:data.badge||'/icons/icon-192.png',
    tag:data.tag||'gsb', renotify:true,
    vibrate:[200,100,200], data:data.data||{},
    actions:ACTIONS[data.tag]||[], timestamp:Date.now(),
  }));
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
    msgType = 'NAVIGATE';
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
