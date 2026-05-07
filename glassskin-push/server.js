// ══════════════════════════════════════════
//  GLASS SKIN BEAUTY — Push Notification Server
//  Avvio: node server.js
//  Porta: 3000
// ══════════════════════════════════════════

const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');
const path     = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));   // serve la PWA

// ── VAPID KEYS (generate una volta sola) ──
const VAPID_PUBLIC  = 'BFTjj7BQx_HZ-j1ZyktpoHmHUmOdAWmKqDi5X6ajCBzpLkAruB0Eb0adC7d_bHu_iw3Mt93UNpRQQuMMJrG7h7w';
const VAPID_PRIVATE = 'cD4yuAsqgf9QWNOiPms1V6LFouNEyLbglRsKENTMrD0';

webpush.setVapidDetails(
  'mailto:kazak@glasskinbeauty.it',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// ── IN-MEMORY SUBSCRIPTIONS (in prod: usa un DB) ──
const subscriptions = new Map();   // clientId → PushSubscription

// ════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════

// GET  /vapid-public-key  → fornisce la chiave pubblica al client
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /subscribe  → salva la subscription del dispositivo
app.post('/subscribe', (req, res) => {
  const { subscription, clientId, clientName } = req.body;
  if (!subscription || !clientId) {
    return res.status(400).json({ error: 'subscription e clientId richiesti' });
  }
  subscriptions.set(clientId, { subscription, clientName: clientName || 'Cliente' });
  console.log(`✅ Subscribed: ${clientName || clientId} (totale: ${subscriptions.size})`);
  res.json({ ok: true, message: 'Iscritto alle notifiche push!' });
});

// POST /unsubscribe  → rimuove la subscription
app.post('/unsubscribe', (req, res) => {
  const { clientId } = req.body;
  subscriptions.delete(clientId);
  res.json({ ok: true });
});

// POST /notify/booking  → notifica CLIENTE di conferma prenotazione
app.post('/notify/booking', async (req, res) => {
  const { clientId, service, date, time } = req.body;
  const sub = subscriptions.get(clientId);
  if (!sub) return res.status(404).json({ error: 'Subscription non trovata' });

  const payload = JSON.stringify({
    title: '✓ Prenotazione Confermata!',
    body:  `${service} — ${date} alle ${time} 🌸`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   'booking-confirm',
    data:  { url: '/index.html#appointments' }
  });

  try {
    await webpush.sendNotification(sub.subscription, payload);
    console.log(`📲 Notifica prenotazione → ${sub.clientName}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Push error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /notify/reminder  → promemoria 24h prima (chiama da cron job)
app.post('/notify/reminder', async (req, res) => {
  const { clientId, service, time } = req.body;
  const sub = subscriptions.get(clientId);
  if (!sub) return res.status(404).json({ error: 'Subscription non trovata' });

  const payload = JSON.stringify({
    title: '🕐 Promemoria Appuntamento',
    body:  `Domani: ${service} alle ${time}. Ti aspettiamo! 💆`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   'reminder',
    data:  { url: '/index.html#appointments' }
  });

  try {
    await webpush.sendNotification(sub.subscription, payload);
    console.log(`⏰ Reminder → ${sub.clientName}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notify/promo  → notifica promozione a TUTTI i clienti iscritti
app.post('/notify/promo', async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({
    title: title || '✨ Nuova Promozione Glass Skin',
    body:  body  || 'Scopri le offerte del mese! 🌸',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   'promo',
    data:  { url: '/index.html#home' }
  });

  const results = [];
  for (const [id, { subscription, clientName }] of subscriptions) {
    try {
      await webpush.sendNotification(subscription, payload);
      results.push({ id, clientName, ok: true });
    } catch (err) {
      // subscription scaduta → rimuovila
      if (err.statusCode === 410) subscriptions.delete(id);
      results.push({ id, clientName, ok: false, error: err.message });
    }
  }
  console.log(`📢 Promo inviata a ${results.filter(r=>r.ok).length}/${subscriptions.size} clienti`);
  res.json({ ok: true, results });
});

// POST /notify/cancellation  → notifica annullamento
app.post('/notify/cancellation', async (req, res) => {
  const { clientId, service, date } = req.body;
  const sub = subscriptions.get(clientId);
  if (!sub) return res.status(404).json({ error: 'Subscription non trovata' });

  const payload = JSON.stringify({
    title: '❌ Appuntamento Annullato',
    body:  `${service} del ${date} è stato annullato. Riprenota quando vuoi!`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   'cancellation',
    data:  { url: '/index.html#booking' }
  });

  try {
    await webpush.sendNotification(sub.subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/subscriptions  → pannello admin: vedi chi è iscritto
app.get('/admin/subscriptions', (req, res) => {
  const list = [...subscriptions.entries()].map(([id, { clientName }]) => ({
    clientId: id, clientName
  }));
  res.json({ total: subscriptions.size, clients: list });
});

// ════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Glass Skin Beauty — Push Server`);
  console.log(`   Running → http://localhost:${PORT}`);
  console.log(`   VAPID Public Key configurata ✓\n`);
});
