/* SERVER URL per push dirette */
const SERVER_URL = "https://glass-skin-beauty-production.up.railway.app";

/* ══════════════════════════════════════════
   GLASS SKIN BEAUTY — App Logic v4
   Admin: dark theme, promozioni, modifica/annulla appuntamenti
   ══════════════════════════════════════════ */

// ─── STATE ───────────────────────────────
const state = {
  booking: { service:null, dur:null, price:null, date:null, slot:null },
  appointments: JSON.parse(localStorage.getItem('gsb_appts') || '[]'),
  profile: JSON.parse(localStorage.getItem('gsb_profile') || '{"name":"Bella","phone":""}'),
  calendar: { year: new Date().getFullYear(), month: new Date().getMonth() },
  messages: JSON.parse(localStorage.getItem('gsb_msgs') || '[]'),
  services: JSON.parse(localStorage.getItem('gsb_services') || 'null'),
  promos: JSON.parse(localStorage.getItem('gsb_promos') || 'null'),
};

// ─── DEFAULT DATA ─────────────────────────
const DEFAULT_SERVICES = [
  {id:1,emo:'🌸',name:'Pulizia Profonda',   desc:'Vapore, comedoni, siero',      dur:60,price:65,active:true},
  {id:2,emo:'💧',name:'Facciale Idratante', desc:'Acido ialuronico, massaggio',  dur:60,price:70,active:true},
  {id:3,emo:'✨',name:'Anti-età Lifting',   desc:'Radiofrequenza, collagene',    dur:75,price:85,active:true},
  {id:4,emo:'🌟',name:'Peeling Glow',       desc:'Esfoliazione, vitamina C',     dur:45,price:55,active:true},
  {id:5,emo:'🫧',name:'Hydra Intense',      desc:'K-beauty ritual completo',     dur:90,price:95,active:true},
];

const DEFAULT_PROMOS = [
  {id:1,badge:'✦ Maggio 2025',title:'Trattamento Glow Boost',desc:'Pulizia profonda + siero vitamina C + massaggio drenante',discount:'−20%',active:true},
  {id:2,badge:'✦ Nuova clienta',title:'Benvenuta da Glass Skin',desc:'Primo trattamento viso in omaggio con ogni pacchetto da 3',discount:'1 Free',active:true},
  {id:3,badge:'✦ Primavera',title:'Ritual Hydra Intense',desc:'Maschera ialuronico + lifting linfatico + siero K-beauty',discount:'−15%',active:true},
];

if (!state.services) { state.services = DEFAULT_SERVICES; saveServices(); }
if (!state.promos)   { state.promos   = DEFAULT_PROMOS;   savePromos(); }

function saveServices() { localStorage.setItem('gsb_services', JSON.stringify(state.services)); }
function savePromos()   { localStorage.setItem('gsb_promos',   JSON.stringify(state.promos)); }
function saveAppts()    { localStorage.setItem('gsb_appts',    JSON.stringify(state.appointments)); }

// ─── AUTH ────────────────────────────────
const getAdminCreds = () => JSON.parse(localStorage.getItem('gsb_admin_creds') || 'null');
const saveAdminCreds = (u,p) => localStorage.setItem('gsb_admin_creds', JSON.stringify({u,p}));

// ─── INIT ─────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('splash').classList.add('gone'), 1800);
  setGreeting();
  updateHomeNextAppt();
  renderHomeServices();
  renderHomePromos();
  renderBookingServices();
  renderAppointments();
  updateProfileStats();
  state.messages.forEach(m => appendMsg(m.text, m.mine, m.time, false));
  if (state.profile.name && state.profile.name !== 'Bella') {
    document.getElementById('userName').textContent = state.profile.name.split(' ')[0];
    document.getElementById('profName').textContent = state.profile.name;
  }
  setTimeout(() => { document.getElementById('clientApp').style.display = 'block'; }, 100);
});

// ─── GREETING ────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  document.getElementById('gtime').textContent = h<12?'🌅 Buongiorno':h<18?'☀️ Buon pomeriggio':'🌙 Buonasera';
}

// ─── CLIENT NAV ──────────────────────────
function navTo(page, idx) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-'+page).classList.add('on');
  document.querySelectorAll('.ni').forEach(b => b.classList.remove('on'));
  if (idx != null) document.getElementById('ni'+idx).classList.add('on');
  if (page==='appointments') renderAppointments();
  if (page==='profile') updateProfileStats();
}

// ─── ADMIN AUTH ───────────────────────────
function openAdminLogin() {
  if (!getAdminCreds()) document.getElementById('firstSetup').classList.add('show');
  else {
    document.getElementById('adminLogin').classList.add('show');
    document.getElementById('alErr').textContent='';
    document.getElementById('alUser').value='';
    document.getElementById('alPass').value='';
  }
}
function closeAdminLogin() { document.getElementById('adminLogin').classList.remove('show'); }

