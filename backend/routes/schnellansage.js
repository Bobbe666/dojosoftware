// Backend/routes/schnellansage.js
// ─────────────────────────────────────────────────────────────────────────────
// SCHNELL-ANSAGE TOOL
// Kurzfristige Trainingszeit-Änderungen in Sekunden als Popup veröffentlichen
// (erscheint in der Mitglieder-App UND auf der Homepage tda-vib.de, läuft selbst ab).
//
// v1 (jetzt): Token-geschützt, KEIN Login. Fest für Kampfkunstschule Schreiner (dojo 3).
//             Die betroffenen Stunden werden aus dem Kursplan (dojo 3) geladen.
//
// Enterprise-Produktivversion (später): statt Token → echtes Auth + requireFeature('schnellansage'),
//             und DOJO_ID aus req.user.dojo_id statt Konstante. Die Kernlogik (POST) bleibt gleich.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { notifyAdminsTrainerAnsage } = require('../services/trainerAnsageNotify');

const DOJO_ID = 3;   // Kampfkunstschule Schreiner (Default für Token-Pfad)
const AUTOR_ID = 1;  // Super-Admin als Autor (Token-Pfad)
const TOKEN = process.env.SCHNELLANSAGE_TOKEN;

const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Zieltag/-datum (Europe/Berlin) für 'heute' | 'morgen' | 'YYYY-MM-DD'
function zielDatum(datum) {
  // Explizites Datum (Vertretung im Voraus planen)
  if (typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    const d = new Date(`${datum}T12:00:00`);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { dayName: TAGE[d.getDay()], dateStr: `${yyyy}-${mm}-${dd}`,
             label: `${TAGE[d.getDay()]}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}` };
  }
  const berlin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  if (datum === 'morgen') berlin.setDate(berlin.getDate() + 1);
  const yyyy = berlin.getFullYear();
  const mm = String(berlin.getMonth() + 1).padStart(2, '0');
  const dd = String(berlin.getDate()).padStart(2, '0');
  return { dayName: TAGE[berlin.getDay()], dateStr: `${yyyy}-${mm}-${dd}`,
           label: `${datum === 'morgen' ? 'morgen' : 'heute'}, ${TAGE[berlin.getDay()]} ${berlin.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}` };
}

// Popup (News-Artikel) anlegen — gemeinsam für Token- und Login-Pfad.
async function insertAnsagePopup({ titel, nachricht, datum, dojoId, autorId }) {
  const istMorgen = datum === 'morgen';
  const statusSql     = istMorgen ? "'geplant'" : "'veroeffentlicht'";
  const veroeffentSql = istMorgen ? "NULL" : "NOW()";
  const geplantSql    = istMorgen ? "DATE_ADD(CURDATE(), INTERVAL 1 DAY)" : "NULL";
  const ablaufSql     = istMorgen ? "DATE_ADD(CURDATE(), INTERVAL 2 DAY)" : "DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
  const [result] = await db.promise().query(
    `INSERT INTO news_articles
       (titel, inhalt, kurzbeschreibung, zielgruppe, status, autor_id,
        veroeffentlicht_am, geplant_am, dojo_id, als_popup, ablauf_am, kategorie)
     VALUES (?, '', ?, 'alle_dojos', ${statusSql}, ?,
        ${veroeffentSql}, ${geplantSql}, ?, 1, ${ablaufSql}, 'allgemein')`,
    [titel, nachricht, autorId, dojoId]
  );
  return result.insertId;
}

// trainer_ids-JSON robust zu Zahl-Array (Legacy/Fehlformate tolerieren).
function parseTrainerIds(val) {
  if (Array.isArray(val)) return val.map(Number).filter(n => !isNaN(n));
  if (typeof val === 'string' && val.trim()) {
    try { const a = JSON.parse(val); return Array.isArray(a) ? a.map(Number).filter(n => !isNaN(n)) : []; }
    catch { return []; }
  }
  return [];
}

// Liefert die Kurs-IDs, die ein Trainer am Zieltag bearbeiten darf
// (eigene Kurse + zugewiesene Vertretungsstunden). Admin → alle Kurse des Dojos.
// trainerIds = Kandidaten-Set (Trainer können dojo-übergreifend zugeordnet sein,
// z.B. HQ-Trainer dojo_id=1, der Kurse in Dojo 3 gibt).
async function erlaubteKursIds({ dojoId, trainerIds, dateStr, istAdmin }) {
  const pool = db.promise();
  const [kurse] = await pool.query(
    'SELECT kurs_id, trainer_id, trainer_ids FROM kurse WHERE dojo_id = ?', [dojoId]
  );
  if (istAdmin) return new Set(kurse.map(k => k.kurs_id));

  const ids = (trainerIds || []).map(Number).filter(n => !isNaN(n));
  if (!ids.length) return new Set();
  const idSet = new Set(ids);

  const erlaubt = new Set();
  for (const k of kurse) {
    if (idSet.has(Number(k.trainer_id))) erlaubt.add(k.kurs_id);
    else if (parseTrainerIds(k.trainer_ids).some(t => idSet.has(t))) erlaubt.add(k.kurs_id);
  }
  // Vertretungsstunden für genau diesen Tag
  const [vert] = await pool.query(
    `SELECT kurs_id FROM vertretung_anfragen
      WHERE vertretung_trainer_id IN (?) AND datum = ? AND status <> 'abgelehnt'`,
    [ids, dateStr]
  );
  vert.forEach(v => erlaubt.add(v.kurs_id));
  return erlaubt;
}

