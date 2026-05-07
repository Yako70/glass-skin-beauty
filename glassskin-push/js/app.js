/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — App Logic
   ══════════════════════════════════════════ */

// ─── STATE ───────────────────────────────
const state = {
  currentPage: 'home',
  booking: { service: null, duration: null, price: null, date: null, slot: null },
  appointments: JSON.parse(localStorage.getItem('gsb_appointments') || '[]'),
  profile: JSON.parse(localStorage.getItem('gsb_profile') || '{"name":"Bella","phone":""}'),
  calendar: { year: new Date().getFullYear(), month: new Date().getMonth() },
  messages: JSON.parse(localStorage.getItem('gsb_messages') || '[]'),
};

// ─── INIT ─────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
  }, 1800);

  setGreeting();
  updateHomeNextAppt();
  renderAppointments();
  renderAdminSlots();
  updateProfileStats();

  if (state.profile.name && state.profile.name !== 'Bella' && state.profile.name !== 'Ospite') {
    document.getElementById('userName').textContent = state.profile.name.split(' ')[0];
    document.getElementById('profileName').textContent = state.profile.name;
  }

  // Restore chat messages
  if (state.messages.length > 0) {
    state.messages.forEach(m => appendMsg(m.text, m.mine, m.time, false));
  }
});

// ─── GREETING ────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greetingTime');
  if (h < 12) el.textContent = '🌅 Buongiorno';
  else if (h < 18) el.textContent = '☀️ Buon pomeriggio';
  else el.textContent = '🌙 Buonasera';
}

// ─── NAVIGATION ──────────────────────────
function navigate(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (btn) btn.classList.add('active');
  state.currentPage = page;
  if (page === 'appointments') renderAppointments();
  if (page === 'profile') updateProfileStats();
}

function goBack(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const navMap = { home: 0, booking: 1, appointments: 2, chat: 3, profile: 4 };
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(b => b.classList.remove('active'));
  if (navMap[page] !== undefined) navItems[navMap[page]].classList.add('active');
}

function goToBooking() {
  navigate('booking', document.querySelectorAll('.nav-item')[1]);
}

function quickBook(serviceName) {
  navigate('booking', document.querySelectorAll('.nav-item')[1]);
  setTimeout(() => {
    const items = document.querySelectorAll('.service-item');
    items.forEach(item => {
      if (item.querySelector('.service-item-name').textContent === serviceName) {
        item.click();
      }
    });
  }, 100);
}

// ─── BOOKING STEPS ───────────────────────
function selectService(el, name, duration, price) {
  document.querySelectorAll('.service-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  state.booking.service = name;
  state.booking.duration = duration;
  state.booking.price = price;
  document.getElementById('step1Btn').disabled = false;
}

function goToStep2() {
  document.getElementById('bookStep1').style.display = 'none';
  document.getElementById('bookStep2').style.display = 'block';
  document.getElementById('step1').classList.remove('active'); document.getElementById('step1').classList.add('done');
  document.getElementById('step2').classList.add('active');
  renderCalendar();
}

function goBackStep1() {
  document.getElementById('bookStep2').style.display = 'none';
  document.getElementById('bookStep1').style.display = 'block';
  document.getElementById('step2').classList.remove('active','done');
  document.getElementById('step1').classList.remove('done'); document.getElementById('step1').classList.add('active');
}

function goToStep3() {
  if (!state.booking.date || !state.booking.slot) return;
  document.getElementById('bookStep2').style.display = 'none';
  document.getElementById('bookStep3').style.display = 'block';
  document.getElementById('step2').classList.remove('active'); document.getElementById('step2').classList.add('done');
  document.getElementById('step3').classList.add('active');

  document.getElementById('confService').textContent = state.booking.service;
  document.getElementById('confDate').textContent = formatDateIT(state.booking.date);
  document.getElementById('confTime').textContent = state.booking.slot;
  document.getElementById('confDuration').textContent = state.booking.duration;
  document.getElementById('confPrice').textContent = state.booking.price;
}

function goBackStep2() {
  document.getElementById('bookStep3').style.display = 'none';
  document.getElementById('bookStep2').style.display = 'block';
  document.getElementById('step3').classList.remove('active');
  document.getElementById('step2').classList.remove('done'); document.getElementById('step2').classList.add('active');
}

function confirmBooking() {
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  if (!name) { alert('Inserisci il tuo nome per confermare.'); return; }

  const appt = {
    id: Date.now(),
    service: state.booking.service,
    duration: state.booking.duration,
    price: state.booking.price,
    date: state.booking.date,
    slot: state.booking.slot,
    clientName: name,
    clientPhone: phone,
    notes: document.getElementById('clientNotes').value,
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };

  state.appointments.unshift(appt);
  saveAppointments();

  // Update profile
  if (name) {
    state.profile.name = name;
    if (phone) state.profile.phone = phone;
    localStorage.setItem('gsb_profile', JSON.stringify(state.profile));
    document.getElementById('userName').textContent = name.split(' ')[0];
    document.getElementById('profileName').textContent = name;
  }

  updateHomeNextAppt();

  // Show success
  document.getElementById('successMsg').textContent =
    `${state.booking.service} — ${formatDateIT(state.booking.date)} alle ${state.booking.slot}\nRiceverai un promemoria 24h prima. 🌸`;
  document.getElementById('successOverlay').classList.add('show');

  resetBooking();
}

function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('show');
  navigate('appointments', document.querySelectorAll('.nav-item')[2]);
}

