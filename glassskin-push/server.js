// ══════════════════════════════════════════
//  GLASS SKIN BEAUTY — Server v4
//  Storage persistente subscription + appuntamenti
//  Usa file JSON su disco come fallback persistente
// ══════════════════════════════════════════

const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ── VAPID ──
const VAPID_PUBLIC  = 'BFTjj7BQx_HZ-j1ZyktpoHmHUmOdAWmKqDi5X6ajCBzpLkAruB0Eb0adC7d_bHu_iw3Mt93UNpRQQuMMJrG7h7w';
const VAPID_PRIVATE = 'cD4yuAsqgf9QWNOiPms1V6LFouNEyLbglRsKENTMrD0';
webpush.setVapidDetails('mailto:kazak@glasskinbeauty.it', VAPID_PUBLIC, VAPID_PRIVATE);

// ── STORAGE PERSISTENTE SU DISCO ──
const DATA_DIR  = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/tmp';
const SUBS_FILE = path.join(DATA_DIR, 'gsb_subscriptions.json');
const APPT_FILE = path.join(DATA_DIR, 'gsb_appointments.json');
const ADMIN_FILE = path.join(DATA_DIR, 'gsb_admin.json');

function loadJSON(file, def) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch(e) { console.warn('Load error:', file, e.message); }
  return def;
}

function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data), 'utf8'); }
  catch(e) { console.warn('Save error:', file, e.message); }
}

// ── CARICA DATI DA DISCO AL AVVIO ──
const subsData = loadJSON(SUBS_FILE, {});
const subscriptions = new Map(Object.entries(subsData));

let adminData = loadJSON(ADMIN_FILE, { subscription: null });
let adminSub  = adminData.subscription;

let appointments = loadJSON(APPT_FILE, []);
console.log(`📦 Caricati: ${subscriptions.size} subscriptions, ${appointments.length} appuntamenti`);
if (adminSub) console.log('🔐 Admin subscription ripristinata dal disco');

// ── SALVA SUBSCRIPTION SU DISCO ──
function saveSubscriptions() {
  const obj = {};
  subscriptions.forEach((v, k) => { obj[k] = v; });
  saveJSON(SUBS_FILE, obj);
}

function saveAdminSub() {
  saveJSON(ADMIN_FILE, { subscription: adminSub });
}

function saveAppointments() {
  saveJSON(APPT_FILE, appointments);
}

// ── HELPER PUSH ──
async function safePush(sub, payload) {
  try {
    await webpush.sendNotification(sub, payload);
    return true;
  } catch(err) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.error('[Push] Error:', err.message);
    return false;
  }
}

// ════════════════════════════════════════
//  PRENOTAZIONI API
// ════════════════════════════════════════

app.get('/appointments', (req, res) => {
  res.json({ appointments });
});

app.get('/appointments/client/:clientId', (req, res) => {
  const clientAppts = appointments.filter(a => a.clientId === req.params.clientId);
  res.json({ appointments: clientAppts });
});

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
  saveAppointments();
  console.log(`📅 Prenotazione: ${newAppt.clientName} → ${newAppt.service} ${newAppt.slot}`);

  // Push CLIENTE
  const clientSub = subscriptions.get(clientId);
  if (clientSub) {
    const r = await safePush(clientSub.subscription, JSON.stringify({
      title: '✓ Prenotazione Confermata!',
      body:  `${newAppt.service} — ${newAppt.dateLabel || newAppt.date} alle ${newAppt.slot} 🌸`,
      icon:  '/icons/icon-192.png', tag: 'booking-confirm',
      data:  { url: '/index.html#appointments' }
    }));
    if (r === 'expired') { subscriptions.delete(clientId); saveSubscriptions(); }
    console.log(`📲 Push cliente: ${r}`);
  } else {
    console.log(`⚠️ Cliente ${clientId} non iscritto alle push`);
  }

  // Push ADMIN
  if (adminSub) {
    const r = await safePush(adminSub, JSON.stringify({
      title: '📅 Nuova Prenotazione!',
      body:  `${newAppt.clientName} → ${newAppt.service} · ${newAppt.dateLabel || newAppt.date} alle ${newAppt.slot}`,
      icon:  '/icons/icon-192.png', tag: 'admin-booking',
      data:  { url: '/index.html?open=admin' }
    }));
    if (r === 'expired') { adminSub = null; saveAdminSub(); }
    console.log(`📲 Push admin: ${r}`);
  }

  res.json({ ok: true, appointment: newAppt });
});