function doAdminLogin() {
  const u = document.getElementById('alUser').value.trim();
  const p = document.getElementById('alPass').value;
  const c = getAdminCreds();
  if (u===c.u && p===c.p) {
    document.getElementById('adminLogin').classList.remove('show');
    document.getElementById('clientApp').style.display='none';
    document.getElementById('adminApp').style.display='block';
    renderAdminAgenda(); renderAdminServices(); renderAdminPromos(); renderAdminClienti();
    showToast('Benvenuta! 🌸', true);
    // Attiva push admin
    if (window.GSBPush) window.GSBPush.subscribeAdmin().then(sub => {
      if (sub) showToast('🔔 Notifiche admin attive!', true);
    });
  } else {
    document.getElementById('alErr').textContent='Credenziali errate';
    document.getElementById('alPass').value='';
  }
}

function doFirstSetup() {
  const u  = document.getElementById('fsUser').value.trim();
  const p  = document.getElementById('fsPass').value;
  const p2 = document.getElementById('fsPass2').value;
  const err = document.getElementById('fsErr');
  if (!u)       { err.textContent='Inserisci username'; return; }
  if (p.length<6){ err.textContent='Password min. 6 caratteri'; return; }
  if (p!==p2)   { err.textContent='Le password non coincidono'; return; }
  saveAdminCreds(u,p);
  document.getElementById('firstSetup').classList.remove('show');
  document.getElementById('clientApp').style.display='none';
  document.getElementById('adminApp').style.display='block';
  renderAdminAgenda(); renderAdminServices(); renderAdminPromos(); renderAdminClienti();
  showToast('Credenziali salvate! 🌸', true);
  // Attiva push admin al primo accesso
  if (window.GSBPush) setTimeout(() => window.GSBPush.subscribeAdmin(), 1000);
}

function adminLogout() {
  document.getElementById('adminApp').style.display='none';
  document.getElementById('clientApp').style.display='block';
  // Disattiva push admin al logout (opzionale — commenta per mantenerle attive)
  // if (window.GSBPush) window.GSBPush.unsubscribeAdmin();
  showToast('Logout effettuato');
}

function changePassword() {
  const p1 = document.getElementById('newPass').value;
  const p2 = document.getElementById('newPass2').value;
  if (p1.length<6) { showToast('Password min. 6 caratteri', true); return; }
  if (p1!==p2)     { showToast('Le password non coincidono', true); return; }
  const c = getAdminCreds();
  saveAdminCreds(c.u, p1);
  document.getElementById('newPass').value='';
  document.getElementById('newPass2').value='';
  showToast('✓ Password aggiornata!', true);
}

// ─── ADMIN NAV ───────────────────────────
function adminNav(page, idx) {
  document.querySelectorAll('.apg').forEach(p => p.classList.remove('on'));
  document.getElementById('apg-'+page).classList.add('on');
  document.querySelectorAll('.ani').forEach(b => b.classList.remove('on'));
  document.getElementById('ani'+idx).classList.add('on');
}

// ─── ADMIN AGENDA ─────────────────────────
function renderAdminAgenda() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayAppts = state.appointments.filter(a => {
    const d=new Date(a.date); d.setHours(0,0,0,0);
    return a.status==='upcoming' && d.getTime()===today.getTime();
  });
  const weekAppts = state.appointments.filter(a => {
    const d=new Date(a.date); const diff=(d-today)/(1000*60*60*24);
    return a.status==='upcoming' && diff>=0 && diff<7;
  });
  const rev = weekAppts.reduce((s,a) => s+parseInt((a.price||'€0').replace('€','')),0);
  document.getElementById('adToday').textContent = todayAppts.length;
  document.getElementById('adWeek').textContent  = weekAppts.length;
  document.getElementById('adRev').textContent   = '€'+rev;

  const slots = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
  document.getElementById('admSlots').innerHTML = slots.map(t => {
    const a = todayAppts.find(x => x.slot===t);
    if (a) return `
      <div class="a-slot booked">
        <div class="a-time">${t}</div>
        <div style="flex:1">
          <div class="a-client-name">${a.clientName}</div>
          <div class="a-client-svc">${a.service} · ${a.dur} · ${a.price}</div>
        </div>
        <span class="a-badge badge-ok">✓ Conf.</span>
        <div class="a-slot-acts">
          <button class="a-act-btn a-edit-btn" onclick="openEditAppt(${a.id})" title="Modifica">✏️</button>
          <button class="a-act-btn a-del-btn" onclick="openCancelAppt(${a.id})" title="Annulla">🗑</button>
        </div>
      </div>`;
    return `<div class="a-slot"><div class="a-time">${t}</div><div class="a-slot-free">Slot libero</div></div>`;
  }).join('');
}

// ─── EDIT APPOINTMENT (Admin) ─────────────
let editingApptId = null;
let editingApptNewSlot = null;