function resetBooking() {
  state.booking = { service: null, duration: null, price: null, date: null, slot: null };
  document.querySelectorAll('.service-item').forEach(i => i.classList.remove('selected'));
  document.getElementById('step1Btn').disabled = true;
  document.getElementById('step2Btn').disabled = true;
  document.getElementById('bookStep1').style.display = 'block';
  document.getElementById('bookStep2').style.display = 'none';
  document.getElementById('bookStep3').style.display = 'none';
  ['step1','step2','step3'].forEach(s => {
    document.getElementById(s).classList.remove('active','done');
  });
  document.getElementById('step1').classList.add('active');
  document.getElementById('clientName').value = state.profile.name !== 'Bella' ? state.profile.name : '';
  document.getElementById('clientPhone').value = state.profile.phone || '';
  document.getElementById('clientNotes').value = '';
}

// ─── CALENDAR ─────────────────────────────
const DAYS_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function renderCalendar() {
  const { year, month } = state.calendar;
  document.getElementById('calMonth').textContent = `${MONTHS_IT[month]} ${year}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Day headers
  DAYS_IT.forEach(d => {
    const lbl = document.createElement('div');
    lbl.className = 'cal-day-label';
    lbl.textContent = d;
    grid.appendChild(lbl);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay();
    const btn = document.createElement('div');
    btn.className = 'cal-day';
    btn.textContent = d;

    // Sunday (0) = closed
    if (dayOfWeek === 0) {
      btn.classList.add('sunday');
    } else if (dateObj < today) {
      btn.classList.add('disabled');
    } else {
      if (dateObj.getTime() === today.getTime()) btn.classList.add('today');
      if (state.booking.date && dateObj.toDateString() === new Date(state.booking.date).toDateString()) {
        btn.classList.add('selected');
      }
      btn.onclick = () => selectDate(dateObj, btn);
    }
    grid.appendChild(btn);
  }
}

function selectDate(dateObj, btn) {
  state.booking.date = dateObj;
  document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  renderTimeSlots(dateObj);
}

function prevMonth() {
  if (state.calendar.month === 0) { state.calendar.month = 11; state.calendar.year--; }
  else state.calendar.month--;
  renderCalendar();
}
function nextMonth() {
  if (state.calendar.month === 11) { state.calendar.month = 0; state.calendar.year++; }
  else state.calendar.month++;
  renderCalendar();
}

// ─── TIME SLOTS ───────────────────────────
function renderTimeSlots(dateObj) {
  const grid = document.getElementById('slotsGrid');
  grid.innerHTML = '';
  state.booking.slot = null;
  document.getElementById('step2Btn').disabled = true;

  // Booked slots for this date
  const booked = state.appointments
    .filter(a => a.status === 'upcoming' && new Date(a.date).toDateString() === dateObj.toDateString())
    .map(a => a.slot);

  const allSlots = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];

  // If today, filter past slots
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();

  allSlots.forEach(time => {
    const [h, m] = time.split(':').map(Number);
    const slotEl = document.createElement('div');
    slotEl.className = 'slot';
    slotEl.textContent = time;

    const isPast = isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));
    if (booked.includes(time) || isPast) {
      slotEl.classList.add('unavailable');
    } else {
      slotEl.onclick = () => {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        slotEl.classList.add('selected');
        state.booking.slot = time;
        document.getElementById('step2Btn').disabled = false;
      };
    }
    grid.appendChild(slotEl);
  });
}

// ─── APPOINTMENTS ─────────────────────────
function renderAppointments() {
  const upcoming = state.appointments.filter(a => a.status === 'upcoming');
  const past = state.appointments.filter(a => a.status !== 'upcoming');

  renderList('upcoming-list', upcoming, true);
  renderList('past-list', past, false);
}

function renderList(containerId, items, isUpcoming) {
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isUpcoming ? '🗓️' : '📋'}</div>
        <h3>${isUpcoming ? 'Nessun appuntamento' : 'Nessuno storico'}</h3>
        <p>${isUpcoming ? 'Prenota il tuo primo trattamento e prenditi cura della tua pelle ✨' : 'I tuoi trattamenti completati appariranno qui'}</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(appt => `
    <div class="appointment-card" id="appt-${appt.id}">
      <div class="appt-header">
        <div class="appt-service">${appt.service}</div>
        <span class="appt-badge ${isUpcoming ? 'badge-upcoming' : 'badge-past'}">${isUpcoming ? 'Confermato' : 'Completato'}</span>
      </div>
      <div class="appt-details">
        <div class="appt-detail">📅 ${formatDateIT(appt.date)}</div>
        <div class="appt-detail">🕐 ${appt.slot}</div>
        <div class="appt-detail">⏱ ${appt.duration}</div>
        <div class="appt-detail">💰 ${appt.price}</div>
      </div>
      ${isUpcoming ? `
      <div class="appt-actions">
        <button class="appt-btn appt-btn-cancel" onclick="cancelAppt(${appt.id})">Annulla</button>
        <button class="appt-btn appt-btn-rebook" onclick="quickBook('${appt.service}')">Riprenota</button>
      </div>` : `
      <div class="appt-actions">
        <button class="appt-btn appt-btn-rebook" onclick="quickBook('${appt.service}')">Prenota di nuovo</button>
      </div>`}
    </div>`).join('');
}

function cancelAppt(id) {
  if (!confirm('Vuoi annullare questo appuntamento?')) return;
  const appt = state.appointments.find(a => a.id === id);
  if (appt) { appt.status = 'cancelled'; saveAppointments(); renderAppointments(); updateHomeNextAppt(); renderAdminSlots(); }
}

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('upcoming-list').style.display = tab === 'upcoming' ? 'block' : 'none';
  document.getElementById('past-list').style.display = tab === 'past' ? 'block' : 'none';
}

function saveAppointments() {
  localStorage.setItem('gsb_appointments', JSON.stringify(state.appointments));
  updateProfileStats();
}

// ─── HOME — NEXT APPT ────────────────────
function updateHomeNextAppt() {
  const next = state.appointments.find(a => a.status === 'upcoming');
  if (next) {
    document.getElementById('nextApptService').textContent = next.service;
    document.getElementById('nextApptDate').textContent = `📅 ${formatDateIT(next.date)}`;
    document.getElementById('nextApptTime').textContent = `🕐 ${next.slot}`;
  } else {
    document.getElementById('nextApptService').textContent = 'Nessun appuntamento';
    document.getElementById('nextApptDate').textContent = '📅 Prenota ora';
    document.getElementById('nextApptTime').textContent = '';
  }
}

// ─── ADMIN PANEL ──────────────────────────
function showAdminPanel() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-admin').classList.add('active');
  renderAdminSlots();
}

function renderAdminSlots() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayAppts = state.appointments.filter(a => {
    const d = new Date(a.date); d.setHours(0,0,0,0);
    return a.status === 'upcoming' && d.getTime() === today.getTime();
  });

  const weekAppts = state.appointments.filter(a => {
    const d = new Date(a.date);
    const diff = (d - today) / (1000*60*60*24);
    return a.status === 'upcoming' && diff >= 0 && diff < 7;
  });

  const revenue = weekAppts.reduce((sum, a) => sum + parseInt(a.price.replace('€','')), 0);

  document.getElementById('adminDate').textContent = today.toLocaleDateString('it-IT', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('adminTodayCount').textContent = todayAppts.length;
  document.getElementById('adminWeekCount').textContent = weekAppts.length;
  document.getElementById('adminRevenue').textContent = `€${revenue}`;

  const allSlots = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
  const container = document.getElementById('adminSlots');

  container.innerHTML = allSlots.map(time => {
    const appt = todayAppts.find(a => a.slot === time);
    if (appt) {
      return `<div class="admin-slot">
        <div class="admin-time">${time}</div>
        <div class="admin-client-info">
          <div class="admin-client-name">${appt.clientName}</div>
          <div class="admin-service-name">${appt.service} · ${appt.duration} · ${appt.price}</div>
        </div>
        <span class="admin-status status-confirmed">✓ Confermato</span>
      </div>`;
    } else {
      return `<div class="admin-slot admin-free">
        <div class="admin-time">${time}</div>
        <div class="admin-client-info">
          <div class="admin-client-name">Slot libero</div>
          <div class="admin-service-name">Disponibile</div>
        </div>
      </div>`;
    }
  }).join('');
}

// ─── PROFILE STATS ───────────────────────
function updateProfileStats() {
  const total = state.appointments.filter(a => a.status !== 'cancelled').length;
  const upcoming = state.appointments.filter(a => a.status === 'upcoming').length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statUpcoming').textContent = upcoming;
  if (state.profile.name && state.profile.name !== 'Bella') {
    document.getElementById('profileName').textContent = state.profile.name;
  }
}

// ─── CHAT ────────────────────────────────
const AUTO_REPLIES = [
  'Certo! Posso aiutarti a prenotare direttamente dall\'app 😊',
  'Grazie per averci contattato! Ti rispondo subito 🌸',
  'Ottima domanda! I nostri trattamenti partono da €55. Vuoi vedere i dettagli?',
  'Siamo aperti da lunedì a sabato, dalle 9:00 alle 18:00 ✨',
  'Per le promozioni del mese, dai un\'occhiata alla sezione Home! 💫',
  'Certo, possiamo trovare l\'orario perfetto per te. Prova a prenotare dall\'app!',
];

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const time = new Date().toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
  appendMsg(text, true, time, true);
  input.value = '';

  // Auto-reply
  setTimeout(() => {
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    const replyTime = new Date().toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
    appendMsg(reply, false, replyTime, true);
  }, 1000 + Math.random() * 1000);
}

function appendMsg(text, isMine, time, save) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg' + (isMine ? ' mine' : '');
  div.innerHTML = isMine
    ? `<div><div class="msg-bubble">${text}</div><div class="msg-time">${time}</div></div>`
    : `<div class="msg-avatar">💆</div><div><div class="msg-bubble">${text}</div><div class="msg-time">${time}</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (save) {
    state.messages.push({ text, mine: isMine, time });
    localStorage.setItem('gsb_messages', JSON.stringify(state.messages.slice(-50)));
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ─── MODAL ───────────────────────────────
function openModal(content) {
  document.getElementById('modalContent').innerHTML = content;
  document.getElementById('modal').classList.add('open');
}
function closeModal(e) {
  if (e.target === document.getElementById('modal')) {
    document.getElementById('modal').classList.remove('open');
  }
}

function showNotifications() {
  openModal(`
    <div class="modal-title">Notifiche</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:rgba(196,132,106,0.08);border-radius:12px;padding:14px;border-left:3px solid var(--copper)">
        <div style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--copper);margin-bottom:6px">Promemoria</div>
        <div style="font-size:0.85rem;color:var(--dark)">Ricorda di prenotare il tuo trattamento mensile! 🌸</div>
      </div>
      <div style="background:rgba(212,165,160,0.08);border-radius:12px;padding:14px;border-left:3px solid var(--rose)">
        <div style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--rose);margin-bottom:6px">Nuova Promozione</div>
        <div style="font-size:0.85rem;color:var(--dark)">Maggio: −20% sul Trattamento Glow Boost 💫</div>
      </div>
      <div style="background:rgba(212,165,160,0.05);border-radius:12px;padding:14px">
        <div style="font-size:0.85rem;color:var(--muted);text-align:center">Nessun'altra notifica</div>
      </div>
    </div>
  `);
}

function showEditProfile() {
  openModal(`
    <div class="modal-title">Modifica Profilo</div>
    <div class="form-group">
      <label class="form-label">Nome completo</label>
      <input class="form-input" id="editName" value="${state.profile.name !== 'Bella' && state.profile.name !== 'Ospite' ? state.profile.name : ''}" placeholder="Il tuo nome" />
    </div>
    <div class="form-group">
      <label class="form-label">Telefono</label>
      <input class="form-input" id="editPhone" value="${state.profile.phone || ''}" placeholder="+39 333 123 4567" />
    </div>
    <button class="btn-primary" onclick="saveProfile()">Salva modifiche</button>
  `);
}

function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (name) {
    state.profile.name = name;
    state.profile.phone = phone;
    localStorage.setItem('gsb_profile', JSON.stringify(state.profile));
    document.getElementById('userName').textContent = name.split(' ')[0];
    document.getElementById('profileName').textContent = name;
  }
  document.getElementById('modal').classList.remove('open');
}

function showNotifSettings() {
  openModal(`
    <div class="modal-title">Notifiche & Promemoria</div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${[
        ['Promemoria 24h prima', true],
        ['Promemoria 2h prima', true],
        ['Nuove promozioni', true],
        ['Messaggi dallo staff', true],
        ['Newsletter mensile', false]
      ].map(([label, checked]) => `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.85rem;color:var(--dark)">${label}</span>
          <div onclick="this.classList.toggle('on')" style="width:44px;height:24px;border-radius:12px;background:${checked ? 'var(--rose)' : 'rgba(212,165,160,0.25)'};cursor:pointer;position:relative;transition:background 0.2s" class="${checked?'on':''}">
            <div style="position:absolute;top:3px;left:${checked?'21':'3'}px;width:18px;height:18px;border-radius:50%;background:white;box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:left 0.2s"></div>
          </div>
        </div>`).join('<hr style="border:none;border-top:1px solid rgba(212,165,160,0.15)">')}
    </div>
  `);
}

function showInstallGuide() {
  openModal(`
    <div class="modal-title">📱 Installa l'App</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="background:rgba(240,221,214,0.3);border-radius:14px;padding:16px">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:8px">🍎 iPhone / iPad</div>
        <ol style="padding-left:16px;font-size:0.78rem;color:var(--muted);line-height:2">
          <li>Apri questa pagina in <strong style="color:var(--dark)">Safari</strong></li>
          <li>Tocca l'icona <strong style="color:var(--dark)">Condividi</strong> (□↑)</li>
          <li>Scorri e tocca <strong style="color:var(--dark)">"Aggiungi a schermata Home"</strong></li>
          <li>Tocca <strong style="color:var(--dark)">"Aggiungi"</strong> in alto a destra</li>
        </ol>
      </div>
      <div style="background:rgba(240,221,214,0.3);border-radius:14px;padding:16px">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:8px">🤖 Android</div>
        <ol style="padding-left:16px;font-size:0.78rem;color:var(--muted);line-height:2">
          <li>Apri questa pagina in <strong style="color:var(--dark)">Chrome</strong></li>
          <li>Tocca i <strong style="color:var(--dark)">3 puntini</strong> in alto a destra</li>
          <li>Tocca <strong style="color:var(--dark)">"Aggiungi a schermata Home"</strong></li>
          <li>Conferma con <strong style="color:var(--dark)">"Aggiungi"</strong></li>
        </ol>
      </div>
      <div style="text-align:center;font-size:0.72rem;color:var(--muted)">
        L'app funziona anche offline e si aggiorna automaticamente 🌸
      </div>
    </div>
  `);
}

// ─── PWA INSTALL PROMPT ──────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('installBanner').classList.add('hidden');
    deferredPrompt = null;
  } else {
    showInstallGuide();
  }
});

