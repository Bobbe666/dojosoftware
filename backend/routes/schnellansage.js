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

const DOJO_ID = 3;   // Kampfkunstschule Schreiner
const AUTOR_ID = 1;  // Super-Admin als Autor
const TOKEN = process.env.SCHNELLANSAGE_TOKEN;

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
    const istMorgen = datum === 'morgen';
    const statusSql      = istMorgen ? "'geplant'" : "'veroeffentlicht'";
    const veroeffentSql  = istMorgen ? "NULL" : "NOW()";
    const geplantSql     = istMorgen ? "DATE_ADD(CURDATE(), INTERVAL 1 DAY)" : "NULL";
    const ablaufSql      = istMorgen ? "DATE_ADD(CURDATE(), INTERVAL 2 DAY)" : "DATE_ADD(CURDATE(), INTERVAL 1 DAY)";

    // kurzbeschreibung trägt den sichtbaren Text (Popup zeigt sie direkt an),
    // inhalt bleibt leer → kein redundanter "Vollständig lesen"-Button.
    const [result] = await db.promise().query(
      `INSERT INTO news_articles
         (titel, inhalt, kurzbeschreibung, zielgruppe, status, autor_id,
          veroeffentlicht_am, geplant_am, dojo_id, als_popup, ablauf_am, kategorie)
       VALUES (?, '', ?, 'alle_dojos', ${statusSql}, ?,
          ${veroeffentSql}, ${geplantSql}, ?, 1, ${ablaufSql}, 'allgemein')`,
      [titel, nachricht, AUTOR_ID, DOJO_ID]
    );

    logger.info('Schnell-Ansage angelegt', { id: result.insertId, datum, dojo_id: DOJO_ID });
    res.json({ success: true, id: result.insertId, wann: datum });
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
  </div>

  <div class="card">
    <label>Betroffene Stunden <span class="muted" style="text-transform:none;font-weight:400">(aus dem Kursplan)</span></label>
    <div id="stunden"><div class="loading">Lade Kursplan…</div></div>
  </div>

  <div class="card">
    <div class="row">
      <label>Neue Uhrzeit <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></label>
      <input type="time" id="zeit">
    </div>
    <div class="row" style="margin-bottom:0">
      <label>Grund / Text</label>
      <div class="chips" style="margin:0 0 .5rem">
        <span class="chip" data-g="Aufgrund der warmen Temperaturen legen wir die Stunden zusammen.">🔥 Hitze</span>
        <span class="chip" data-g="Aufgrund von Krankheit der Trainer müssen wir die Stunden zusammenlegen.">🤒 Krankheit</span>
        <span class="chip" data-g="Wegen einer Prüfung der Trainer legen wir die Stunden zusammen.">🎓 Prüfung</span>
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

function compose(){
  const zeit = $('zeit').value;
  const grund = $('grund').value.trim();
  const stunden = checkedLabels();

  if (!touchedTitel){
    $('titel').value = zeit ? ('Training heute ab '+zeit+' Uhr') : 'Trainingsänderung heute';
  }
  if (!touchedText){
    let t = grund ? grund : '';
    if (stunden.length) t += (t?' ':'') + 'Betroffen: ' + stunden.join(', ') + '.';
    if (zeit) t += (t?' ':'') + 'Das Training findet heute erst ab ' + zeit + ' Uhr statt. Alle Teilnehmer dürfen um ' + zeit + ' Uhr gemeinsam trainieren.';
    if (t) t += ' Wir bitten um euer Verständnis!';
    $('nachricht').value = t;
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

module.exports = router;