function openEditAppt(id) {
  const a = state.appointments.find(x => x.id===id);
  if (!a) return;
  editingApptId = id;
  editingApptNewSlot = a.slot;
  document.getElementById('editApptInfo').innerHTML =
    `Cliente: <strong style="color:var(--a-text)">${a.clientName}</strong><br>` +
    `Trattamento: <strong style="color:var(--a-gold)">${a.service}</strong><br>` +
    `Data: ${fmtDate(a.date)}  ·  Orario attuale: ${a.slot}`;

  // Render available slots (exclude booked ones except current)
  const booked = state.appointments
    .filter(x => x.status==='upcoming' && x.id!==id && new Date(x.date).toDateString()===new Date(a.date).toDateString())
    .map(x => x.slot);
  const allSlots = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
  document.getElementById('adminEditSlots').innerHTML = allSlots.map(t => {
    const isCurrent = t===a.slot;
    const unavail = booked.includes(t);
    return `<div class="tsl${isCurrent?' sel-t':''}${unavail?' unavail':''}" 
      style="background:${isCurrent?'var(--a-gold)':''};color:${isCurrent?'#0a0705':''};border-color:${isCurrent?'var(--a-gold)':''}"
      onclick="${unavail?'':('selectAdminSlot(this,\''+t+'\')')}">${t}</div>`;
  }).join('');

  document.getElementById('editApptNote').value = a.notes || '';
  document.getElementById('editApptOv').classList.add('open');
}

function selectAdminSlot(el, time) {
  document.querySelectorAll('#adminEditSlots .tsl').forEach(s => {
    s.classList.remove('sel-t');
    s.style.background=''; s.style.color=''; s.style.borderColor='';
  });
  el.classList.add('sel-t');
  el.style.background='var(--a-gold)'; el.style.color='#0a0705'; el.style.borderColor='var(--a-gold)';
  editingApptNewSlot = time;
}

function saveApptEdit() {
  const a = state.appointments.find(x => x.id===editingApptId);
  if (!a) return;
  const oldSlot = a.slot;
  const clientName = a.clientName;
  a.slot  = editingApptNewSlot;
  a.notes = document.getElementById('editApptNote').value;
  saveAppts();
  closeSheet('editApptOv');
  renderAdminAgenda();
  updateHomeNextAppt();
  // Notifica push modifica → cliente + admin
  if (window.GSBPush && oldSlot !== editingApptNewSlot) {
    window.GSBPush.notifyEdit(a.service, fmtDate(a.date), editingApptNewSlot, oldSlot, clientName);
  }
  showToast('✓ Appuntamento modificato!', true);
}

// ─── CANCEL APPOINTMENT (Admin) ───────────
let cancellingApptId = null;

function openCancelAppt(id) {
  const a = state.appointments.find(x => x.id===id);
  if (!a) return;
  cancellingApptId = id;
  document.getElementById('cancelApptInfo').innerHTML =
    `Cliente: <strong style="color:var(--a-text)">${a.clientName}</strong><br>` +
    `Trattamento: <strong style="color:var(--a-red)">${a.service}</strong><br>` +
    `Data: ${fmtDate(a.date)}  ·  Orario: ${a.slot}`;
  document.getElementById('cancelApptOv').classList.add('open');
}

function confirmAdminCancel() {
  const a = state.appointments.find(x => x.id===cancellingApptId);
  if (a) {
    const oldDate = fmtDate(a.date);
    const clientName = a.clientName;
    a.status = 'cancelled';
    saveAppts();
    renderAdminAgenda();
    updateHomeNextAppt();
    renderAppointments();
    // Notifica push annullamento → cliente + admin
    if (window.GSBPush) {
      window.GSBPush.notifyCancel(a.service, oldDate, clientName);
    }
  }
  closeSheet('cancelApptOv');
  showToast('Appuntamento annullato', true);
}

// ─── SERVICES ────────────────────────────
const EMOJIS = ['🌸','💧','✨','🌟','🫧','🌿','💎','🪷','🫶','💆','🌺','🍃','🧴','🫐','🌹'];
let editingSvcId = null;
let selectedEmo = '🌸';
let deletingId = null;
let deleteType = null;

function renderHomeServices() {
  document.getElementById('homeServices').innerHTML = state.services.filter(s=>s.active).map(s =>
    `<div class="scard" onclick="quickBook(${s.id})">
      <span class="se">${s.emo}</span><div class="sn">${s.name}</div>
      <div class="sd">${s.dur} min</div><div class="sp">€${s.price}</div>
    </div>`).join('');
}

function renderHomePromos() {
  const active = state.promos.filter(p=>p.active);
  document.getElementById('homePromos').innerHTML = active.length
    ? active.map(p => `
      <div class="promo">
        <div class="pbadge">${p.badge}</div>
        <div class="ptitle-c">${p.title}</div>
        <div class="pdesc-c">${p.desc}</div>
        <div class="pdisc">${p.discount}</div>
      </div>`).join('')
    : '<div style="font-size:0.72rem;color:var(--muted);padding:10px 0">Nessuna promozione attiva al momento</div>';
}

