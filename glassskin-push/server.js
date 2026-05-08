// ══════════════════════════════════════════
//  GLASS SKIN BEAUTY — Push Server v2
//  Notifiche: clienti + amministratore
//  Avvio: node server.js  |  Porta: 3000
// ══════════════════════════════════════════

const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');
const path     = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ── VAPID KEYS ──
const VAPID_PUBLIC  = 'BFTjj7BQx_HZ-j1ZyktpoHmHUmOdAWmKqDi5X6ajCBzpLkAruB0Eb0adC7d_bHu_iw3Mt93UNpRQQuMMJrG7h7w';
const VAPID_PRIVATE = 'cD4yuAsqgf9QWNOiPms1V6LFouNEyLbglRsKENTMrD0';

webpush.setVapidDetails('mailto:kazak@glasskinbeauty.it', VAPID_PUBLIC, VAPID_PRIVATE);

// ── STORAGE ──
const subscriptions = new Map();  // clientId → { subscription, clientName, isAdmin }
let   adminSub      = null;       // subscription dedicata admin

// ── HELPER: invia push sicuro ──
async function safePush(sub, payload) {
  try {
    await webpush.sendNotification(sub, payload);
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.error('[Push] Errore:', err.message);
    return false;
  }
}

// ════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════

// GET /vapid-public-key
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// ── SUBSCRIBE CLIENTE ──
app.post('/subscribe', (req, res) => {
  const { subscription, clientId, clientName } = req.body;
  if (!subscription || !clientId) return res.status(400).json({ error: 'Dati mancanti' });
  subscriptions.set(clientId, { subscription, clientName: clientName || 'Cliente', isAdmin: false });
  console.log(`✅ Cliente iscritto: ${clientName || clientId} (totale: ${subscriptions.size})`);
  res.json({ ok: true });
});

// ── SUBSCRIBE ADMIN ──
// L'admin si iscrive con un endpoint dedicato
app.post('/subscribe/admin', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription mancante' });
  adminSub = subscription;
  console.log('🔐 Admin iscritto alle notifiche push');
  res.json({ ok: true, message: 'Admin notifiche attivate' });
});

// ── UNSUBSCRIBE CLIENTE ──
app.post('/unsubscribe', (req, res) => {
  const { clientId } = req.body;
  subscriptions.delete(clientId);
  res.json({ ok: true });
});

// ── UNSUBSCRIBE ADMIN ──
app.post('/unsubscribe/admin', (req, res) => {
  adminSub = null;
  console.log('Admin disiscritto');
  res.json({ ok: true });
});

// ── NOTIFY: nuova prenotazione → cliente + admin ──
app.post('/notify/booking', async (req, res) => {
  const { clientId, service, date, time, clientName } = req.body;

  const results = { client: null, admin: null };

  // 1. Notifica CLIENTE
  const clientData = subscriptions.get(clientId);
  if (clientData) {
    const clientPayload = JSON.stringify({
      title: '✓ Prenotazione Confermata!',
      body:  `${service} — ${date} alle ${time} 🌸`,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   'booking-confirm',
      data:  { url: '/index.html#appointments' }
    });
    results.client = await safePush(clientData.subscription, clientPayload);
    if (results.client === 'expired') subscriptions.delete(clientId);
    console.log(`📲 Push cliente → ${clientData.clientName}: ${results.client}`);
  }

  // 2. Notifica ADMIN
  if (adminSub) {
    const adminPayload = JSON.stringify({
      title: '📅 Nuova Prenotazione!',
      body:  `${clientName || 'Cliente'} → ${service} · ${date} alle ${time}`,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   'admin-booking',
      data:  { url: '/index.html#admin-agenda' }
    });
    results.admin = await safePush(adminSub, adminPayload);
    if (results.admin === 'expired') adminSub = null;
    console.log(`🔐 Push admin → nuova prenotazione: ${results.admin}`);
  } else {
    console.log('⚠️  Admin non iscritto alle push');
  }

  res.json({ ok: true, results });
});