// Trainer-Kontext aus dem JWT. Da admin_users.trainer_id i.d.R. NICHT befüllt ist,
// werden die passenden trainer-Zeilen über E-Mail bzw. Name aufgelöst —
// dojo-übergreifend (HQ-Trainer geben Kurse in den Schulen) → Kandidaten-Set.
async function trainerKontext(req) {
  const role = req.user?.role;
  const istAdmin = ['admin', 'super_admin'].includes(role);
  const dojoId = req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null) || DOJO_ID;
  const name = `${req.user?.vorname || ''} ${req.user?.nachname || ''}`.trim() || req.user?.username || 'Trainer';

  let trainerIds = [];
  if (!istAdmin) {
    if (req.user?.trainer_id) trainerIds.push(Number(req.user.trainer_id));
    const email = (req.user?.email || '').trim();
    const vorname = (req.user?.vorname || '').trim();
    const nachname = (req.user?.nachname || '').trim();
    const conds = [], params = [];
    if (email) { conds.push('email = ?'); params.push(email); }
    if (vorname && nachname) { conds.push('(vorname = ? AND nachname = ?)'); params.push(vorname, nachname); }
    if (conds.length) {
      const [rows] = await db.promise().query(
        `SELECT trainer_id FROM trainer WHERE ${conds.join(' OR ')}`, params
      );
      rows.forEach(r => trainerIds.push(Number(r.trainer_id)));
    }
    trainerIds = [...new Set(trainerIds.filter(n => !isNaN(n)))];
  }
  return { istAdmin, dojoId, trainerIds, trainerAdminId: req.user?.id || null, name };
}

function requireTrainerOrAdmin(req, res, next) {
  if (!['trainer', 'admin', 'super_admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Trainer- oder Admin-Berechtigung erforderlich.' });
  }
  next();
}

// Token-Prüfung (Query, Body oder Header)
function checkToken(req, res) {
  if (!TOKEN) {
    res.status(503).json({ error: 'Schnell-Ansage ist nicht konfiguriert (SCHNELLANSAGE_TOKEN fehlt).' });
    return false;
  }
  const token = req.query.token || (req.body && req.body.token) || req.headers['x-ansage-token'];
  if (!token || token !== TOKEN) {
    res.status(401).json({ error: 'Zugriff verweigert.' });
    return false;
  }
  return true;
}

// POST /api/schnellansage  — Ansage als News-Popup anlegen
router.post('/', async (req, res) => {
  if (!checkToken(req, res)) return;
  try {
    const titel = (req.body.titel || '').trim();
    const nachricht = (req.body.nachricht || '').trim();
    const datum = req.body.datum === 'morgen' ? 'morgen' : 'heute';

    if (!titel || !nachricht) {
      return res.status(400).json({ error: 'Titel und Nachricht sind erforderlich.' });
    }

    // Zeitsteuerung:
    //  heute  → sofort veröffentlicht, läuft heute Nacht (morgen 00:00) ab
    //  morgen → geplant ab morgen 00:00, läuft übermorgen 00:00 ab
    // kurzbeschreibung trägt den sichtbaren Text (Popup zeigt sie direkt an),
    // inhalt bleibt leer → kein redundanter "Vollständig lesen"-Button.
    const insertId = await insertAnsagePopup({ titel, nachricht, datum, dojoId: DOJO_ID, autorId: AUTOR_ID });

    logger.info('Schnell-Ansage angelegt (Token)', { id: insertId, datum, dojo_id: DOJO_ID });
    res.json({ success: true, id: insertId, wann: datum });
  } catch (e) {
    logger.error('Schnell-Ansage Fehler:', { error: e });
    res.status(500).json({ error: 'Konnte die Ansage nicht speichern.', details: e.message });
  }
});

// GET /api/schnellansage/app  — die Tool-Oberfläche (Token in der URL: ?token=…)
router.get('/app', (req, res) => {
  if (!checkToken(req, res)) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0c0c1c;color:#fff;display:flex;height:100vh;align-items:center;justify-content:center;margin:0"><div style="text-align:center"><div style="font-size:3rem">🔒</div><h2>Zugriff verweigert</h2><p style="color:#888">Bitte den vollständigen Link mit Token verwenden.</p></div></body>`);
  }
  // Globale CSP (script-src 'self') wuerde das Inline-Script dieser Seite blocken.
  // Nur fuer diese eine, in sich geschlossene Tool-Seite Inline-Script/Style erlauben.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; form-action 'self'");
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(PAGE_HTML);
});