function renderBookingServices() {
  document.getElementById('bookingServices').innerHTML = state.services.filter(s=>s.active).map(s =>
    `<div class="si" id="bsi-${s.id}" onclick="selectService(${s.id})">
      <div class="si-ico">${s.emo}</div>
      <div><div class="si-nm">${s.name}</div><div class="si-mt">${s.dur} min · ${s.desc}</div></div>
      <div class="si-pr">€${s.price}</div><div class="chk">✓</div>
    </div>`).join('');
}

function renderAdminServices() {
  document.getElementById('admSvcList').innerHTML = state.services.map(s => `
    <div class="a-svc" style="${s.active?'':'opacity:0.42'}">
      <span class="a-svc-emo">${s.emo}</span>
      <div class="a-svc-body">
        <div class="a-svc-name">${s.name}</div>
        <div class="a-svc-meta">${s.dur} min · €${s.price} · ${s.desc}</div>
      </div>
      <div class="a-svc-acts">
        <button class="a-act-btn" style="background:rgba(90,184,122,${s.active?'0.12':'0.05'});color:${s.active?'var(--a-green)':'rgba(245,232,216,0.25)'}" onclick="toggleSvc(${s.id})">${s.active?'👁':'🚫'}</button>
        <button class="a-act-btn a-edit-btn" onclick="openEditSvcSheet(${s.id})">✏️</button>
        <button class="a-act-btn a-del-btn" onclick="openDelSheet(${s.id},'svc','${s.name}')">🗑</button>
      </div>
    </div>`).join('');
}

function renderAdminPromos() {
  const c = document.getElementById('admPromoList');
  if (!state.promos.length) {
    c.innerHTML = `<div style="text-align:center;padding:30px 0;opacity:0.4">
      <div style="font-size:2rem;margin-bottom:8px">🏷️</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--a-muted)">Nessuna promozione</div>
    </div>`; return;
  }
  c.innerHTML = state.promos.map(p => `
    <div class="a-promo">
      <div class="a-promo-top">
        <span class="a-promo-badge">${p.badge}</span>
        <div class="a-promo-acts">
          <button class="a-promo-toggle ${p.active?'active':'inactive'}" onclick="togglePromo(${p.id})">${p.active?'✓ Attiva':'✗ Off'}</button>
          <button class="a-act-btn a-edit-btn" style="margin-left:4px" onclick="openEditPromoSheet(${p.id})">✏️</button>
          <button class="a-act-btn a-del-btn" style="margin-left:4px" onclick="openDelSheet(${p.id},'promo','${p.title}')">🗑</button>
        </div>
      </div>
      <div class="a-promo-title">${p.title}</div>
      <div class="a-promo-desc">${p.desc}</div>
      <div class="a-promo-discount">${p.discount}</div>
    </div>`).join('');
}

function renderAdminClienti() {
  const clients = {};
  state.appointments.forEach(a => {
    if (!a.clientName) return;
    if (!clients[a.clientName]) clients[a.clientName] = {name:a.clientName,phone:a.clientPhone||'',count:0,spent:0,last:''};
    clients[a.clientName].count++;
    clients[a.clientName].spent += parseInt((a.price||'€0').replace('€',''));
    clients[a.clientName].last = a.service;
  });
  const list = Object.values(clients);
  const c = document.getElementById('admClienti');
  if (!list.length) {
    c.innerHTML = `<div style="text-align:center;padding:30px 0;opacity:0.4">
      <div style="font-size:2rem;margin-bottom:8px">👥</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--a-muted)">Nessuna cliente ancora</div>
    </div>`; return;
  }
  c.innerHTML = list.map(cl => `
    <div class="a-client-card">
      <div class="a-cc-top">
        <div class="a-cc-av">💆</div>
        <div><div class="a-cc-name">${cl.name}</div><div class="a-cc-phone">${cl.phone||'Tel. non inserito'}</div></div>
      </div>
      <div class="a-cc-stats">
        <div class="a-cc-stat"><div class="a-cc-n">${cl.count}</div><div class="a-cc-l">Trattamenti</div></div>
        <div class="a-cc-stat"><div class="a-cc-n">€${cl.spent}</div><div class="a-cc-l">Speso</div></div>
      </div>
      <div class="a-cc-last">Ultimo: ${cl.last}</div>
    </div>`).join('');
}

// ─── EMOJI PICKER ─────────────────────────
function renderEmojiPicker(current) {
  selectedEmo = current || '🌸';
  document.getElementById('emoRow').innerHTML = EMOJIS.map(e =>
    `<div class="emo-opt${e===selectedEmo?' sel':''}" onclick="selectEmo('${e}',this)">${e}</div>`).join('');
}
function selectEmo(emo, el) {
  selectedEmo = emo;
  document.querySelectorAll('.emo-opt').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
}

