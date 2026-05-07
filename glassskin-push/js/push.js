const SERVER_URL = 'https://glass-skin-beauty-production.up.railway.app';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function getClientId() {
  let id = localStorage.getItem('gsb_client_id');
  if (!id) {
    id = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('gsb_client_id', id);
  }
  return id;
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function subscribeToPush(clientName) {
  if (!isPushSupported()) {
    showToast('Il tuo browser non supporta le notifiche push', 'warn');
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('Notifiche bloccate. Abilitale nelle impostazioni.', 'warn');
    return null;
  }
  try {
    const keyRes = await fetch(SERVER_URL + '/vapid-public-key');
    const keyData = await keyRes.json();
    const appKey = urlBase64ToUint8Array(keyData.publicKey);
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey
    });
    const clientId = getClientId();
    const res = await fetch(SERVER_URL + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, clientId, clientName })
    });
    if (res.ok) {
      localStorage.setItem('gsb_push_enabled', 'true');
      showToast('🔔 Notifiche push attivate! 🌸', 'success');
      updateNotifButton(true);
      return subscription;
    }
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
  return null;
}

async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    const clientId = getClientId();
    await fetch(SERVER_URL + '/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    });
    localStorage.setItem('gsb_push_enabled', 'false');
    showToast('Notifiche push disattivate', 'info');
    updateNotifButton(false);
  } catch (err) {
    console.error('[Push] Errore:', err);
  }
}

async function checkPushStatus() {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const enabled = !!sub && localStorage.getItem('gsb_push_enabled') === 'true';
    updateNotifButton(enabled);
    return enabled;
  } catch { return false; }
}

async function notifyBookingConfirmed(service, date, time) {
  if (localStorage.getItem('gsb_push_enabled') !== 'true') return;
  try {
    await fetch(SERVER_URL + '/notify/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: getClientId(), service, date, time })
    });
  } catch (err) {
    showLocalNotification('✓ Prenotazione Confermata!', service + ' — ' + date + ' alle ' + time);
  }
}

async function scheduleReminder(service, time, msUntilReminder) {
  if (localStorage.getItem('gsb_push_enabled') !== 'true') return;
  setTimeout(() => {
    showLocalNotification('🕐 Promemoria', 'Domani: ' + service + ' alle ' + time);
  }, Math.min(msUntilReminder, 2147483647));
}

function showLocalNotification(title, body) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200], tag: 'gsb-local-' + Date.now()
      });
    });
  }
}

function updateNotifButton(enabled) {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  if (enabled) {
    btn.textContent = '🔔 Notifiche Attive';
    btn.style.background = 'linear-gradient(135deg,#4a9a6a,#3d8060)';
  } else {
    btn.textContent = '🔕 Attiva Notifiche';
    btn.style.background = 'linear-gradient(135deg,var(--deep-rose),var(--copper))';
  }
}

function showToast(msg, type) {
  const existing = document.getElementById('gsb-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'gsb-toast';
  const colors = {
    success: 'linear-gradient(135deg,#4a9a6a,#3d8060)',
    warn: 'linear-gradient(135deg,#c4846a,#b07470)',
    error: 'linear-gradient(135deg,#c06060,#a04040)',
    info: 'linear-gradient(135deg,#8a6660,#6a4640)',
  };
  Object.assign(toast.style, {
    position:'fixed', bottom:'90px', left:'50%',
    transform:'translateX(-50%) translateY(20px)',
    background: colors[type] || colors.info,
    color:'white', padding:'12px 20px', borderRadius:'24px',
    fontSize:'0.8rem', fontFamily:"'Jost',sans-serif",
    boxShadow:'0 6px 24px rgba(0,0,0,0.2)',
    zIndex:'9999', maxWidth:'300px', textAlign:'center',
    letterSpacing:'0.04em', lineHeight:'1.4',
    transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', opacity:'0',
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', e => {
  if (e.data && e.data.type === 'NAVIGATE') {
    const hash = e.data.url.split('#')[1];
    if (hash) {
      const pageMap = { home:0, booking:1, appointments:2, chat:3, profile:4 };
      const idx = pageMap[hash];
      if (idx !== undefined) {
        const navBtns = document.querySelectorAll('.nav-item, .ni');
        if (navBtns[idx]) navBtns[idx].click();
      }
    }
  }
});

window.addEventListener('load', () => { setTimeout(checkPushStatus, 2000); });

window.GSBPush = {
  subscribe: subscribeToPush,
  unsubscribe: unsubscribeFromPush,
  notifyBooking: notifyBookingConfirmed,
  scheduleReminder,
  showToast,
  isEnabled: () => localStorage.getItem('gsb_push_enabled') === 'true'
};