// ─── Eingebettete Tool-Oberfläche ────────────────────────────────────────────
const PAGE_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c0c1c">
<title>Schnell-Ansage · Kampfkunstschule Schreiner</title>
<style>
  :root{ --bg:#0c0c1c; --card:#1a1a2e; --accent:#ef4444; --gold:#D4AF37; --line:rgba(255,255,255,.08); --muted:rgba(255,255,255,.55); }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
       background:radial-gradient(1200px 600px at 50% -10%,#1a1a2e 0%,var(--bg) 60%);color:#fff;
       min-height:100vh;padding:1rem 1rem calc(2rem + env(safe-area-inset-bottom));}
  .wrap{max-width:560px;margin:0 auto}
  h1{font-size:1.25rem;margin:.4rem 0 .2rem;display:flex;align-items:center;gap:.5rem}
  .sub{color:var(--muted);font-size:.85rem;margin:0 0 1.2rem}
  .card{background:linear-gradient(135deg,rgba(26,26,46,.99),rgba(12,12,28,1));border:1px solid var(--line);
        border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  label{display:block;font-weight:600;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem}
  .seg{display:flex;gap:.5rem}
  .seg button{flex:1;padding:.7rem;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03);
        color:#fff;font-size:1rem;font-weight:600;cursor:pointer;transition:.15s}
  .seg button.on{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.55);color:#fff}
  .chips{display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0 0}
  .chip{padding:.35rem .7rem;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);
        color:var(--muted);font-size:.82rem;cursor:pointer}
  .chip:active{transform:scale(.97)}
  .stunde{display:flex;align-items:center;gap:.6rem;padding:.55rem .2rem;border-bottom:1px solid var(--line);cursor:pointer}
  .stunde:last-child{border-bottom:none}
  .stunde input{width:20px;height:20px;accent-color:var(--accent);flex:none}
  .stunde .z{font-variant-numeric:tabular-nums;font-weight:700;color:#fff;flex:none;min-width:92px}
  .stunde .k{font-size:.9rem;line-height:1.25}
  .stunde .k small{display:block;color:var(--muted);font-size:.75rem}
  input[type=text],input[type=time],textarea{width:100%;padding:.7rem .8rem;border-radius:10px;border:1px solid var(--line);
        background:rgba(255,255,255,.04);color:#fff;font-size:1rem;font-family:inherit}
  textarea{min-height:96px;resize:vertical;line-height:1.5}
  .row{margin-bottom:.9rem}
  .hint{color:var(--muted);font-size:.78rem;margin:.35rem 0 0}
  .preview{border:1px solid rgba(239,68,68,.4);border-radius:12px;overflow:hidden}
  .preview .ph{padding:.6rem .9rem;background:rgba(239,68,68,.12);border-bottom:1px solid rgba(239,68,68,.2);
        color:var(--accent);font-weight:700;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase}
  .preview .pb{padding:1rem .9rem}
  .preview .pb h3{margin:0 0 .4rem;font-size:1.1rem}
  .preview .pb p{margin:0;color:rgba(255,255,255,.8);font-size:.92rem;line-height:1.5;white-space:pre-line}
  .send{width:100%;padding:.95rem;border-radius:12px;border:none;font-size:1.05rem;font-weight:700;cursor:pointer;
        background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;margin-top:.3rem}
  .send:disabled{opacity:.5}
  .muted{color:var(--muted)}
  .toast{position:fixed;left:1rem;right:1rem;bottom:calc(1rem + env(safe-area-inset-bottom));max-width:528px;margin:0 auto;
        padding:.9rem 1rem;border-radius:12px;font-weight:600;text-align:center;transform:translateY(140%);transition:.3s;z-index:50}
  .toast.show{transform:translateY(0)}
  .toast.ok{background:#16a34a}.toast.err{background:#dc2626}
  .loading{color:var(--muted);font-size:.9rem;padding:.6rem .2rem}
</style>
</head>
<body>
<div class="wrap">
  <h1>📣 Schnell-Ansage</h1>
  <p class="sub">Kampfkunstschule Schreiner · erscheint in der App &amp; auf tda-vib.de, läuft automatisch ab.</p>

  <div class="card">
    <label>Wann gilt die Ansage?</label>
    <div class="seg" id="seg">
      <button data-w="heute" class="on">Heute</button>
      <button data-w="morgen">Morgen</button>
    </div>
    <p class="hint" id="taghint"></p>
    <label style="margin-top:1.1rem">Art der Änderung</label>
    <div class="seg" id="art">
      <button data-a="zeit" class="on">Zeitänderung</button>
      <button data-a="ausfall">Fällt aus</button>
    </div>
  </div>

  <div class="card">
    <label>Betroffene Stunden <span class="muted" style="text-transform:none;font-weight:400">(aus dem Kursplan)</span></label>
    <div id="stunden"><div class="loading">Lade Kursplan…</div></div>
  </div>

  <div class="card">
    <div class="row" id="zeitRow">
      <label>Neue Uhrzeit <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></label>
      <input type="time" id="zeit">
    </div>
    <div class="row" style="margin-bottom:0">
      <label>Grund / Text</label>
      <div class="chips" style="margin:0 0 .5rem">
        <span class="chip" data-g="Aufgrund der warmen Temperaturen">🔥 Hitze</span>
        <span class="chip" data-g="Aufgrund von Krankheit der Trainer">🤒 Krankheit</span>
        <span class="chip" data-g="Wegen einer Prüfung der Trainer">🎓 Prüfung</span>
      </div>
      <input type="text" id="grund" placeholder="z. B. Aufgrund der warmen Temperaturen…">
    </div>
  </div>

  <div class="card">
    <div class="row">
      <label>Titel</label>
      <input type="text" id="titel">
    </div>
    <div class="row" style="margin-bottom:.9rem">
      <label>Nachricht</label>
      <textarea id="nachricht"></textarea>
      <p class="hint">Wird automatisch erstellt – du kannst alles frei anpassen.</p>
    </div>
    <label>Vorschau</label>
    <div class="preview">
      <div class="ph">🔔 Wichtige Information</div>
      <div class="pb"><h3 id="pvTitel"></h3><p id="pvText"></p></div>
    </div>
  </div>

  <button class="send" id="send">Ansage veröffentlichen</button>
  <p class="hint" id="sendhint" style="text-align:center"></p>
</div>
<div class="toast" id="toast"></div>

<script>
const TOKEN = new URLSearchParams(location.search).get('token') || '';
const TAGE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
let wann = 'heute';
let art = 'zeit';        // 'zeit' = Verschiebung/Zusammenlegung, 'ausfall' = Stunden fallen aus
let plan = [];           // alle Stundenplan-Einträge
let touchedTitel = false, touchedText = false;

const $ = id => document.getElementById(id);
const zielTag = () => { const d = new Date(); if (wann==='morgen') d.setDate(d.getDate()+1); return TAGE[d.getDay()]; };

function renderTagHint(){
  const d = new Date(); if (wann==='morgen') d.setDate(d.getDate()+1);
  $('taghint').textContent = (wann==='heute'?'Heute':'Morgen') + ', ' + zielTag() + ' · ' +
    d.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}) +
    (wann==='morgen' ? ' (Popup erscheint morgen, Text in „heute"-Form)' : '');
}

function renderStunden(){
  const tag = zielTag();
  const list = plan.filter(s => s.tag === tag).sort((a,b)=> (a.uhrzeit_start>b.uhrzeit_start?1:-1));
  const box = $('stunden');
  if (!list.length){ box.innerHTML = '<p class="muted" style="margin:.3rem 0">Für '+tag+' sind keine Stunden im Kursplan hinterlegt.</p>'; return; }
  box.innerHTML = list.map(s => {
    const z = s.uhrzeit_start.slice(0,5)+'–'+s.uhrzeit_ende.slice(0,5);
    const name = (s.kursname || s.stil || 'Training');
    return '<label class="stunde"><input type="checkbox" class="cb" data-label="'+z+' '+name.replace(/"/g,'&quot;')+'">'
      + '<span class="z">'+z+'</span><span class="k">'+name+(s.trainer?'<small>'+s.trainer+'</small>':'')+'</span></label>';
  }).join('');
  box.querySelectorAll('.cb').forEach(cb => cb.addEventListener('change', compose));
}

function checkedLabels(){ return [...document.querySelectorAll('.cb:checked')].map(cb => cb.dataset.label); }

function buildText(){
  const ausfall = art === 'ausfall';
  const zeit = $('zeit').value;
  const grund = $('grund').value.trim();   // Grund-Klausel, z.B. "Aufgrund der warmen Temperaturen"
  const stunden = checkedLabels();
  const sList = stunden.join(', ');
  const hasG = grund.length > 0;
  let satz;

  if (ausfall){
    // Stunden fallen komplett aus
    if (!stunden.length){
      satz = hasG ? (grund + ' findet das Training heute leider nicht statt.')
                  : 'Das Training findet heute leider nicht statt.';
    } else if (stunden.length === 1){
      satz = hasG ? (grund + ' fällt die Stunde ' + sList + ' heute leider aus.')
                  : ('Die Stunde ' + sList + ' fällt heute leider aus.');
    } else {
      satz = hasG ? (grund + ' fallen die Stunden ' + sList + ' heute leider aus.')
                  : ('Die Stunden ' + sList + ' fallen heute leider aus.');
    }
  } else {
    // Zeitänderung / Zusammenlegung
    if (zeit){
      satz = hasG ? (grund + ' findet das Training heute erst ab ' + zeit + ' Uhr statt.')
                  : ('Das Training findet heute erst ab ' + zeit + ' Uhr statt.');
    } else {
      satz = hasG ? (grund + ' ändern sich heute die Trainingszeiten.')
                  : 'Die Trainingszeiten ändern sich heute.';
    }
    if (stunden.length){
      satz += ' ' + (stunden.length === 1 ? 'Betroffen ist' : 'Betroffen sind') + ': ' + sList + '.';
    }
    if (zeit){
      satz += ' Alle Teilnehmer dürfen um ' + zeit + ' Uhr gemeinsam trainieren.';
    }
  }
  return satz + ' Wir bitten um euer Verständnis!';
}

function compose(){
  const ausfall = art === 'ausfall';
  const zeit = $('zeit').value;
  if (!touchedTitel){
    $('titel').value = ausfall
      ? 'Trainingsausfall heute'
      : (zeit ? ('Training heute ab ' + zeit + ' Uhr') : 'Trainingsänderung heute');
  }
  if (!touchedText){
    $('nachricht').value = buildText();
  }
  $('pvTitel').textContent = $('titel').value || 'Titel…';
  $('pvText').textContent = $('nachricht').value || 'Nachricht…';
}

// Events
$('seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  wann = b.dataset.w;
  [...$('seg').children].forEach(x => x.classList.toggle('on', x===b));
  renderTagHint(); renderStunden(); compose();
});
$('art').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  art = b.dataset.a;
  [...$('art').children].forEach(x => x.classList.toggle('on', x===b));
  $('zeitRow').style.display = (art === 'ausfall') ? 'none' : '';
  compose();
});
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
  $('grund').value = c.dataset.g; compose();
}));
$('zeit').addEventListener('input', compose);
$('grund').addEventListener('input', compose);
$('titel').addEventListener('input', () => { touchedTitel = true; compose(); });
$('nachricht').addEventListener('input', () => { touchedText = true; compose(); });