app.put('/appointments/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { slot, notes, status } = req.body;
  const appt = appointments.find(a => a.id === id);
  if (!appt) return res.status(404).json({ error: 'Non trovato' });

  const oldSlot   = appt.slot;
  const oldStatus = appt.status;
  if (slot   !== undefined) appt.slot   = slot;
  if (notes  !== undefined) appt.notes  = notes;
  if (status !== undefined) appt.status = status;
  saveAppointments();

  const clientSub = subscriptions.get(appt.clientId);

  // Push cliente: orario modificato
  if (clientSub && slot && slot !== oldSlot && status !== 'cancelled') {
    const r = await safePush(clientSub.subscription, JSON.stringify({
      title: '✏️ Appuntamento Modificato',
      body:  `${appt.service}: ${oldSlot} → ${slot}`,
      icon:  '/icons/icon-192.png', tag: 'edit',
      data:  { url: '/index.html#appointments' }
    }));
    if (r === 'expired') { subscriptions.delete(appt.clientId); saveSubscriptions(); }
    console.log(`📲 Push modifica cliente: ${r}`);
  }

  // Push cliente: annullato da admin
  if (clientSub && status === 'cancelled' && oldStatus !== 'cancelled') {
    const r = await safePush(clientSub.subscription, JSON.stringify({
      title: '❌ Appuntamento Annullato',
      body:  `${appt.service} del ${appt.dateLabel || appt.date} è stato annullato.`,
      icon:  '/icons/icon-192.png', tag: 'cancellation',
      data:  { url: '/index.html#booking' }
    }));
    if (r === 'expired') { subscriptions.delete(appt.clientId); saveSubscriptions(); }
    console.log(`📲 Push annullamento cliente: ${r}`);
  }

  // Push admin: annullato da cliente
  if (adminSub && status === 'cancelled' && oldStatus !== 'cancelled') {
    const r = await safePush(adminSub, JSON.stringify({
      title: '❌ Prenotazione Annullata',
      body:  `${appt.clientName} → ${appt.service} · ${appt.dateLabel || appt.date} alle ${oldSlot}`,
      icon:  '/icons/icon-192.png', tag: 'admin-cancellation',
      data:  { url: '/index.html?open=admin' }
    }));
    if (r === 'expired') { adminSub = null; saveAdminSub(); }
    console.log(`📲 Push annullamento admin: ${r}`);
  }

  res.json({ ok: true, appointment: appt });
});

// ════════════════════════════════════════
//  SUBSCRIPTIONS
// ════════════════════════════════════════

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/subscribe', (req, res) => {
  const { subscription, clientId, clientName } = req.body;
  if (!subscription || !clientId) return res.status(400).json({ error: 'Dati mancanti' });
  subscriptions.set(clientId, { subscription, clientName: clientName||'Cliente' });
  saveSubscriptions(); // ← PERSISTENTE
  console.log(`✅ Cliente iscritto: ${clientName||clientId} (totale: ${subscriptions.size})`);
  res.json({ ok: true });
});

app.post('/subscribe/admin', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription mancante' });
  adminSub = subscription;
  saveAdminSub(); // ← PERSISTENTE
  console.log('🔐 Admin subscription salvata su disco');
  res.json({ ok: true });
});

app.post('/unsubscribe', (req, res) => {
  subscriptions.delete(req.body.clientId);
  saveSubscriptions();
  res.json({ ok: true });
});

app.post('/unsubscribe/admin', (req, res) => {
  adminSub = null;
  saveAdminSub();
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
  let sent = 0;
  for (const [id, {subscription}] of subscriptions) {
    const r = await safePush(subscription, payload);
    if (r === 'expired') { subscriptions.delete(id); saveSubscriptions(); }
    if (r === true) sent++;
  }
  res.json({ ok: true, sent });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: subscriptions.size,
    adminSubscribed: !!adminSub,
    appointments: appointments.filter(a => a.status==='upcoming').length,
    persistent: true
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Glass Skin Beauty Server v4 — Porta ${PORT}`);
  console.log(`   Storage persistente: ${DATA_DIR}`);
  console.log(`   Admin subscription: ${adminSub ? '✓ attiva' : '✗ non attiva'}\n`);
});
