/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — Push Client v3
   Versione robusta — non blocca mai l'app
   ══════════════════════════════════════════ */

const SERVER_URL = 'https://glass-skin-beauty-production.up.railway.app';

// ─── Utilità VAPID ───────────────────────
function urlBase64ToUint8Array(b) {
  try {
    const pad = '='.repeat((4 - b.length % 4) % 4);
    const s   = (b + pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(s);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  } catch(e) { return null; }
}

// ─── ClientId ────────────────────────────
function getClientId() {
  let id = localStorage.getItem('gsb_client_id');
  if (!id) {
    id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    localStorage.setItem('gsb_client_id', id);
  }
  return id;
}

// ─── Supporto ────────────────────────────
function isPushOK() {
  return !!(navigator.serviceWorker && window.PushManager && window.Notification);
}

// ─── Check status — NON bloccante ────────
function checkPushStatus() {
  if (!isPushOK()) { updateNotifButton(false); return; }
  try {
    const enabled = localStorage.getItem('gsb_push_enabled') === 'true';
    updateNotifButton(enabled);
  } catch(e) { updateNotifButton(false); }
}

// ─── Subscribe Cliente ────────────────────
async function subscribeToPush(clientName) {
  if (!isPushOK()) { showToast('Browser non supporta le notifiche', 'warn'); return null; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('Notifiche bloccate nelle impostazioni', 'warn'); return null; }

    const keyRes  = await fetch(SERVER_URL + '/vapid-public-key');
    const keyData = await keyRes.json();
    const appKey  = urlBase64ToUint8Array(keyData.publicKey);
    if (!appKey) throw new Error('VAPID key non valida');

    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,r) => setTimeout(() => r(new Error('SW timeout')), 5000))
    ]);

    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });

    await fetch(SERVER_URL + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, clientId: getClientId(), clientName: clientName || 'Cliente' })
    });

    localStorage.setItem('gsb_push_enabled', 'true');
    showToast('🔔 Notifiche push attivate! 🌸', 'success');
    updateNotifButton(true);
    return sub;
  } catch(err) {
    console.warn('[Push] Subscribe:', err.message);
    showToast('Errore attivazione: ' + err.message, 'error');
    return null;
  }
}

// ─── Subscribe Admin ─────────────────────
async function subscribeAdminPush() {
  if (!isPushOK()) return null;
  if (localStorage.getItem('gsb_admin_push') === 'true') return true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    const keyRes  = await fetch(SERVER_URL + '/vapid-public-key');
    const keyData = await keyRes.json();
    const appKey  = urlBase64ToUint8Array(keyData.publicKey);
    if (!appKey) return null;

    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_,r) => setTimeout(() => r(new Error('SW timeout')), 5000))
    ]);

    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });

    const res = await fetch(SERVER_URL + '/subscribe/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });

    if (res.ok) {
      localStorage.setItem('gsb_admin_push', 'true');
      return sub;
    }
  } catch(err) {
    console.warn('[Push] Admin subscribe:', err.message);
  }
  return null;
}

// ─── Unsubscribe Cliente ──────────────────
async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(SERVER_URL + '/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: getClientId() })
    });
    localStorage.setItem('gsb_push_enabled', 'false');
    showToast('Notifiche disattivate', 'info');
    updateNotifButton(false);
  } catch(err) { console.warn('[Push] Unsubscribe:', err.message); }
}

// ─── Unsubscribe Admin ────────────────────
async function unsubscribeAdminPush() {
  try {
    await fetch(SERVER_URL + '/unsubscribe/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    localStorage.setItem('gsb_admin_push', 'false');
  } catch(err) { console.warn('[Push] Admin unsubscribe:', err.message); }
}

// ─── Notify Booking → cliente + admin ────
async function notifyBookingConfirmed(service, date, time, clientName) {
  try {
    await fetch(SERVER_URL + '/notify/booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: getClientId(), service, date, time, clientName })
    });
  } catch(err) {
    console.warn('[Push] Booking notify:', err.message);
    showLocalNotification('✓ Prenotazione Confermata!', service + ' — ' + date + ' alle ' + time);
  }
}