function toast(msg, ok){ const t=$('toast'); t.textContent=msg; t.className='toast show '+(ok?'ok':'err'); setTimeout(()=>t.classList.remove('show'), 3500); }

$('send').addEventListener('click', async () => {
  const titel = $('titel').value.trim(), nachricht = $('nachricht').value.trim();
  if (!titel || !nachricht){ toast('Bitte Titel und Nachricht ausfüllen.', false); return; }
  const btn = $('send'); btn.disabled = true; btn.textContent = 'Wird veröffentlicht…';
  try{
    const r = await fetch('/api/schnellansage?token='+encodeURIComponent(TOKEN), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: TOKEN, titel, nachricht, datum: wann })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Fehler');
    toast('✓ Veröffentlicht – erscheint ' + (wann==='morgen'?'morgen':'jetzt') + ' in App & Homepage.', true);
    btn.textContent = '✓ Veröffentlicht'; $('sendhint').textContent = 'Läuft automatisch ab. Du kannst die Seite schließen.';
    setTimeout(()=>{ btn.disabled=false; btn.textContent='Weitere Ansage veröffentlichen';
      touchedTitel=false; touchedText=false; document.querySelectorAll('.cb:checked').forEach(c=>c.checked=false);
      $('grund').value=''; $('zeit').value=''; compose(); }, 2500);
  }catch(e){
    toast('Fehler: ' + e.message, false); btn.disabled=false; btn.textContent='Ansage veröffentlichen';
  }
});

// Init
renderTagHint();
fetch('/api/public/stundenplan/' + 3)
  .then(r => r.json())
  .then(d => { plan = (d && d.data) || []; renderStunden(); compose(); })
  .catch(() => { $('stunden').innerHTML = '<p class="muted">Kursplan konnte nicht geladen werden.</p>'; });