// ─── UTILS ───────────────────────────────
function formatDateIT(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'long' });
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ══════════════════════════════════════════
//  PUSH NOTIFICATIONS — App Integration
// ══════════════════════════════════════════

async function togglePushNotifications() {
  const enabled = localStorage.getItem('gsb_push_enabled') === 'true';
  if (enabled) {
    if (confirm('Vuoi disattivare le notifiche push?')) {
      await window.GSBPush.unsubscribe();
    }
  } else {
    const name = state.profile.name !== 'Bella' ? state.profile.name : '';
    await window.GSBPush.subscribe(name || 'Cliente');
  }
}

// Patch confirmBooking per inviare push dopo conferma
const _origConfirm = window.confirmBooking;
window.confirmBooking = function() {
  _origConfirm && _origConfirm();
};

// Intercetta la conferma prenotazione per aggiungere push
document.addEventListener('DOMContentLoaded', () => {
  // Override confermato dopo che il DOM è pronto
});

// Aggiungi push alla funzione originale (monkey-patch sicuro)
(function() {
  const orig = window.confirmBooking;
  window.confirmBooking = async function() {
    const svc  = document.getElementById('confService')?.textContent;
    const date = document.getElementById('confDate')?.textContent;
    const time = document.getElementById('confTime')?.textContent;

    // Esegui la prenotazione originale
    if (orig) orig();

    // Poi invia la notifica push (con leggero delay per attendere il salvataggio)
    setTimeout(async () => {
      if (window.GSBPush && window.GSBPush.isEnabled() && svc && svc !== '—') {
        await window.GSBPush.notifyBooking(svc, date, time);
        // Promemoria 24h prima
        const appt = state.appointments[0];
        if (appt && appt.date) {
          const apptTime = new Date(appt.date);
          const [hh,mm] = (appt.slot||'10:00').split(':').map(Number);
          apptTime.setHours(hh - 24, mm, 0, 0);
          const ms = apptTime.getTime() - Date.now();
          if (ms > 0) window.GSBPush.scheduleReminder(appt.service, appt.slot, ms);
        }
      }
    }, 300);
  };
})();
