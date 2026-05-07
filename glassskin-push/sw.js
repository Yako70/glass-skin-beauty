/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — Service Worker v2
   Gestisce: cache offline + push notifications
   ══════════════════════════════════════════ */

const CACHE = 'gsb-v2';
const ASSETS = ['./', './index.html', './js/app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/notify/')||e.request.url.includes('/subscribe')||e.request.url.includes('/vapid')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res||res.status!==200||res.type!=='basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});

// ── PUSH: ricezione notifica dal server ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title:'Glass Skin Beauty', body:e.data.text(), icon:'/icons/icon-192.png' }; }

  const actions = {
    'booking-confirm': [{ action:'view', title:'📅 Vedi appuntamento' }, { action:'close', title:'✕ Chiudi' }],
    'reminder':        [{ action:'view', title:'📍 Dettagli' },           { action:'close', title:'✕ OK' }],
    'promo':           [{ action:'view', title:'✨ Scopri offerta' },      { action:'close', title:'✕ Dopo' }],
    'cancellation':    [{ action:'view', title:'🔄 Riprenota' },           { action:'close', title:'✕ OK' }],
  };

  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon  || '/icons/icon-192.png',
    badge: data.badge|| '/icons/icon-192.png',
    tag:  data.tag   || 'gsb',
    renotify: true,
    vibrate: [200,100,200],
    data: data.data  || {},
    actions: actions[data.tag] || []
  }));
});

// ── CLICK: apre l'app alla pagina corretta ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/index.html';
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') && 'focus' in c) {
          c.postMessage({type:'NAVIGATE', url});
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