// ─── SERVICE SHEET ────────────────────────
function openAddSvcSheet() {
  editingSvcId = null;
  document.getElementById('editSvcTitle').textContent = '+ Nuovo Servizio';
  renderEmojiPicker('🌸');
  ['inp-name','inp-desc','inp-price'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('inp-dur').value='60';
  document.getElementById('editSvcOv').classList.add('open');
}
function openEditSvcSheet(id) {
  const s = state.services.find(x=>x.id===id); if(!s) return;
  editingSvcId = id;
  document.getElementById('editSvcTitle').textContent = 'Modifica Servizio';
  renderEmojiPicker(s.emo);
  document.getElementById('inp-name').value = s.name;
  document.getElementById('inp-desc').value = s.desc;
  document.getElementById('inp-dur').value  = s.dur;
  document.getElementById('inp-price').value= s.price;
  document.getElementById('editSvcOv').classList.add('open');
}
function saveService() {
  const name  = document.getElementById('inp-name').value.trim();
  const desc  = document.getElementById('inp-desc').value.trim();
  const dur   = parseInt(document.getElementById('inp-dur').value)||60;
  const price = parseInt(document.getElementById('inp-price').value)||0;
  if (!name)  { showToast('⚠️ Inserisci il nome', true); return; }
  if (!price) { showToast('⚠️ Inserisci il prezzo', true); return; }
  if (editingSvcId) {
    const s = state.services.find(x=>x.id===editingSvcId);
    Object.assign(s, {emo:selectedEmo,name,desc,dur,price});
    showToast('✓ Servizio aggiornato!', true);
  } else {
    state.services.push({id:Date.now(),emo:selectedEmo,name,desc,dur,price,active:true});
    showToast('✓ Servizio aggiunto!', true);
  }
  saveServices(); closeSheet('editSvcOv');
  renderAdminServices(); renderHomeServices(); renderBookingServices();
}
function toggleSvc(id) {
  const s = state.services.find(x=>x.id===id); if(!s) return;
  s.active = !s.active; saveServices();
  renderAdminServices(); renderHomeServices(); renderBookingServices();
  showToast(s.active?'👁 Servizio attivato':'🚫 Disattivato', true);
}

// ─── PROMO SHEET ──────────────────────────
let editingPromoId = null;
function openAddPromoSheet() {
  editingPromoId = null;
  document.getElementById('editPromoTitle').textContent = '+ Nuova Promozione';
  ['promo-badge','promo-title','promo-desc','promo-discount'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('editPromoOv').classList.add('open');
}
function openEditPromoSheet(id) {
  const p = state.promos.find(x=>x.id===id); if(!p) return;
  editingPromoId = id;
  document.getElementById('editPromoTitle').textContent = 'Modifica Promozione';
  document.getElementById('promo-badge').value    = p.badge;
  document.getElementById('promo-title').value    = p.title;
  document.getElementById('promo-desc').value     = p.desc;
  document.getElementById('promo-discount').value = p.discount;
  document.getElementById('editPromoOv').classList.add('open');
}
function savePromo() {
  const badge    = document.getElementById('promo-badge').value.trim();
  const title    = document.getElementById('promo-title').value.trim();
  const desc     = document.getElementById('promo-desc').value.trim();
  const discount = document.getElementById('promo-discount').value.trim();
  if (!title) { showToast('⚠️ Inserisci il titolo', true); return; }
  if (editingPromoId) {
    const p = state.promos.find(x=>x.id===editingPromoId);
    Object.assign(p, {badge,title,desc,discount});
    showToast('✓ Promozione aggiornata!', true);
  } else {
    state.promos.push({id:Date.now(),badge:badge||'✦ Offerta',title,desc,discount:discount||'−%',active:true});
    showToast('✓ Promozione aggiunta!', true);
  }
  savePromos(); closeSheet('editPromoOv');
  renderAdminPromos(); renderHomePromos();
}
function togglePromo(id) {
  const p = state.promos.find(x=>x.id===id); if(!p) return;
  p.active = !p.active; savePromos();
  renderAdminPromos(); renderHomePromos();
  showToast(p.active?'✓ Promo attivata':'Promo disattivata', true);
}

// ─── DELETE ───────────────────────────────
function openDelSheet(id, type, name) {
  deletingId = id; deleteType = type;
  document.getElementById('delText').textContent = `Stai per eliminare "${name}". Questa azione è irreversibile.`;
  document.getElementById('delOv').classList.add('open');
}
function confirmDel() {
  if (deleteType==='svc') {
    state.services = state.services.filter(x=>x.id!==deletingId);
    saveServices(); renderAdminServices(); renderHomeServices(); renderBookingServices();
  } else if (deleteType==='promo') {
    state.promos = state.promos.filter(x=>x.id!==deletingId);
    savePromos(); renderAdminPromos(); renderHomePromos();
  }
  closeSheet('delOv');
  showToast('🗑 Eliminato', true);
}

// ─── SHEETS ───────────────────────────────
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }

// ─── BOOKING ─────────────────────────────
function quickBook(id) { navTo('booking',1); setTimeout(()=>selectService(id),100); }

function selectService(id) {
  const s = state.services.find(x=>x.id===id); if(!s) return;
  document.querySelectorAll('.si').forEach(i=>i.classList.remove('sel'));
  const el = document.getElementById('bsi-'+id); if(el) el.classList.add('sel');
  state.booking.service = s.name; state.booking.dur = s.dur+' min'; state.booking.price = '€'+s.price;
  document.getElementById('s1btn').disabled = false;
}

function goStep2() {
  document.getElementById('bs1').style.display='none'; document.getElementById('bs2').style.display='block';
  document.getElementById('sd1').classList.replace('active','done'); document.getElementById('sd2').classList.add('active');
  renderCal();
}
function goBack1() {
  document.getElementById('bs2').style.display='none'; document.getElementById('bs1').style.display='block';
  document.getElementById('sd2').classList.remove('active','done');
  document.getElementById('sd1').classList.remove('done'); document.getElementById('sd1').classList.add('active');
}
function goStep3() {
  document.getElementById('bs2').style.display='none'; document.getElementById('bs3').style.display='block';
  document.getElementById('sd2').classList.replace('active','done'); document.getElementById('sd3').classList.add('active');
  document.getElementById('cs').textContent = state.booking.service;
  document.getElementById('cd').textContent = fmtDate(state.booking.date);
  document.getElementById('ct').textContent = state.booking.slot;
  document.getElementById('cdur').textContent = state.booking.dur;
  document.getElementById('cpr').textContent = state.booking.price;
}
function goBack2() {
  document.getElementById('bs3').style.display='none'; document.getElementById('bs2').style.display='block';
  document.getElementById('sd3').classList.remove('active');
  document.getElementById('sd2').classList.remove('done'); document.getElementById('sd2').classList.add('active');
}

function confirmBooking() {
  const name = document.getElementById('bkName').value.trim();
  if (!name) { showToast('⚠️ Inserisci il tuo nome'); return; }
  const appt = {
    id:Date.now(), service:state.booking.service, dur:state.booking.dur, price:state.booking.price,
    date:state.booking.date, slot:state.booking.slot, clientName:name,
    clientPhone:document.getElementById('bkPhone').value, notes:document.getElementById('bkNotes').value,
    status:'upcoming', createdAt:new Date().toISOString()
  };
  state.appointments.unshift(appt); saveAppts();
  if (name) {
    state.profile.name=name; localStorage.setItem('gsb_profile',JSON.stringify(state.profile));
    document.getElementById('userName').textContent = name.split(' ')[0];
    document.getElementById('profName').textContent = name;
  }
  updateHomeNextAppt();
  document.getElementById('sucMsg').textContent = state.booking.service+' — '+fmtDate(state.booking.date)+' alle '+state.booking.slot+'\nRiceverai un promemoria 24h prima. 🌸';
  document.getElementById('sucOv').classList.add('show');
  if (window.GSBPush && window.GSBPush.isEnabled()) {
    window.GSBPush.notifyBooking(
      state.booking.service, fmtDate(state.booking.date),
      state.booking.slot, name
    );
  } else {
    // Anche senza sub cliente, notifica l'admin
    if (window.GSBPush) {
      fetch(SERVER_URL + '/notify/booking', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          clientId: 'no-sub', service: state.booking.service,
          date: fmtDate(state.booking.date), time: state.booking.slot,
          clientName: name
        })
      }).catch(()=>{});
    }
  }
  resetBooking();
}

