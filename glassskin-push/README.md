# 🌸 Glass Skin Beauty — Push Notifications Setup

## Struttura file

```
glassskin-push/
├── index.html          ← PWA (aggiornata con push)
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker (gestisce push)
├── server.js           ← Backend Node.js (invia push)
├── package.json
├── js/
│   ├── app.js          ← Logica app
│   └── push.js         ← Modulo notifiche push
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 Come avviare il server

### 1. Installa dipendenze (una volta sola)
```bash
npm install
```

### 2. Avvia il server
```bash
node server.js
```
Il server risponde su **http://localhost:3000**

---

## 📲 Come funziona il flusso push

### Lato CLIENT (automatico nell'app):

1. **Prima apertura** → banner "Attiva Notifiche Push" nella pagina Profilo
2. **Tap sul bottone** → browser chiede permesso notifiche
3. **Permesso concesso** → subscription salvata sul server
4. **Prenotazione confermata** → push inviata istantaneamente
5. **24h prima** → promemoria automatico

### Lato SERVER (API disponibili):

```bash
# Invia notifica di conferma prenotazione
curl -X POST http://localhost:3000/notify/booking \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_xxx","service":"Facciale Idratante","date":"Gio 15 Maggio","time":"10:00"}'

# Invia promozione a TUTTI i clienti iscritti
curl -X POST http://localhost:3000/notify/promo \
  -H "Content-Type: application/json" \
  -d '{"title":"✨ Offerta Maggio!","body":"−20% su tutti i trattamenti questo weekend 🌸"}'

# Invia promemoria
curl -X POST http://localhost:3000/notify/reminder \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_xxx","service":"Pulizia Profonda","time":"14:00"}'

# Invia notifica annullamento
curl -X POST http://localhost:3000/notify/cancellation \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_xxx","service":"Anti-età","date":"Gio 15 Maggio"}'

# Vedi tutti i clienti iscritti
curl http://localhost:3000/admin/subscriptions
```

---

## 🔔 Tipi di notifica

| Tipo | Trigger | Azioni |
|------|---------|--------|
| `booking-confirm` | Dopo ogni prenotazione | Vedi appuntamento |
| `reminder` | 24h prima (cron job) | Dettagli |
| `promo` | Manuale da admin | Scopri offerta |
| `cancellation` | Dopo annullamento | Riprenota |

---

## ⚙️ Configurazione promemoria automatici (cron)

Per inviare promemoria in automatico, aggiungi un cron job sul server:

```bash
# Ogni mattina alle 10 controlla appuntamenti del giorno dopo
0 10 * * * node /path/to/glassskin-push/cron-reminders.js
```

---

## 🌐 Deploy su produzione

1. **Carica su Netlify/Vercel/Railway** (supportano Node.js)
2. **HTTPS obbligatorio** per le notifiche push (Netlify lo fornisce gratis)
3. **Aggiorna `SERVER_URL`** in `js/push.js` con l'URL del tuo server

---

## 📱 Compatibilità

| Browser/OS | Supporto |
|-----------|---------|
| Chrome Android | ✅ Completo |
| Safari iOS 16.4+ | ✅ Completo |
| Firefox | ✅ Completo |
| Samsung Browser | ✅ Completo |
| Safari iOS < 16.4 | ❌ Non supportato |

> **Nota iOS**: l'utente deve prima **installare la PWA** sulla schermata Home prima di ricevere notifiche push su iPhone/iPad.