// ─── Notify Cancellation ─────────────────
async function notifyCancellation(service, date, clientName) {
  try {
    await fetch(SERVER_URL + '/notify/cancellation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: getClientId(), service, date, clientName })
    });
  } catch(err) { console.warn('[Push] Cancel notify:', err.message); }
}

// ─── Notify Edit ─────────────────────────
async function notifyEdit(service, date, newTime, oldTime, clientName) {
  try {
    await fetch(SERVER_URL + '/notify/edit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: getClientId(), service, date, newTime, oldTime, clientName })
    });
  } catch(err) { console.warn('[Push] Edit notify:', err.message); }
}

// ─── Reminder ────────────────────────────
function scheduleReminder(service, time, ms) {
  if (localStorage.getItem('gsb_push_enabled') !== 'true') return;
  setTimeout(() => showLocalNotification('🕐 Promemoria', 'Domani: ' + service + ' alle ' + time),
    Math.min(ms, 2147483647));
}

// ─── Notifica locale fallback ─────────────
function showLocalNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  try {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
        vibrate: [200,100,200], tag: 'gsb-' + Date.now()
      });
    });
  } catch(e) {}
}

// ─── UI ──────────────────────────────────
function updateNotifButton(enabled) {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  btn.textContent = enabled ? '🔔 Notifiche Attive' : '🔕 Attiva Notifiche Push';
  btn.style.background = enabled
    ? 'linear-gradient(135deg,#4a9a6a,#3d8060)'
    : 'linear-gradient(135deg,var(--deep),var(--copper))';
}

function showToast(msg, type) {
  const existing = document.getElementById('gsb-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'gsb-toast';
  const colors = { success:'linear-gradient(135deg,#4a9a6a,#3d8060)', warn:'linear-gradient(135deg,#c4846a,#b07470)', error:'linear-gradient(135deg,#c06060,#a04040)', info:'linear-gradient(135deg,#8a6660,#6a4640)' };
  Object.assign(t.style, {
    position:'fixed', bottom:'90px', left:'50%', transform:'translateX(-50%) translateY(20px)',
    background: colors[type] || colors.info, color:'white', padding:'11px 20px',
    borderRadius:'24px', fontSize:'0.78rem', fontFamily:"'Jost',sans-serif",
    boxShadow:'0 5px 20px rgba(0,0,0,0.2)', zIndex:'9999', maxWidth:'300px',
    textAlign:'center', letterSpacing:'0.04em', lineHeight:'1.4',
    transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', opacity:'0', pointerEvents:'none'
  });
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3200);
}

// ─── SW message ──────────────────────────
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'NAVIGATE') return;
    const hash = (e.data.url||'').split('#')[1];
    if (!hash) return;
    const map = { home:0, booking:1, appointments:2, chat:3, profile:4 };
    if (map[hash] !== undefined) {
      const btns = document.querySelectorAll('.ni');
      if (btns[map[hash]]) btns[map[hash]].click();
    }
  });
}

// ─── Init — NON bloccante ─────────────────
// Aspetta che tutto sia caricato prima di controllare lo stato push
window.addEventListener('load', () => {
  setTimeout(checkPushStatus, 3000); // ritardo maggiore — evita blocchi
});

// ─── API pubblica ─────────────────────────
window.GSBPush = {
  subscribe:        subscribeToPush,
  unsubscribe:      unsubscribeFromPush,
  notifyBooking:    notifyBookingConfirmed,
  notifyCancel:     notifyCancellation,
  notifyEdit:       notifyEdit,
  scheduleReminder,
  isEnabled:        () => localStorage.getItem('gsb_push_enabled') === 'true',
  subscribeAdmin:   subscribeAdminPush,
  unsubscribeAdmin: unsubscribeAdminPush,
  isAdminEnabled:   () => localStorage.getItem('gsb_admin_push') === 'true',
};
