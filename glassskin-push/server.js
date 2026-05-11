// ══════════════════════════════════════════
//  GLASS SKIN BEAUTY — Server v3
//  Gestisce: push + prenotazioni centralizzate
// ══════════════════════════════════════════

const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');
const path     = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ── VAPID ──
const VAPID_PUBLIC  = 'BFTjj7BQx_HZ-j1ZyktpoHmHUmOdAWmKqDi5X6ajCBzpLkAruB0Eb0adC7d_bHu_iw3Mt93UNpRQQuMMJrG7h7w';
const VAPID_PRIVATE = 'cD4yuAsqgf9QWNOiPms1V6LFouNEyLbglRsKENTMrD0';
webpush.setVapidDetails('mailto:kazak@glasskinbeauty.it', VAPID_PUBLIC, VAPID_PRIVATE);

// ── STORAGE IN MEMORIA ──
const subscriptions = new Map(); // clientId → subscription
let   adminSub      = null;
let   appointments  = [];        // ← PRENOTAZIONI CENTRALIZZATE

// ── HELPER PUSH ──
async function safePush(sub, payload) {
  try {
    await webpush.sendNotification(sub, payload);
    return true;
  } catch(err) {
    if(err.statusCode===410||err.statusCode===404) return 'expired';
    return false;
  }
}

// ════════════════════════════════════════
//  PRENOTAZIONI API
// ════════════════════════════════════════

// GET /appointments — tutti gli appuntamenti
app.get('/appointments', (req, res) => {
  res.json({ appointments });
});

// GET /appointments/client/:clientId — appuntamenti di un cliente
app.get('/appointments/client/:clientId', (req, res) => {
  const { clientId } = req.params;
  const clientAppts = appointments.filter(a => a.clientId === clientId);
  res.json({ appointments: clientAppts });
});

// POST /appointments — nuova prenotazione
app.post('/appointments', async (req, res) => {
  const { appointment, clientId } = req.body;
  if (!appointment) return res.status(400).json({ error: 'Dati mancanti' });

  const newAppt = {
    ...appointment,
    id: Date.now(),
    clientId: clientId || 'guest',
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };
  appointments.push(newAppt);
  console.log(`📅 Nuova prenotazione: ${newAppt.clientName} → ${newAppt.service} ${newAppt.slot}`);

  // Push al CLIENTE
  const clientSub = subscriptions.get(clientId);
  if (clientSub) {
    await safePush(clientSub.subscription, JSON.stringify({
      title: '✓ Prenotazione Confermata!',
      body:  `${newAppt.service} — ${newAppt.date} alle ${newAppt.slot} 🌸`,
      icon:  '/icons/icon-192.png',
      tag:   'booking-confirm',
      data:  { url: '/index.html#appointments' }
    }));
  }

  // Push all'ADMIN
  if (adminSub) {
    await safePush(adminSub, JSON.stringify({
      title: '📅 Nuova Prenotazione!',
      body:  `${newAppt.clientName} → ${newAppt.service} · ${newAppt.date} alle ${newAppt.slot}`,
      icon:  '/icons/icon-192.png',
      tag:   'admin-booking',
      data:  { url: '/index.html?open=admin' }
    }));
  }

  res.json({ ok: true, appointment: newAppt });
});

// PUT /appointments/:id — modifica appuntamento
app.put('/appointments/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { slot, notes, status } = req.body;
  const appt = appointments.find(a => a.id === id);
  if (!appt) return res.status(404).json({ error: 'Non trovato' });

  const oldSlot = appt.slot;
  if (slot)   appt.slot   = slot;
  if (notes !== undefined) appt.notes = notes;
  if (status) appt.status = status;

  console.log(`✏️ Modifica: ${appt.clientName} → ${appt.service} ${oldSlot}→${appt.slot}`);

  // Push al cliente se orario cambiato
  const clientSub = subscriptions.get(appt.clientId);
  if (clientSub && slot && slot !== oldSlot) {
    await safePush(clientSub.subscription, JSON.stringify({
      title: '✏️ Appuntamento Modificato',
      body:  `${appt.service}: ${oldSlot} → ${slot} (${appt.date})`,
      icon:  '/icons/icon-192.png',
      tag:   'edit',
      data:  { url: '/index.html#appointments' }
    }));
  }

  // Push admin se annullato dal cliente
  if (status === 'cancelled' && adminSub) {
    await safePush(adminSub, JSON.stringify({
      title: '❌ Prenotazione Annullata',
      body:  `${appt.clientName} → ${appt.service} · ${appt.date} alle ${oldSlot}`,
      icon:  '/icons/icon-192.png',
      tag:   'admin-cancellation',
      data:  { url: '/index.html?open=admin' }
    }));
  }

  res.json({ ok: true, appointment: appt });
});

// DELETE /appointments/:id — elimina (admin)
app.delete('/appointments/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const idx = appointments.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Non trovato' });

  const appt = appointments[idx];
  appt.status = 'cancelled';
  console.log(`🗑 Annullato: ${appt.clientName} → ${appt.service}`);

  // Push al cliente
  const clientSub = subscriptions.get(appt.clientId);
  if (clientSub) {
    await safePush(clientSub.subscription, JSON.stringify({
      title: '❌ Appuntamento Annullato',
      body:  `${appt.service} del ${appt.date} è stato annullato.`,
      icon:  '/icons/icon-192.png',
      tag:   'cancellation',
      data:  { url: '/index.html#booking' }
    }));
  }

  res.json({ ok: true });
});

// ════════════════════════════════════════
//  PUSH SUBSCRIPTIONS
// ════════════════════════════════════════

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/subscribe', (req, res) => {
  const { subscription, clientId, clientName } = req.body;
  if (!subscription || !clientId) return res.status(400).json({ error: 'Dati mancanti' });
  subscriptions.set(clientId, { subscription, clientName: clientName||'Cliente' });
  console.log(`✅ Cliente iscritto: ${clientName||clientId}`);
  res.json({ ok: true });
});

app.post('/subscribe/admin', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription mancante' });
  adminSub = subscription;
  console.log('🔐 Admin iscritto alle push');
  res.json({ ok: true });
});

app.post('/unsubscribe', (req, res) => {
  const { clientId } = req.body;
  subscriptions.delete(clientId);
  res.json({ ok: true });
});

app.post('/unsubscribe/admin', (req, res) => {
  adminSub = null;
  res.json({ ok: true });
});

app.post('/notify/promo', async (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({
    title: title||'✨ Nuova Promozione Glass Skin',
    body:  body||'Scopri le offerte del mese! 🌸',
    icon:  '/icons/icon-192.png', tag: 'promo',
    data:  { url: '/index.html#home' }
  });
  const results = [];
  for (const [id, {subscription, clientName}] of subscriptions) {
    const r = await safePush(subscription, payload);
    if (r==='expired') subscriptions.delete(id);
    results.push({ id, clientName, ok: r===true });
  }
  res.json({ ok: true, sent: results.filter(r=>r.ok).length });
});

// ── HEALTH ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: subscriptions.size,
    adminSubscribed: !!adminSub,
    appointments: appointments.filter(a=>a.status==='upcoming').length
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Glass Skin Beauty Server v3`);
  console.log(`   Running → http://localhost:${PORT}\n`);
});