// ── NOTIFY: annullamento → cliente + admin ──
app.post('/notify/cancellation', async (req, res) => {
  const { clientId, service, date, clientName } = req.body;
  const results = { client: null, admin: null };

  // Cliente
  const clientData = subscriptions.get(clientId);
  if (clientData) {
    const payload = JSON.stringify({
      title: '❌ Appuntamento Annullato',
      body:  `${service} del ${date} è stato annullato. Riprenota quando vuoi!`,
      icon:  '/icons/icon-192.png',
      tag:   'cancellation',
      data:  { url: '/index.html#booking' }
    });
    results.client = await safePush(clientData.subscription, payload);
    if (results.client === 'expired') subscriptions.delete(clientId);
  }

  // Admin
  if (adminSub) {
    const adminPayload = JSON.stringify({
      title: '❌ Prenotazione Annullata',
      body:  `${clientName || 'Cliente'} ha annullato ${service} del ${date}`,
      icon:  '/icons/icon-192.png',
      tag:   'admin-cancellation',
      data:  { url: '/index.html#admin-agenda' }
    });
    results.admin = await safePush(adminSub, adminPayload);
    if (results.admin === 'expired') adminSub = null;
  }

  res.json({ ok: true, results });
});

// ── NOTIFY: modifica appuntamento → cliente + admin ──
app.post('/notify/edit', async (req, res) => {
  const { clientId, service, date, newTime, oldTime, clientName } = req.body;
  const results = { client: null, admin: null };

  // Cliente
  const clientData = subscriptions.get(clientId);
  if (clientData) {
    const payload = JSON.stringify({
      title: '✏️ Appuntamento Modificato',
      body:  `${service} spostato: ${oldTime} → ${newTime} (${date})`,
      icon:  '/icons/icon-192.png',
      tag:   'edit',
      data:  { url: '/index.html#appointments' }
    });
    results.client = await safePush(clientData.subscription, payload);
  }

  // Admin
  if (adminSub) {
    const adminPayload = JSON.stringify({
      title: '✏️ Appuntamento Modificato',
      body:  `${clientName || 'Cliente'} → ${service}: ${oldTime} → ${newTime}`,
      icon:  '/icons/icon-192.png',
      tag:   'admin-edit',
      data:  { url: '/index.html#admin-agenda' }
    });
    results.admin = await safePush(adminSub, adminPayload);
  }

  res.json({ ok: true, results });
});

// ── NOTIFY: promemoria 24h ──
app.post('/notify/reminder', async (req, res) => {
  const { clientId, service, time } = req.body;
  const sub = subscriptions.get(clientId);
  if (!sub) return res.status(404).json({ error: 'Subscription non trovata' });

  const payload = JSON.stringify({
    title: '🕐 Promemoria Appuntamento',
    body:  `Domani: ${service} alle ${time}. Ti aspettiamo! 💆`,
    icon:  '/icons/icon-192.png',
    tag:   'reminder',
    data:  { url: '/index.html#appointments' }
  });
  const result = await safePush(sub.subscription, payload);
  if (result === 'expired') subscriptions.delete(clientId);
  res.json({ ok: true, result });
});

// ── NOTIFY: promozione a TUTTI i clienti ──
app.post('/notify/promo', async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({
    title: title || '✨ Nuova Promozione Glass Skin',
    body:  body  || 'Scopri le offerte del mese! 🌸',
    icon:  '/icons/icon-192.png',
    tag:   'promo',
    data:  { url: '/index.html#home' }
  });

  const results = [];
  for (const [id, { subscription, clientName }] of subscriptions) {
    const r = await safePush(subscription, payload);
    if (r === 'expired') subscriptions.delete(id);
    results.push({ id, clientName, ok: r === true });
  }
  console.log(`📢 Promo → ${results.filter(r=>r.ok).length}/${results.length} clienti`);
  res.json({ ok: true, results });
});

// ── CHECK: stato subscriptions ──
app.get('/admin/subscriptions', (req, res) => {
  res.json({
    total: subscriptions.size,
    adminSubscribed: !!adminSub,
    clients: [...subscriptions.entries()].map(([id,{clientName}]) => ({ clientId:id, clientName }))
  });
});

// ── HEALTH CHECK ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: subscriptions.size,
    adminSubscribed: !!adminSub
  });
});

// ── START ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Glass Skin Beauty — Push Server v2`);
  console.log(`   Running → http://localhost:${PORT}`);
  console.log(`   VAPID configurato ✓`);
  console.log(`   Endpoint admin: POST /subscribe/admin\n`);