compose();
</script>
</body>
</html>`;

// GET /api/schnellansage/trainer — der Trainer-Bereich (Login + Kachel-Dashboard)
router.get('/trainer', (req, res) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; form-action 'self'");
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(TRAINER_HTML);
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIFIZIERTE TRAINER-ENDPUNKTE (Login statt Token; ein Passwort für alle Apps)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/schnellansage/meine-stunden?datum=heute|morgen
// Liefert NUR die Stunden, die der eingeloggte Trainer ändern darf
// (eigene Kurse + Vertretungsstunden). Admin/Super-Admin → alle Stunden des Dojos.
router.get('/meine-stunden', authenticateToken, requireTrainerOrAdmin, async (req, res) => {
  try {
    const rawDatum = (req.query.datum || 'heute').toString();
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(rawDatum) ? rawDatum
      : (rawDatum === 'morgen' ? 'morgen' : 'heute');
    const { dayName, dateStr, label } = zielDatum(datum);
    const ctx = await trainerKontext(req);

    if (!ctx.istAdmin && ctx.trainerIds.length === 0) {
      return res.json({ success: true, tag: dayName, label, stunden: [],
        hinweis: 'Dein Login ist noch keinem Trainer-Profil zugeordnet. Bitte beim Admin melden.' });
    }

    const kursIds = await erlaubteKursIds({ dojoId: ctx.dojoId, trainerIds: ctx.trainerIds, dateStr, istAdmin: ctx.istAdmin });
    if (kursIds.size === 0) {
      return res.json({ success: true, tag: dayName, label, stunden: [] });
    }

    const [rows] = await db.promise().query(
      `SELECT s.stundenplan_id, s.tag, s.uhrzeit_start, s.uhrzeit_ende, s.kurs_id,
              CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname, k.stil,
              CONCAT_WS(' ', t.vorname, t.nachname) AS trainer
         FROM stundenplan s
         JOIN kurse k ON s.kurs_id = k.kurs_id
         LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
        WHERE k.dojo_id = ? AND s.tag = ? AND s.kurs_id IN (?)
        ORDER BY s.uhrzeit_start`,
      [ctx.dojoId, dayName, [...kursIds]]
    );

    res.json({ success: true, tag: dayName, label, istAdmin: ctx.istAdmin, stunden: rows });
  } catch (e) {
    logger.error('Schnell-Ansage meine-stunden Fehler', { error: e.message });
    res.status(500).json({ error: 'Stunden konnten nicht geladen werden.' });
  }
});

// POST /api/schnellansage/veroeffentlichen
// Body: { titel, nachricht, datum, art, stunden_ids:[stundenplan_id], stunden_labels:[..] }
// Veröffentlicht das Popup. Trainer dürfen ausschließlich erlaubte Stunden wählen
// (serverseitiger Guard). Bei Trainer-Veröffentlichung → Admin-Benachrichtigung (3 Kanäle).
router.post('/veroeffentlichen', authenticateToken, requireTrainerOrAdmin, async (req, res) => {
  try {
    const titel = (req.body.titel || '').trim();
    const nachricht = (req.body.nachricht || '').trim();
    const datum = req.body.datum === 'morgen' ? 'morgen' : 'heute';
    const art = req.body.art === 'ausfall' ? 'ausfall' : 'zeit';
    const stundenIds = Array.isArray(req.body.stunden_ids) ? req.body.stunden_ids.map(Number).filter(n => !isNaN(n)) : [];
    const stundenLabels = Array.isArray(req.body.stunden_labels) ? req.body.stunden_labels.filter(s => typeof s === 'string') : [];

    if (!titel || !nachricht) return res.status(400).json({ error: 'Titel und Nachricht sind erforderlich.' });

    const { dateStr, label } = zielDatum(datum);
    const ctx = await trainerKontext(req);

    if (!ctx.istAdmin && ctx.trainerIds.length === 0) {
      return res.status(403).json({ error: 'Dein Login ist keinem Trainer-Profil zugeordnet.' });
    }

    // Guard: Trainer darf nur eigene/Vertretungs-Stunden anfassen.
    if (!ctx.istAdmin && stundenIds.length) {
      const erlaubteKurse = await erlaubteKursIds({ dojoId: ctx.dojoId, trainerIds: ctx.trainerIds, dateStr, istAdmin: false });
      const [picked] = await db.promise().query(
        `SELECT stundenplan_id, kurs_id FROM stundenplan WHERE stundenplan_id IN (?)`, [stundenIds]
      );
      const verboten = picked.filter(p => !erlaubteKurse.has(p.kurs_id));
      if (verboten.length || picked.length !== stundenIds.length) {
        return res.status(403).json({ error: 'Du kannst nur deine eigenen Stunden oder Vertretungsstunden ändern.' });
      }
    }

    const autorId = ctx.trainerAdminId || AUTOR_ID;
    const insertId = await insertAnsagePopup({ titel, nachricht, datum, dojoId: ctx.dojoId, autorId });
    logger.info('Schnell-Ansage angelegt (Login)', { id: insertId, datum, dojo_id: ctx.dojoId, trainer_ids: ctx.trainerIds, istAdmin: ctx.istAdmin });

    // Admin-Benachrichtigung nur, wenn ein TRAINER (nicht der Admin selbst) gemeldet hat.
    let notify = null;
    if (!ctx.istAdmin) {
      try {
        notify = await notifyAdminsTrainerAnsage({
          dojoId: ctx.dojoId,
          trainer: { name: ctx.name, trainer_admin_id: ctx.trainerAdminId },
          art, datumLabel: label,
          stundenText: stundenLabels.join(', '),
          titel, nachricht,
          io: req.app.get('io')
        });
      } catch (e) { logger.warn('Admin-Notify fehlgeschlagen', { error: e.message }); }
    }

    res.json({ success: true, id: insertId, wann: datum, admin_benachrichtigt: notify });
  } catch (e) {
    logger.error('Schnell-Ansage veroeffentlichen Fehler', { error: e.message });
    res.status(500).json({ error: 'Konnte die Ansage nicht speichern.', details: e.message });
  }
});

// ─── Trainer-Bereich (Login + Kachel-Dashboard + Schnell-Ansage) ─────────────
const TRAINER_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c0c1c">
<title>Trainer-Bereich · Kampfkunstschule</title>
<style>
  :root{ --bg:#0c0c1c; --card:#1a1a2e; --accent:#ef4444; --gold:#D4AF37; --line:rgba(255,255,255,.08); --muted:rgba(255,255,255,.55); }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
       background:radial-gradient(1200px 600px at 50% -10%,#1a1a2e 0%,var(--bg) 60%);color:#fff;
       min-height:100vh;padding:1rem 1rem calc(2rem + env(safe-area-inset-bottom));}
  .wrap{max-width:560px;margin:0 auto}
  h1{font-size:1.25rem;margin:.4rem 0 .2rem;display:flex;align-items:center;gap:.5rem}
  .sub{color:var(--muted);font-size:.85rem;margin:0 0 1.2rem}
  .card{background:linear-gradient(135deg,rgba(26,26,46,.99),rgba(12,12,28,1));border:1px solid var(--line);
        border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  label{display:block;font-weight:600;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem}
  input[type=text],input[type=password],input[type=time],input[type=email],textarea{width:100%;padding:.75rem .8rem;border-radius:10px;border:1px solid var(--line);
        background:rgba(255,255,255,.04);color:#fff;font-size:1rem;font-family:inherit}
  textarea{min-height:96px;resize:vertical;line-height:1.5}
  .row{margin-bottom:.9rem}
  .seg{display:flex;gap:.5rem}
  .seg button{flex:1;padding:.7rem;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03);
        color:#fff;font-size:1rem;font-weight:600;cursor:pointer;transition:.15s}
  .seg button.on{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.55);color:#fff}
  .chips{display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0 0}
  .chip{padding:.35rem .7rem;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);
        color:var(--muted);font-size:.82rem;cursor:pointer}
  .stunde{display:flex;align-items:center;gap:.6rem;padding:.55rem .2rem;border-bottom:1px solid var(--line);cursor:pointer}
  .stunde:last-child{border-bottom:none}
  .stunde input{width:20px;height:20px;accent-color:var(--accent);flex:none}
  .stunde .z{font-variant-numeric:tabular-nums;font-weight:700;color:#fff;flex:none;min-width:92px}
  .stunde .k{font-size:.9rem;line-height:1.25}
  .stunde .k small{display:block;color:var(--muted);font-size:.75rem}
  .hint{color:var(--muted);font-size:.78rem;margin:.35rem 0 0}
  .preview{border:1px solid rgba(239,68,68,.4);border-radius:12px;overflow:hidden;margin-top:.4rem}
  .preview .ph{padding:.6rem .9rem;background:rgba(239,68,68,.12);border-bottom:1px solid rgba(239,68,68,.2);
        color:var(--accent);font-weight:700;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase}
  .preview .pb{padding:1rem .9rem}
  .preview .pb h3{margin:0 0 .4rem;font-size:1.1rem}
  .preview .pb p{margin:0;color:rgba(255,255,255,.8);font-size:.92rem;line-height:1.5;white-space:pre-line}
  .btn{width:100%;padding:.95rem;border-radius:12px;border:none;font-size:1.05rem;font-weight:700;cursor:pointer;
        background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;margin-top:.3rem}
  .btn:disabled{opacity:.5}
  .btn-ghost{background:transparent;border:1px solid var(--line);color:var(--muted);font-weight:600;font-size:.9rem;padding:.6rem}
  .muted{color:var(--muted)}
  .tile{display:flex;align-items:center;gap:.9rem;width:100%;text-align:left;padding:1.1rem;border-radius:14px;
        border:1px solid var(--line);background:linear-gradient(135deg,rgba(239,68,68,.12),rgba(26,26,46,.6));color:#fff;cursor:pointer;margin-bottom:.8rem}
  .tile .emo{font-size:1.8rem}
  .tile .t-name{font-weight:700;font-size:1.05rem}
  .tile .t-desc{color:var(--muted);font-size:.82rem;margin-top:.15rem}
  .tile.soon{opacity:.5;cursor:default;background:rgba(255,255,255,.02)}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
  .top .who{font-size:.85rem;color:var(--muted)}
  .toast{position:fixed;left:1rem;right:1rem;bottom:calc(1rem + env(safe-area-inset-bottom));max-width:528px;margin:0 auto;
        padding:.9rem 1rem;border-radius:12px;font-weight:600;text-align:center;transform:translateY(140%);transition:.3s;z-index:50}
  .toast.show{transform:translateY(0)}.toast.ok{background:#16a34a}.toast.err{background:#dc2626}
  .loading{color:var(--muted);font-size:.9rem;padding:.6rem .2rem}
  .hide{display:none!important}
  a.link{color:var(--gold);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">

  <!-- LOGIN -->
  <div id="viewLogin" class="hide">
    <h1>🥋 Trainer-Bereich</h1>
    <p class="sub">Mit deinen gewohnten Zugangsdaten anmelden – ein Passwort für alle Apps.</p>
    <div class="card">
      <div class="row"><label>Benutzername oder E-Mail</label><input type="text" id="lgUser" autocomplete="username"></div>
      <div class="row" style="margin-bottom:.6rem"><label>Passwort</label><input type="password" id="lgPass" autocomplete="current-password"></div>
      <button class="btn" id="lgBtn">Anmelden</button>
      <p class="hint" id="lgHint"></p>
    </div>
  </div>

  <!-- DASHBOARD -->
  <div id="viewDash" class="hide">
    <div class="top">
      <div><h1 style="margin:0">🥋 Trainer-Bereich</h1><div class="who" id="dashWho"></div></div>
      <button class="btn-ghost" style="width:auto" id="logoutBtn">Abmelden</button>
    </div>
    <button class="tile" id="tileAnsage">
      <span class="emo">📣</span>
      <span><span class="t-name">Schnell-Ansage</span><span class="t-desc" id="ansageDesc">Stunde absagen, verlegen oder ändern – erscheint sofort in App &amp; auf der Homepage.</span></span>
    </button>
    <div class="tile soon"><span class="emo">📅</span><span><span class="t-name">Meine Stunden</span><span class="t-desc">Kommt bald.</span></span></div>
  </div>

  <!-- SCHNELL-ANSAGE -->
  <div id="viewAnsage" class="hide">
    <div class="top">
      <div><h1 style="margin:0">📣 Schnell-Ansage</h1><div class="who" id="ansageWho"></div></div>
      <button class="btn-ghost" style="width:auto" id="backBtn">‹ Zurück</button>
    </div>

    <div class="card">
      <label>Wann gilt die Ansage?</label>
      <div class="seg" id="seg"><button data-w="heute" class="on">Heute</button><button data-w="morgen">Morgen</button></div>
      <p class="hint" id="taghint"></p>
      <label style="margin-top:1.1rem">Art der Änderung</label>
      <div class="seg" id="art"><button data-a="zeit" class="on">Verlegen / Zeitänderung</button><button data-a="ausfall">Fällt aus</button></div>
    </div>

    <div class="card">
      <label>Betroffene Stunden <span class="muted" style="text-transform:none;font-weight:400" id="stLabel">(deine Stunden)</span></label>
      <div id="stunden"><div class="loading">Lade deine Stunden…</div></div>
    </div>

    <div class="card">
      <div class="row" id="zeitRow">
        <label>Neue Uhrzeit <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></label>
        <input type="time" id="zeit">
      </div>
      <div class="row" style="margin-bottom:0">
        <label>Grund / Text</label>
        <div class="chips" style="margin:0 0 .5rem">
          <span class="chip" data-g="Aufgrund der warmen Temperaturen">🔥 Hitze</span>
          <span class="chip" data-g="Aufgrund von Krankheit">🤒 Krankheit</span>
          <span class="chip" data-g="Wegen einer Prüfung">🎓 Prüfung</span>
        </div>
        <input type="text" id="grund" placeholder="z. B. Aufgrund der warmen Temperaturen…">
      </div>
    </div>

    <div class="card">
      <div class="row"><label>Titel</label><input type="text" id="titel"></div>
      <div class="row" style="margin-bottom:.9rem"><label>Nachricht</label><textarea id="nachricht"></textarea>
        <p class="hint">Wird automatisch erstellt – du kannst alles frei anpassen.</p></div>
      <label>Vorschau</label>
      <div class="preview"><div class="ph">🔔 Wichtige Information</div><div class="pb"><h3 id="pvTitel"></h3><p id="pvText"></p></div></div>
    </div>

    <button class="btn" id="send">Ansage veröffentlichen</button>
    <p class="hint" id="sendhint" style="text-align:center"></p>
  </div>

</div>
<div class="toast" id="toast"></div>

<script>
const $ = id => document.getElementById(id);
const TAGE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
let token = localStorage.getItem('trainer_jwt') || '';
let me = null;
try { me = JSON.parse(localStorage.getItem('trainer_user') || 'null'); } catch(_) {}
let wann='heute', art='zeit', stunden=[], istAdmin=false, touchedTitel=false, touchedText=false;

function show(view){ ['viewLogin','viewDash','viewAnsage'].forEach(v=>$(v).classList.toggle('hide', v!==view)); }
function toast(msg, ok){ const t=$('toast'); t.textContent=msg; t.className='toast show '+(ok?'ok':'err'); setTimeout(()=>t.classList.remove('show'),3500); }
function authHeaders(){ return { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }; }
function logout(){ token=''; me=null; localStorage.removeItem('trainer_jwt'); localStorage.removeItem('trainer_user'); show('viewLogin'); }

// ── Login ──
$('lgBtn').addEventListener('click', doLogin);
$('lgPass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
async function doLogin(){
  const username=$('lgUser').value.trim(), password=$('lgPass').value;
  if(!username||!password){ $('lgHint').textContent='Bitte Benutzername und Passwort eingeben.'; return; }
  $('lgBtn').disabled=true; $('lgBtn').textContent='Anmelden…'; $('lgHint').textContent='';
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,email:username,password})});
    const j=await r.json();
    if(!r.ok||!j.token) throw new Error(j.message||j.error||'Login fehlgeschlagen');
    const role=j.user&&(j.user.role||j.user.rolle);
    if(!['trainer','admin','super_admin'].includes(role)){ throw new Error('Dieser Zugang ist nicht für den Trainer-Bereich freigeschaltet.'); }
    token=j.token; me=j.user; localStorage.setItem('trainer_jwt',token); localStorage.setItem('trainer_user',JSON.stringify(me));
    enterDash();
  }catch(e){ $('lgHint').textContent=e.message; }
  finally{ $('lgBtn').disabled=false; $('lgBtn').textContent='Anmelden'; }
}

function enterDash(){
  const role=me&&(me.role||me.rolle);
  istAdmin=['admin','super_admin'].includes(role);
  $('dashWho').textContent='Angemeldet als '+((me&&me.vorname)||(me&&me.username)||'')+(istAdmin?' · Admin':' · Trainer');
  $('ansageDesc').textContent=istAdmin?'Stunde absagen oder ändern (alle Stunden) – erscheint sofort in App & Homepage.':'Deine Stunde absagen, verlegen oder ändern – erscheint sofort in App & Homepage.';
  show('viewDash');
}

$('logoutBtn').addEventListener('click', logout);
$('tileAnsage').addEventListener('click', openAnsage);
$('backBtn').addEventListener('click', ()=>show('viewDash'));

// ── Schnell-Ansage ──
function openAnsage(){
  $('ansageWho').textContent=istAdmin?'Alle Stunden':'Nur deine Stunden & Vertretungen';
  $('stLabel').textContent=istAdmin?'(alle Stunden des Dojos)':'(deine Stunden & Vertretungen)';
  wann='heute'; art='zeit'; touchedTitel=false; touchedText=false;
  [...$('seg').children].forEach((x,i)=>x.classList.toggle('on',i===0));
  [...$('art').children].forEach((x,i)=>x.classList.toggle('on',i===0));
  $('zeitRow').style.display=''; $('grund').value=''; $('zeit').value='';
  show('viewAnsage'); renderTagHint(); loadStunden(); compose();
}

function zielTagName(){ const d=new Date(); if(wann==='morgen') d.setDate(d.getDate()+1); return TAGE[d.getDay()]; }
function renderTagHint(){
  const d=new Date(); if(wann==='morgen') d.setDate(d.getDate()+1);
  $('taghint').textContent=(wann==='heute'?'Heute':'Morgen')+', '+zielTagName()+' · '+d.toLocaleDateString('de-DE',{day:'2-digit',month:'long'})+(wann==='morgen'?' (Popup erscheint morgen)':'');
}

async function loadStunden(){
  $('stunden').innerHTML='<div class="loading">Lade…</div>';
  try{
    const r=await fetch('/api/schnellansage/meine-stunden?datum='+wann,{headers:authHeaders()});
    if(r.status===401){ logout(); return; }
    const j=await r.json();
    stunden=(j&&j.stunden)||[];
    renderStunden(j&&j.hinweis);
  }catch(e){ $('stunden').innerHTML='<p class="muted">Stunden konnten nicht geladen werden.</p>'; }
}
function renderStunden(hinweis){
  const box=$('stunden');
  if(!stunden.length){ box.innerHTML='<p class="muted" style="margin:.3rem 0">'+(hinweis||('Für '+zielTagName()+' sind keine '+(istAdmin?'':'eigenen ')+'Stunden hinterlegt.'))+'</p>'; return; }
  box.innerHTML=stunden.map(s=>{
    const z=(s.uhrzeit_start||'').slice(0,5)+'–'+(s.uhrzeit_ende||'').slice(0,5);
    const name=s.kursname||s.stil||'Training';
    return '<label class="stunde"><input type="checkbox" class="cb" data-id="'+s.stundenplan_id+'" data-label="'+z+' '+name.replace(/"/g,'&quot;')+'">'
      +'<span class="z">'+z+'</span><span class="k">'+name+(s.trainer?'<small>'+s.trainer+'</small>':'')+'</span></label>';
  }).join('');
  box.querySelectorAll('.cb').forEach(cb=>cb.addEventListener('change',compose));
}
function checked(){ return [...document.querySelectorAll('.cb:checked')]; }
function checkedLabels(){ return checked().map(cb=>cb.dataset.label); }
function checkedIds(){ return checked().map(cb=>parseInt(cb.dataset.id)); }

function buildText(){
  const ausfall=art==='ausfall', zeit=$('zeit').value, grund=$('grund').value.trim();
  const list=checkedLabels(), sList=list.join(', '), hasG=grund.length>0; let satz;
  if(ausfall){
    if(!list.length) satz=hasG?(grund+' findet das Training heute leider nicht statt.'):'Das Training findet heute leider nicht statt.';
    else if(list.length===1) satz=hasG?(grund+' fällt die Stunde '+sList+' heute leider aus.'):('Die Stunde '+sList+' fällt heute leider aus.');
    else satz=hasG?(grund+' fallen die Stunden '+sList+' heute leider aus.'):('Die Stunden '+sList+' fallen heute leider aus.');
  } else {
    if(zeit) satz=hasG?(grund+' findet das Training heute erst ab '+zeit+' Uhr statt.'):('Das Training findet heute erst ab '+zeit+' Uhr statt.');
    else satz=hasG?(grund+' ändern sich heute die Trainingszeiten.'):'Die Trainingszeiten ändern sich heute.';
    if(list.length) satz+=' '+(list.length===1?'Betroffen ist':'Betroffen sind')+': '+sList+'.';
    if(zeit) satz+=' Alle Teilnehmer dürfen um '+zeit+' Uhr gemeinsam trainieren.';
  }
  return satz+' Wir bitten um euer Verständnis!';
}
function compose(){
  const ausfall=art==='ausfall', zeit=$('zeit').value;
  if(!touchedTitel) $('titel').value=ausfall?'Trainingsausfall heute':(zeit?('Training heute ab '+zeit+' Uhr'):'Trainingsänderung heute');
  if(!touchedText) $('nachricht').value=buildText();
  $('pvTitel').textContent=$('titel').value||'Titel…';
  $('pvText').textContent=$('nachricht').value||'Nachricht…';
}

$('seg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; wann=b.dataset.w;
  [...$('seg').children].forEach(x=>x.classList.toggle('on',x===b)); renderTagHint(); loadStunden(); compose(); });
$('art').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; art=b.dataset.a;
  [...$('art').children].forEach(x=>x.classList.toggle('on',x===b)); $('zeitRow').style.display=(art==='ausfall')?'none':''; compose(); });
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ $('grund').value=c.dataset.g; compose(); }));
$('zeit').addEventListener('input',compose);
$('grund').addEventListener('input',compose);
$('titel').addEventListener('input',()=>{ touchedTitel=true; compose(); });
$('nachricht').addEventListener('input',()=>{ touchedText=true; compose(); });

$('send').addEventListener('click', async ()=>{
  const titel=$('titel').value.trim(), nachricht=$('nachricht').value.trim();
  if(!titel||!nachricht){ toast('Bitte Titel und Nachricht ausfüllen.',false); return; }
  const btn=$('send'); btn.disabled=true; btn.textContent='Wird veröffentlicht…';
  try{
    const r=await fetch('/api/schnellansage/veroeffentlichen',{method:'POST',headers:authHeaders(),
      body:JSON.stringify({ titel, nachricht, datum:wann, art, stunden_ids:checkedIds(), stunden_labels:checkedLabels() })});
    if(r.status===401){ logout(); return; }
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||'Fehler');
    toast('✓ Veröffentlicht'+(istAdmin?'.':' – der Admin wurde informiert.'),true);
    btn.textContent='✓ Veröffentlicht'; $('sendhint').textContent='Läuft automatisch ab.';
    setTimeout(()=>{ btn.disabled=false; btn.textContent='Weitere Ansage veröffentlichen';
      touchedTitel=false; touchedText=false; checked().forEach(c=>c.checked=false); $('grund').value=''; $('zeit').value=''; compose(); },2500);
  }catch(e){ toast('Fehler: '+e.message,false); btn.disabled=false; btn.textContent='Ansage veröffentlichen'; }
});

// Init
if(token && me) enterDash(); else show('viewLogin');
</script>
</body>
</html>`;

module.exports = router;