function closeSuc() {
  document.getElementById('sucOv').classList.remove('show');
  navTo('appointments',2);
}

function resetBooking() {
  state.booking={service:null,dur:null,price:null,date:null,slot:null};
  document.querySelectorAll('.si').forEach(i=>i.classList.remove('sel'));
  document.getElementById('s1btn').disabled=true; document.getElementById('s2btn').disabled=true;
  document.getElementById('bs1').style.display='block';
  document.getElementById('bs2').style.display='none'; document.getElementById('bs3').style.display='none';
  ['sd1','sd2','sd3'].forEach(s=>{const el=document.getElementById(s);el.classList.remove('active','done');});
  document.getElementById('sd1').classList.add('active');
  document.getElementById('bkName').value=state.profile.name!=='Bella'?state.profile.name:'';
  document.getElementById('bkPhone').value=state.profile.phone||''; document.getElementById('bkNotes').value='';
}

// ─── CALENDAR ────────────────────────────
const MONTHS_IT=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT=['D','L','M','M','G','V','S'];

function renderCal() {
  const {year,month}=state.calendar;
  document.getElementById('calMo').textContent=MONTHS_IT[month]+' '+year;
  const grid=document.getElementById('cgrid'); grid.innerHTML='';
  DAYS_IT.forEach(d=>{const el=document.createElement('div');el.className='cdlbl';el.textContent=d;grid.appendChild(el);});
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  for(let i=0;i<firstDay;i++){const e=document.createElement('div');e.className='cd emp';grid.appendChild(e);}
  for(let d=1;d<=daysInMonth;d++){
    const dobj=new Date(year,month,d); const dw=dobj.getDay();
    const btn=document.createElement('div'); btn.className='cd'; btn.textContent=d;
    if(dw===0) btn.classList.add('sun');
    else if(dobj<today) btn.classList.add('dis');
    else {
      if(dobj.getTime()===today.getTime()) btn.classList.add('today');
      if(state.booking.date&&dobj.toDateString()===new Date(state.booking.date).toDateString()) btn.classList.add('sel-d');
      btn.onclick=()=>selDate(dobj,btn);
    }
    grid.appendChild(btn);
  }
}
function selDate(d,btn){
  state.booking.date=d; state.booking.slot=null;
  document.querySelectorAll('.cd').forEach(b=>b.classList.remove('sel-d')); btn.classList.add('sel-d');
  renderSlots(d); document.getElementById('s2btn').disabled=true;
}
function prevMo(){if(state.calendar.month===0){state.calendar.month=11;state.calendar.year--;}else state.calendar.month--;renderCal();}
function nextMo(){if(state.calendar.month===11){state.calendar.month=0;state.calendar.year++;}else state.calendar.month++;renderCal();}
function renderSlots(d){
  const grid=document.getElementById('tslots'); grid.innerHTML='';
  const booked=state.appointments.filter(a=>a.status==='upcoming'&&new Date(a.date).toDateString()===d.toDateString()).map(a=>a.slot);
  const allSlots=['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
  const now=new Date(); const isToday=d.toDateString()===now.toDateString();
  allSlots.forEach(t=>{
    const[h,m]=t.split(':').map(Number);
    const el=document.createElement('div'); el.className='tsl'; el.textContent=t;
    const past=isToday&&(h<now.getHours()||(h===now.getHours()&&m<=now.getMinutes()));
    if(booked.includes(t)||past) el.classList.add('unavail');
    else el.onclick=()=>{document.querySelectorAll('.tsl').forEach(s=>s.classList.remove('sel-t'));el.classList.add('sel-t');state.booking.slot=t;document.getElementById('s2btn').disabled=false;};
    grid.appendChild(el);
  });
}

// ─── APPOINTMENTS ─────────────────────────
function renderAppointments(){
  renderApptList('upList',state.appointments.filter(a=>a.status==='upcoming'),true);
  renderApptList('pastList',state.appointments.filter(a=>a.status!=='upcoming'),false);
}
function renderApptList(id,items,isUp){
  const c=document.getElementById(id);
  if(!items.length){c.innerHTML=`<div class="empty-state"><div class="ei">${isUp?'🗓️':'📋'}</div><h3>${isUp?'Nessun appuntamento':'Nessuno storico'}</h3><p>${isUp?'Prenota il tuo primo trattamento 🌸':'I trattamenti completati appariranno qui'}</p></div>`;return;}
  c.innerHTML=items.map(a=>`
    <div class="acard">
      <div class="ah"><div class="asvc">${a.service}</div><span class="abadge">${isUp?'Confermato':'Completato'}</span></div>
      <div class="adets"><div class="adet">📅 ${fmtDate(a.date)}</div><div class="adet">🕐 ${a.slot}</div><div class="adet">⏱ ${a.dur}</div><div class="adet">💰 ${a.price}</div></div>
      ${isUp?`<div class="aacts"><button class="abtn abtn-c" onclick="cancelApptClient(${a.id})">Annulla</button><button class="abtn abtn-r" onclick="navTo('booking',1)">Riprenota</button></div>`:
      `<div class="aacts"><button class="abtn abtn-r" onclick="navTo('booking',1)">Prenota di nuovo</button></div>`}
    </div>`).join('');
}
function cancelApptClient(id){
  if(!confirm('Vuoi annullare questo appuntamento?')) return;
  const a=state.appointments.find(x=>x.id===id);
  if(a){a.status='cancelled';saveAppts();renderAppointments();updateHomeNextAppt();renderAdminAgenda();}
}
function swTab(tab,btn){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');
  document.getElementById('upList').style.display=tab==='up'?'block':'none';
  document.getElementById('pastList').style.display=tab==='past'?'block':'none';
}

// ─── HOME NEXT APPT ───────────────────────
function updateHomeNextAppt(){
  const next=state.appointments.find(a=>a.status==='upcoming');
  document.getElementById('ncSvc').textContent=next?next.service:'Nessun appuntamento';
  document.getElementById('ncDate').textContent=next?'📅 '+fmtDate(next.date):'📅 Prenota ora';
  document.getElementById('ncTime').textContent=next?'🕐 '+next.slot:'';
}

// ─── PROFILE STATS ───────────────────────
function updateProfileStats(){
  document.getElementById('stTot').textContent=state.appointments.filter(a=>a.status!=='cancelled').length;
  document.getElementById('stUp').textContent=state.appointments.filter(a=>a.status==='upcoming').length;
  if(state.profile.name&&state.profile.name!=='Bella') document.getElementById('profName').textContent=state.profile.name;
}

// ─── CHAT ────────────────────────────────
const REPLIES=['Certo! Sono qui per aiutarti 🌸','Grazie per avermi scritto ✨','I nostri trattamenti partono da €55. Vuoi info?','Siamo aperti lun–sab 9:00–18:00 🌸','Dai un\'occhiata alle promo in Home! 💫','Prenota dall\'app in 3 semplici passi!'];
function sendMsg(){
  const inp=document.getElementById('chatIn'); const txt=inp.value.trim(); if(!txt) return;
  const t=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  appendMsg(txt,true,t,true); inp.value='';
  setTimeout(()=>{const r=REPLIES[Math.floor(Math.random()*REPLIES.length)];const t2=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});appendMsg(r,false,t2,true);},900+Math.random()*700);
}
function appendMsg(text,mine,time,save){
  const c=document.getElementById('chatMsgs');
  const d=document.createElement('div'); d.className='cm'+(mine?' mine':'');
  d.innerHTML=mine?`<div><div class="cmbub">${text}</div><div class="cmt">${time}</div></div>`:
    `<div class="cmav">💆</div><div><div class="cmbub">${text}</div><div class="cmt">${time}</div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
  if(save){state.messages.push({text,mine,time});localStorage.setItem('gsb_msgs',JSON.stringify(state.messages.slice(-50)));}
}

// ─── MODALS ───────────────────────────────
function closeModal(){document.getElementById('modalOv').classList.remove('open');}
function showNotifications(){
  document.getElementById('modalBody').innerHTML=`
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:300;margin-bottom:16px;color:var(--dark)">Notifiche</div>
    <div style="background:rgba(196,132,106,0.08);border-radius:11px;padding:13px;border-left:3px solid var(--copper);margin-bottom:9px">
      <div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--copper);margin-bottom:5px">Promemoria</div>
      <div style="font-size:0.8rem;color:var(--dark)">Ricorda di prenotare il tuo trattamento mensile! 🌸</div>
    </div>
    <div style="background:rgba(212,165,160,0.08);border-radius:11px;padding:13px;border-left:3px solid var(--rose)">
      <div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--rose);margin-bottom:5px">Promozione</div>
      <div style="font-size:0.8rem;color:var(--dark)">Scopri le offerte del mese nella Home 💫</div>
    </div>`;
  document.getElementById('modalOv').classList.add('open');
}
function showInstallGuide(){
  document.getElementById('modalBody').innerHTML=`
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:300;margin-bottom:16px;color:var(--dark)">📱 Installa l'App</div>
    <div style="background:rgba(240,221,214,0.3);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;margin-bottom:7px">🍎 iPhone/iPad</div>
      <ol style="padding-left:16px;font-size:0.74rem;color:var(--muted);line-height:2">
        <li>Apri in <strong>Safari</strong></li><li>Tocca <strong>Condividi</strong> (□↑)</li><li>Tocca <strong>Aggiungi a schermata Home</strong></li>
      </ol>
    </div>
    <div style="background:rgba(240,221,214,0.3);border-radius:12px;padding:14px">
      <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;margin-bottom:7px">🤖 Android</div>
      <ol style="padding-left:16px;font-size:0.74rem;color:var(--muted);line-height:2">
        <li>Apri in <strong>Chrome</strong></li><li>Tocca i <strong>3 puntini</strong></li><li>Tocca <strong>Aggiungi a schermata Home</strong></li>
      </ol>
    </div>`;
  document.getElementById('modalOv').classList.add('open');
}

// ─── PUSH ────────────────────────────────
async function togglePush(){
  const enabled=localStorage.getItem('gsb_push_enabled')==='true';
  if(enabled){if(confirm('Disattivare le notifiche push?'))await window.GSBPush.unsubscribe();}
  else await window.GSBPush.subscribe(state.profile.name||'Cliente');
}

// ─── TOAST ───────────────────────────────
function showToast(msg, isAdmin=false){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show '+(isAdmin?'admin-toast':'client-toast');
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ─── UTILS ───────────────────────────────
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'long'});}

// ─── PWA ─────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
document.getElementById('installBtn').addEventListener('click',async()=>{
  if(deferredPrompt){deferredPrompt.prompt();const{outcome}=await deferredPrompt.userChoice;if(outcome==='accepted')document.getElementById('installBanner').classList.add('hidden');deferredPrompt=null;}
  else showInstallGuide();
});
if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}
