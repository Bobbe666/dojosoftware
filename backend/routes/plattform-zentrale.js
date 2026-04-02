// ============================================================
// PLATTFORM-ZENTRALE — Super Admin Cross-Platform Proxy
// ============================================================
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('./admin/shared');
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');

const EVENTS_BASE = 'http://localhost:5002/api';
const HOF_BASE    = 'http://localhost:5003/api';
const SERVICE_KEY = process.env.DOJO_SERVICE_KEY || '';

// ── ICS-Feed Hilfsfunktionen (VOR Auth-Middleware — kein Bearer erforderlich) ──
const crypto = require('crypto');

function getCalToken() {
  const base = process.env.DOJO_SERVICE_KEY || process.env.JWT_SECRET || 'tda-default';
  return crypto.createHash('sha256').update(base + ':ical-feed').digest('hex').substring(0, 32);
}

function toICSDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escICS(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Public ICS-Feed — kein Bearer-Token nötig, URL-Token schützt den Feed
router.get('/kalender.ics', async (req, res) => {
  if (req.query.token !== getCalToken()) {
    return res.status(403).send('Ungültiger Token');
  }
  const von = toLocalDate(new Date(Date.now() - 2 * 365 * 86400000));
  const bis = toLocalDate(new Date(Date.now() + 2 * 365 * 86400000));

  const sources = await Promise.allSettled([
    axios.get(`${EVENTS_BASE}/turniere/public`, { timeout: 6000 }),
    axios.get(`${EVENTS_BASE}/events/public`, { timeout: 6000 }),
    axios.get(`${HOF_BASE}/veranstaltungen`, { timeout: 6000 }),
    pool.query(
      `SELECT MIN(p.pruefung_id) as id,
              CONCAT('Gürtelprüfung - ', d.dojoname) as titel,
              p.pruefungsdatum as datum,
              MIN(p.pruefungszeit) as pruefungszeit,
              COALESCE(NULLIF(p.pruefungsort,'Nicht festgelegt'), d.dojoname, 'Dojo') as ort,
              'geplant' as status, p.dojo_id, d.dojoname as dojo_name, COUNT(*) as teilnehmer
       FROM pruefungen p
       LEFT JOIN dojo d ON d.id = p.dojo_id
       WHERE p.pruefungsdatum BETWEEN ? AND ?
         AND p.status IN ('geplant','durchgefuehrt','bestanden','nicht_bestanden') AND d.dojoname != 'demo'
       GROUP BY p.pruefungsdatum, p.dojo_id, p.pruefungsort
       ORDER BY p.pruefungsdatum`,
      [von, bis]
    ),
  ]);

  const evList = [];

  if (sources[0].status === 'fulfilled') {
    const data = sources[0].value.data;
    const list = data.data || data.turniere || (Array.isArray(data) ? data : []);
    list.forEach(t => {
      evList.push({ uid: 'turnier-' + (t.turnier_id || t.id) + '@tda', summary: t.name || t.titel, datum: t.datum || t.start_datum, datum_bis: t.end_datum, location: t.ort, description: 'Turnier | events.tda-intl.org' });
    });
  }
  if (sources[1].status === 'fulfilled') {
    const data = sources[1].value.data;
    const list = data.data || data.events || (Array.isArray(data) ? data : []);
    list.forEach(e => {
      evList.push({ uid: 'event-' + (e.event_id || e.id) + '@tda', summary: e.name || e.titel, datum: e.datum, datum_bis: e.end_datum, location: e.ort, description: 'Event | events.tda-intl.org' });
    });
  }
  if (sources[2].status === 'fulfilled') {
    const list = Array.isArray(sources[2].value.data) ? sources[2].value.data : [];
    list.filter(v => v.datum).forEach(v => {
      evList.push({ uid: 'hof-' + v.id + '@tda', summary: v.titel, datum: v.datum, location: v.veranstaltungsort, description: 'Hall of Fame | hof.tda-intl.org' });
    });
  }
  if (sources[3].status === 'fulfilled') {
    const rows = sources[3].value[0] || [];
    rows.forEach(p => {
      const d = p.datum instanceof Date ? toLocalDate(p.datum) : p.datum;
      // pruefungszeit kommt als HH:MM:SS string oder null
      const zeit = p.pruefungszeit ? String(p.pruefungszeit).substring(0, 5) : null;
      evList.push({ uid: 'pruefung-' + p.id + '@tda', summary: p.titel || ('Pruefung - ' + (p.dojo_name || 'Dojo')), datum: d, pruefungszeit: zeit, location: p.ort, description: 'Pruefung | dojo.tda-intl.org' });
    });
  }

  const now = toICSDate(new Date().toISOString());
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TDA Plattform-Zentrale//DE','X-WR-CALNAME:TDA Plattform-Kalender','X-WR-TIMEZONE:Europe/Berlin','CALSCALE:GREGORIAN','METHOD:PUBLISH'];

  evList.forEach(ev => {
    const dtstart = toICSDate(ev.datum);
    if (!dtstart) return;
    const dtend = ev.datum_bis ? toICSDate(ev.datum_bis) : dtstart;
    const dateOnly = dtstart.substring(0, 8);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + ev.uid);
    lines.push('DTSTAMP:' + now);
    if (ev.pruefungszeit) {
      // Mit Uhrzeit: lokale Zeit Berlin
      const timeStr = ev.pruefungszeit.replace(':', '') + '00';
      lines.push('DTSTART;TZID=Europe/Berlin:' + dateOnly + 'T' + timeStr);
      // Standarddauer Prüfung: 2 Stunden
      const [hh, mm] = ev.pruefungszeit.split(':').map(Number);
      const endH = String(hh + 2).padStart(2, '0');
      lines.push('DTEND;TZID=Europe/Berlin:' + dateOnly + 'T' + endH + mm.toString().padStart(2,'0') + '00');
    } else {
      lines.push('DTSTART;VALUE=DATE:' + dateOnly);
      lines.push('DTEND;VALUE=DATE:' + dtend.substring(0, 8));
    }
    lines.push('SUMMARY:' + escICS(ev.summary));
    if (ev.location) lines.push('LOCATION:' + escICS(ev.location));
    if (ev.description) lines.push('DESCRIPTION:' + escICS(ev.description));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tda-plattform.ics"');
  res.send(lines.join('\r\n'));
});

// Kalender-Token für Frontend (benötigt Auth)
router.get('/kalender-token', (req, res) => {
  // Dieser Endpunkt läuft VOR requireSuperAdmin aber NACH dieser Definition —
  // Auth wird per router.use weiter unten gesetzt, also hier direkt token prüfen:
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Kein Token' });
  const jwt = require('jsonwebtoken');
  try {
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (e) {
    return res.status(403).json({ error: 'Token ungueltig' });
  }
  res.json({ token: getCalToken(), base_url: 'https://dojo.tda-intl.org/api/plattform-zentrale/kalender.ics' });
});

router.use(authenticateToken);
router.use(requireSuperAdmin);

// Lokales Datum als YYYY-MM-DD (kein UTC-Shift)
const toLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ── Zentraler Kalender ────────────────────────────────────────────────────────
router.get('/kalender', async (req, res) => {
  // Standardmäßig: 2 Jahre zurück bis 2 Jahre voraus
  const von = req.query.von || toLocalDate(new Date(Date.now() - 2 * 365 * 86400000));
  const bis = req.query.bis || toLocalDate(new Date(Date.now() + 2 * 365 * 86400000));

  const sources = await Promise.allSettled([
    // 1. Events-Plattform: Turniere
    axios.get(`${EVENTS_BASE}/turniere/public`, { timeout: 6000 }),
    // 2. Events-Plattform: Events
    axios.get(`${EVENTS_BASE}/events/public`, { timeout: 6000 }),
    // 3. HOF: Veranstaltungen
    axios.get(`${HOF_BASE}/veranstaltungen`, { timeout: 6000 }),
    // 4. Dojo: Prüfungstermine (geplante Termine mit Titel)
    pool.query(`
      SELECT MIN(p.pruefung_id) as id, CONCAT('Gürtelprüfung - ', d.dojoname) as titel,
             p.pruefungsdatum as datum, MIN(p.pruefungszeit) as pruefungszeit,
             COALESCE(NULLIF(p.pruefungsort,'Nicht festgelegt'), d.dojoname, 'Dojo') as ort,
             'geplant' as status, p.dojo_id, d.dojoname as dojo_name, COUNT(*) as teilnehmer
      FROM pruefungen p
      LEFT JOIN dojo d ON d.id = p.dojo_id
      WHERE p.pruefungsdatum BETWEEN ? AND ?
        AND p.status IN ('geplant','durchgefuehrt','bestanden','nicht_bestanden') AND d.dojoname != 'demo'
      GROUP BY p.pruefungsdatum, p.dojo_id, p.pruefungsort
      ORDER BY p.pruefungsdatum
    `, [von, bis]),
    // 5. (reserviert)
    Promise.resolve([[]])
  ]);

  const all = [];

  // Turniere
  if (sources[0].status === 'fulfilled') {
    const data = sources[0].value.data;
    const list = data.data || data.turniere || (Array.isArray(data) ? data : []);
    list.forEach(t => {
        all.push({
          id: `turnier-${t.turnier_id || t.id}`,
          typ: 'turnier', platform: 'events',
          titel: t.name || t.titel,
          datum: t.datum || t.start_datum,
          datum_bis: t.end_datum,
          ort: t.ort, status: t.status,
          farbe: '#818cf8',
          url: `https://events.tda-intl.org`,
          raw_id: t.turnier_id || t.id
        });
      });
  }

  // Events
  if (sources[1].status === 'fulfilled') {
    const data = sources[1].value.data;
    const list = data.data || data.events || (Array.isArray(data) ? data : []);
    list.forEach(e => {
      all.push({
        id: `event-${e.event_id || e.id}`,
        typ: 'event', platform: 'events',
        titel: e.name || e.titel,
        datum: e.datum,
        datum_bis: e.end_datum,
        ort: e.ort, status: e.status,
        typ_label: e.typ,
        farbe: '#38bdf8',
        url: `https://events.tda-intl.org`,
        raw_id: e.event_id || e.id
      });
    });
  }

  // HOF
  if (sources[2].status === 'fulfilled') {
    const list = sources[2].value.data || [];
    (Array.isArray(list) ? list : []).forEach(v => {
      if (v.datum) {
        all.push({
          id: `hof-${v.id}`,
          typ: 'hof', platform: 'hof',
          titel: v.titel,
          datum: v.datum,
          datum_bis: null,
          ort: v.veranstaltungsort,
          farbe: '#fbbf24',
          url: `https://hof.tda-intl.org`,
          raw_id: v.id
        });
      }
    });
  }

  // Prüfungstermine (geplante Termine mit Titel)
  const pruefungsterminIds = new Set();
  if (sources[3].status === 'fulfilled') {
    const rows = sources[3].value[0] || [];
    rows.forEach(p => {
      const d = p.datum instanceof Date ? toLocalDate(p.datum) : p.datum;
      pruefungsterminIds.add(`${d}-${p.dojo_id}`);
      all.push({
        id: `pruefungstermin-${p.id}`,
        typ: 'pruefung', platform: 'pruefung',
        titel: p.titel || `Prüfung – ${p.dojo_name || 'Dojo'}`,
        datum: d,
        ort: p.ort,
        status: p.status,
        dojo_name: p.dojo_name,
        farbe: '#4ade80',
        url: null
      });
    });
  }


  all.sort((a, b) => new Date(a.datum) - new Date(b.datum));

  res.json({
    success: true,
    events: all,
    meta: {
      turniere: all.filter(e => e.typ === 'turnier').length,
      events: all.filter(e => e.typ === 'event').length,
      hof: all.filter(e => e.typ === 'hof').length,
      pruefungen: all.filter(e => e.typ === 'pruefung').length,
      gesamt: all.length,
      quellen: {
        events_turniere: sources[0].status,
        events_events: sources[1].status,
        hof: sources[2].status,
        dojo_pruefungen: sources[3].status
      }
    }
  });
});

// ── News plattformübergreifend abrufen ────────────────────────────────────────
router.get('/news', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, titel, inhalt, kurzbeschreibung, kategorie, status, created_at as erstellt_am, dojo_id, bild_url
       FROM news_articles ORDER BY created_at DESC LIMIT 30`
    );
    res.json({ success: true, news: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── News plattformübergreifend erstellen ──────────────────────────────────────
router.post('/news', async (req, res) => {
  const { titel, inhalt, kategorie, platformen, zusammenfassung, bild_url } = req.body;
  if (!titel || !inhalt) return res.status(400).json({ error: 'Titel und Inhalt erforderlich' });

  const ziele = Array.isArray(platformen) ? platformen : ['dojo'];
  const ergebnisse = {};

  if (ziele.includes('dojo')) {
    try {
      const [r] = await pool.query(
        `INSERT INTO news_articles (titel, kurzbeschreibung, inhalt, kategorie, status, autor_id, veroeffentlicht_am, dojo_id, zielgruppe, bild_url)
         VALUES (?, ?, ?, ?, 'veroeffentlicht', ?, NOW(), NULL, 'homepage', ?)`,
        [titel, zusammenfassung || "", inhalt, kategorie || "allgemein", req.user.id || req.user.user_id || 1, bild_url || null]
      );
      ergebnisse.dojo = { success: true, id: r.insertId };
    } catch (e) {
      ergebnisse.dojo = { success: false, error: e.message };
    }
  }

  res.json({ success: true, ergebnisse });
});

// ── Turnier auf events.tda-intl.org erstellen ─────────────────────────────────
router.post('/turnier', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.post(`${EVENTS_BASE}/turniere`, req.body, {
      headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('Turnier-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});

// ── HOF Veranstaltung erstellen ───────────────────────────────────────────────
router.post('/hof-veranstaltung', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.post(`${HOF_BASE}/veranstaltungen`, req.body, {
      headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('HOF-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});

// ── Turniere von events.tda-intl.org abrufen ──────────────────────────────────
router.get('/turniere', async (req, res) => {
  try {
    const r = await axios.get(`${EVENTS_BASE}/turniere/public`, { timeout: 6000 });
    const data = r.data.data || r.data.turniere || (Array.isArray(r.data) ? r.data : []);
    res.json({ success: true, turniere: data });
  } catch (e) {
    res.status(500).json({ error: 'Events-Plattform nicht erreichbar' });
  }
});

// ── HOF Veranstaltungen abrufen ───────────────────────────────────────────────
router.get('/hof-veranstaltungen', async (req, res) => {
  try {
    const r = await axios.get(`${HOF_BASE}/veranstaltungen`, { timeout: 6000 });
    res.json({ success: true, veranstaltungen: r.data || [] });
  } catch (e) {
    res.status(500).json({ error: 'HOF-Plattform nicht erreichbar' });
  }
});

// ── HOF Veranstaltung bearbeiten ──────────────────────────────────────────────
router.put('/hof-veranstaltung/:id', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.put(`${HOF_BASE}/veranstaltungen/${req.params.id}`, req.body, {
      headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('HOF-Update-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});

// ── HOF Veranstaltung löschen ─────────────────────────────────────────────────
router.delete('/hof-veranstaltung/:id', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.delete(`${HOF_BASE}/veranstaltungen/${req.params.id}`, {
      headers: { 'X-Service-Key': SERVICE_KEY },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('HOF-Delete-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});


// ── News bearbeiten ──────────────────────────────────────────────────────────
router.put('/news/:id', async (req, res) => {
  const { titel, inhalt, kategorie, zusammenfassung, bild_url } = req.body;
  if (!titel || !inhalt) return res.status(400).json({ error: 'Titel und Inhalt erforderlich' });
  try {
    await pool.query(
      `UPDATE news_articles SET titel=?, kurzbeschreibung=?, inhalt=?, kategorie=?, bild_url=? WHERE id=?`,
      [titel, zusammenfassung || '', inhalt, kategorie || 'allgemein', bild_url !== undefined ? bild_url : null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── News löschen ──────────────────────────────────────────────────────────────
router.delete('/news/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM news_articles WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Turnier bearbeiten ────────────────────────────────────────────────────────
router.put('/turnier/:id', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.put(`${EVENTS_BASE}/turniere/${req.params.id}`, req.body, {
      headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('Turnier-Update-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});

// ── Turnier löschen ───────────────────────────────────────────────────────────
router.delete('/turnier/:id', async (req, res) => {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service-Key nicht konfiguriert' });
  try {
    const r = await axios.delete(`${EVENTS_BASE}/turniere/${req.params.id}`, {
      headers: { 'X-Service-Key': SERVICE_KEY },
      timeout: 12000
    });
    res.json(r.data);
  } catch (e) {
    logger.error('Turnier-Delete-Proxy-Fehler:', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message });
  }
});
module.exports = router;
