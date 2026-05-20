// ============================================================================
// KALENDER ZENTRALE — Unified Calendar API
// Route: /api/kalender/...
// Kombiniert Events, Prüfungstermine, Stundenplan, TDA-Events & iCal-Feeds
// ============================================================================

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const db = require('../db');
const { getSecureDojoId, isSuperAdmin } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

const pool = db.promise();

// ── iCal-Parser (kompakt, inline) ────────────────────────────────────────────

function parseICSDate(value, keyFull) {
  if (!value) return null;
  if (/VALUE=DATE/.test(keyFull) || /^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00`);
  }
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}Z`);
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}`);
  }
  return null;
}

function parseICS(text) {
  const events = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  let cur = null;
  for (const line of unfolded) {
    if (line.trim() === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line.trim() === 'END:VEVENT') {
      if (cur && cur.start && cur.summary) events.push(cur);
      cur = null; continue;
    }
    if (!cur) continue;
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const keyFull = line.slice(0, ci);
    const val = line.slice(ci + 1).trim();
    const key = keyFull.split(';')[0].toUpperCase();
    if (key === 'DTSTART') { const d = parseICSDate(val, keyFull); if (d) cur.start = d; }
    else if (key === 'DTEND') { const d = parseICSDate(val, keyFull); if (d) cur.end = d; }
    else if (key === 'SUMMARY') cur.summary = val.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';');
    else if (key === 'LOCATION') cur.location = val.replace(/\\n/g, ' ').replace(/\\,/g, ',');
    else if (key === 'UID') cur.uid = val;
  }
  return events;
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const normalized = url.replace(/^webcal:\/\//i, 'https://');
    const mod = normalized.startsWith('https') ? https : http;
    const req = mod.get(normalized, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── TDA-Events Cache (30 Min) ─────────────────────────────────────────────────
let tdaCache = { events: [], fetchedAt: 0 };
const TDA_CACHE_TTL = 30 * 60 * 1000;

async function getTdaEvents() {
  const now = Date.now();
  if (now - tdaCache.fetchedAt < TDA_CACHE_TTL) return tdaCache.events;
  try {
    const raw = await fetchURL('https://events.tda-intl.org/api/events/public');
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : (data.events || data.data || []);
    tdaCache = { events: list, fetchedAt: now };
    return list;
  } catch (err) {
    logger.warn('TDA Events fetch fehlgeschlagen (ignoriert)', { error: err.message });
    return tdaCache.events; // gib gecachte zurück auch wenn abgelaufen
  }
}

// ── iCal Cache pro URL (30 Min) ───────────────────────────────────────────────
const icalUrlCache = new Map(); // url → { events, fetchedAt }
const ICAL_CACHE_TTL = 30 * 60 * 1000;

async function getIcalEvents(url) {
  const now = Date.now();
  const cached = icalUrlCache.get(url);
  if (cached && (now - cached.fetchedAt) < ICAL_CACHE_TTL) return cached.events;
  try {
    const raw = await fetchURL(url);
    const events = parseICS(raw);
    icalUrlCache.set(url, { events, fetchedAt: now });
    return events;
  } catch (err) {
    logger.warn('iCal fetch fehlgeschlagen', { url, error: err.message });
    return cached ? cached.events : [];
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Tag-Name (Deutsch) → JS-Wochentag (0=So, 1=Mo, ..., 6=Sa)
const TAGNAME_TO_DOW = {
  Montag: 1, Dienstag: 2, Mittwoch: 3, Donnerstag: 4,
  Freitag: 5, Samstag: 6, Sonntag: 0
};

/**
 * Expandiert einen Stundenplan-Eintrag (regulär) in konkrete Termine
 * innerhalb des von-bis-Bereichs.
 */
function expandStundenplan(eintraege, vonDate, bisDate) {
  const results = [];
  for (const e of eintraege) {
    const dow = TAGNAME_TO_DOW[e.tag];
    if (dow === undefined) continue;
    // Starte beim ersten Vorkommen des Wochentags ab vonDate
    const cur = new Date(vonDate);
    // Advance to first matching weekday
    const curDow = cur.getDay();
    let diff = dow - curDow;
    if (diff < 0) diff += 7;
    cur.setDate(cur.getDate() + diff);
    while (cur <= bisDate) {
      const dateStr = toDateStr(cur);
      const start = e.uhrzeit_start ? `${dateStr}T${e.uhrzeit_start}` : `${dateStr}T00:00:00`;
      const end = e.uhrzeit_ende ? `${dateStr}T${e.uhrzeit_ende}` : `${dateStr}T01:00:00`;
      results.push({
        id: `training-${e.stundenplan_id}-${dateStr}`,
        typ: 'training',
        titel: e.kursname || 'Training',
        datum_von: new Date(start).toISOString(),
        datum_bis: new Date(end).toISOString(),
        ort: null,
        dojo_id: e.dojo_id,
        farbe: '#3b82f6',
        quelle_name: 'Stundenplan'
      });
      cur.setDate(cur.getDate() + 7);
    }
  }
  return results;
}

// ── GET /api/kalender/events ──────────────────────────────────────────────────
router.get('/events', async (req, res) => {
  try {
    const { von, bis } = req.query;
    if (!von || !bis) return res.status(400).json({ success: false, error: 'von und bis sind erforderlich' });

    const vonDate = new Date(von + 'T00:00:00');
    const bisDate = new Date(bis + 'T23:59:59');
    if (isNaN(vonDate) || isNaN(bisDate)) {
      return res.status(400).json({ success: false, error: 'Ungültiges Datumsformat' });
    }

    const dojoId = getSecureDojoId(req);
    const superAdmin = isSuperAdmin(req);
    const allEvents = [];

    // 1. Events-Tabelle
    try {
      let eventsQuery, eventsParams;
      if (dojoId) {
        eventsQuery = `SELECT event_id as id, titel, datum, uhrzeit_beginn, uhrzeit_ende, ort, dojo_id
                       FROM events WHERE datum BETWEEN ? AND ? AND status != 'abgesagt' AND dojo_id = ?`;
        eventsParams = [von, bis, dojoId];
      } else {
        eventsQuery = `SELECT event_id as id, titel, datum, uhrzeit_beginn, uhrzeit_ende, ort, dojo_id
                       FROM events WHERE datum BETWEEN ? AND ? AND status != 'abgesagt'`;
        eventsParams = [von, bis];
      }
      const [evRows] = await pool.query(eventsQuery, eventsParams);
      for (const ev of evRows) {
        const dateStr = ev.datum ? toDateStr(new Date(ev.datum)) : von;
        const startTime = ev.uhrzeit_beginn || '00:00:00';
        const endTime = ev.uhrzeit_ende || startTime;
        allEvents.push({
          id: `event-${ev.id}`,
          typ: 'event',
          titel: ev.titel,
          datum_von: `${dateStr}T${startTime}`,
          datum_bis: `${dateStr}T${endTime}`,
          ort: ev.ort || null,
          dojo_id: ev.dojo_id,
          farbe: '#10b981',
          quelle_name: 'Events'
        });
      }
    } catch (err) {
      logger.warn('Kalender: Events-Abfrage fehlgeschlagen', { error: err.message });
    }

    // 2. Prüfungstermine
    try {
      let pruefQuery, pruefParams;
      if (dojoId) {
        pruefQuery = `SELECT termin_id as id, pruefungsdatum as datum, pruefungszeit as uhrzeit_beginn,
                      pruefungsort as ort, dojo_id FROM pruefungstermin_vorlagen
                      WHERE pruefungsdatum BETWEEN ? AND ? AND dojo_id = ?`;
        pruefParams = [von, bis, dojoId];
      } else {
        pruefQuery = `SELECT termin_id as id, pruefungsdatum as datum, pruefungszeit as uhrzeit_beginn,
                      pruefungsort as ort, dojo_id FROM pruefungstermin_vorlagen
                      WHERE pruefungsdatum BETWEEN ? AND ?`;
        pruefParams = [von, bis];
      }
      const [prRows] = await pool.query(pruefQuery, pruefParams);
      for (const pr of prRows) {
        const dateStr = pr.datum ? toDateStr(new Date(pr.datum)) : von;
        const startTime = pr.uhrzeit_beginn || '10:00:00';
        // Prüfungen dauern typisch 3 Stunden
        const startDate = new Date(`${dateStr}T${startTime}`);
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
        allEvents.push({
          id: `pruefung-${pr.id}`,
          typ: 'pruefung',
          titel: 'Prüfungstermin',
          datum_von: startDate.toISOString(),
          datum_bis: endDate.toISOString(),
          ort: pr.ort || null,
          dojo_id: pr.dojo_id,
          farbe: '#f59e0b',
          quelle_name: 'Prüfungen'
        });
      }
    } catch (err) {
      logger.warn('Kalender: Prüfungstermin-Abfrage fehlgeschlagen', { error: err.message });
    }

    // 3. Stundenplan-Expansion
    try {
      let spQuery, spParams;
      if (dojoId) {
        spQuery = `SELECT s.stundenplan_id, s.tag, s.uhrzeit_start, s.uhrzeit_ende,
                   CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname, k.dojo_id
                   FROM stundenplan s JOIN kurse k ON s.kurs_id = k.kurs_id
                   WHERE s.typ = 'regulaer' AND k.dojo_id = ?`;
        spParams = [dojoId];
      } else {
        spQuery = `SELECT s.stundenplan_id, s.tag, s.uhrzeit_start, s.uhrzeit_ende,
                   CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname, k.dojo_id
                   FROM stundenplan s JOIN kurse k ON s.kurs_id = k.kurs_id
                   WHERE s.typ = 'regulaer'`;
        spParams = [];
      }
      const [spRows] = await pool.query(spQuery, spParams);
      const expanded = expandStundenplan(spRows, vonDate, bisDate);
      allEvents.push(...expanded);
    } catch (err) {
      logger.warn('Kalender: Stundenplan-Abfrage fehlgeschlagen', { error: err.message });
    }

    // 4. TDA-Events (öffentlich)
    try {
      const tdaList = await getTdaEvents();
      for (const ev of tdaList) {
        const evDate = new Date(ev.datum || ev.date || ev.start_date || '');
        if (isNaN(evDate)) continue;
        if (evDate < vonDate || evDate > bisDate) continue;
        const dateStr = toDateStr(evDate);
        allEvents.push({
          id: `tda-${ev.id || ev.event_id || Math.random()}`,
          typ: 'tda',
          titel: ev.titel || ev.title || ev.name || 'TDA Event',
          datum_von: `${dateStr}T${ev.uhrzeit_beginn || ev.start_time || '00:00:00'}`,
          datum_bis: `${dateStr}T${ev.uhrzeit_ende || ev.end_time || '23:59:00'}`,
          ort: ev.ort || ev.location || ev.venue || null,
          dojo_id: null,
          farbe: '#8b5cf6',
          quelle_name: 'TDA Events'
        });
      }
    } catch (err) {
      logger.warn('Kalender: TDA-Events fehlgeschlagen (ignoriert)', { error: err.message });
    }

    // 5. iCal-URLs (Super-Admin eigene URL + Dojo-spezifische URLs)
    try {
      const icalUrls = [];

      // Super-Admin eigene iCal-URL
      if (superAdmin) {
        const [saRows] = await pool.query(
          "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
        );
        if (saRows[0]?.setting_value) {
          icalUrls.push({ name: 'Privat/Persönlich', url: saRows[0].setting_value, farbe: '#6366f1' });
        }
      }

      // Dojo-spezifische iCal-URLs
      let dbIcalRows;
      if (dojoId) {
        [dbIcalRows] = await pool.query(
          'SELECT name, url, farbe FROM kalender_ical_urls WHERE aktiv = 1 AND dojo_id = ?',
          [dojoId]
        );
      } else if (superAdmin) {
        [dbIcalRows] = await pool.query(
          'SELECT name, url, farbe FROM kalender_ical_urls WHERE aktiv = 1'
        );
      } else {
        dbIcalRows = [];
      }
      icalUrls.push(...(dbIcalRows || []));

      for (const ical of icalUrls) {
        const icsEvents = await getIcalEvents(ical.url);
        for (const ev of icsEvents) {
          if (!ev.start) continue;
          const evEnd = ev.end || new Date(ev.start.getTime() + 60 * 60 * 1000);
          if (ev.start > bisDate || evEnd < vonDate) continue;
          allEvents.push({
            id: `extern-${ical.url}-${ev.uid || ev.start.getTime()}`,
            typ: 'extern',
            titel: ev.summary || 'Termin',
            datum_von: ev.start.toISOString(),
            datum_bis: evEnd.toISOString(),
            ort: ev.location || null,
            dojo_id: null,
            farbe: ical.farbe || '#6366f1',
            quelle_name: ical.name || 'Extern'
          });
        }
      }
    } catch (err) {
      logger.warn('Kalender: iCal-Feeds fehlgeschlagen', { error: err.message });
    }

    // Sortieren nach datum_von
    allEvents.sort((a, b) => new Date(a.datum_von) - new Date(b.datum_von));

    res.json({ success: true, events: allEvents });
  } catch (err) {
    logger.error('Kalender: GET /events Fehler', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/kalender/ical-urls ───────────────────────────────────────────────
router.get('/ical-urls', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const superAdmin = isSuperAdmin(req);

    let rows;
    if (dojoId) {
      [rows] = await pool.query(
        'SELECT id, name, url, farbe, aktiv FROM kalender_ical_urls WHERE dojo_id = ? ORDER BY id',
        [dojoId]
      );
    } else if (superAdmin) {
      [rows] = await pool.query(
        'SELECT id, dojo_id, name, url, farbe, aktiv FROM kalender_ical_urls ORDER BY id'
      );
    } else {
      rows = [];
    }
    res.json({ success: true, urls: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/kalender/ical-urls ──────────────────────────────────────────────
router.post('/ical-urls', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId && !isSuperAdmin(req)) {
      return res.status(400).json({ success: false, error: 'Keine Dojo-ID' });
    }
    const { name, url, farbe } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, error: 'name und url erforderlich' });

    const targetDojoId = dojoId || (req.body.dojo_id ? parseInt(req.body.dojo_id, 10) : null);
    const [result] = await pool.query(
      'INSERT INTO kalender_ical_urls (dojo_id, name, url, farbe, aktiv) VALUES (?, ?, ?, ?, 1)',
      [targetDojoId, name, url, farbe || '#6366f1']
    );
    icalUrlCache.delete(url); // Cache invalidieren
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/kalender/ical-urls/:id ────────────────────────────────────────
router.delete('/ical-urls/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dojoId = getSecureDojoId(req);
    const superAdmin = isSuperAdmin(req);

    // Ownership prüfen
    const [rows] = await pool.query('SELECT dojo_id, url FROM kalender_ical_urls WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Nicht gefunden' });

    if (!superAdmin && rows[0].dojo_id !== dojoId) {
      return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    }

    icalUrlCache.delete(rows[0].url);
    await pool.query('DELETE FROM kalender_ical_urls WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/kalender/konflikt-check ─────────────────────────────────────────
router.post('/konflikt-check', async (req, res) => {
  try {
    const { datum, von: vonZeit, bis: bisZeit, dojo_id: bodyDojoId } = req.body;
    if (!datum || !vonZeit) {
      return res.status(400).json({ success: false, error: 'datum und von erforderlich' });
    }

    const dojoId = getSecureDojoId(req) || (bodyDojoId ? parseInt(bodyDojoId, 10) : null);
    const checkStart = new Date(`${datum}T${vonZeit}`);
    const checkEnd = bisZeit ? new Date(`${datum}T${bisZeit}`) : new Date(checkStart.getTime() + 3 * 60 * 60 * 1000);

    const konflikte = [];
    const dateStr = datum;

    // Events
    try {
      let evQuery, evParams;
      if (dojoId) {
        evQuery = `SELECT titel, datum, uhrzeit_beginn, uhrzeit_ende FROM events
                   WHERE datum = ? AND status != 'abgesagt' AND dojo_id = ?`;
        evParams = [datum, dojoId];
      } else {
        evQuery = `SELECT titel, datum, uhrzeit_beginn, uhrzeit_ende FROM events
                   WHERE datum = ? AND status != 'abgesagt'`;
        evParams = [datum];
      }
      const [evRows] = await pool.query(evQuery, evParams);
      for (const ev of evRows) {
        const evStart = new Date(`${dateStr}T${ev.uhrzeit_beginn || '00:00:00'}`);
        const evEnd = new Date(`${dateStr}T${ev.uhrzeit_ende || ev.uhrzeit_beginn || '23:59:00'}`);
        if (!(evEnd <= checkStart || evStart >= checkEnd)) {
          konflikte.push({ typ: 'event', titel: ev.titel, von: evStart.toISOString(), bis: evEnd.toISOString() });
        }
      }
    } catch (err) {
      logger.warn('Konflikt-Check Events fehlgeschlagen', { error: err.message });
    }

    // Prüfungstermine
    try {
      let prQuery, prParams;
      if (dojoId) {
        prQuery = `SELECT pruefungsdatum, pruefungszeit FROM pruefungstermin_vorlagen
                   WHERE pruefungsdatum = ? AND dojo_id = ?`;
        prParams = [datum, dojoId];
      } else {
        prQuery = `SELECT pruefungsdatum, pruefungszeit FROM pruefungstermin_vorlagen WHERE pruefungsdatum = ?`;
        prParams = [datum];
      }
      const [prRows] = await pool.query(prQuery, prParams);
      for (const pr of prRows) {
        const prStart = new Date(`${dateStr}T${pr.pruefungszeit || '10:00:00'}`);
        const prEnd = new Date(prStart.getTime() + 3 * 60 * 60 * 1000);
        if (!(prEnd <= checkStart || prStart >= checkEnd)) {
          konflikte.push({ typ: 'pruefung', titel: 'Prüfungstermin', von: prStart.toISOString(), bis: prEnd.toISOString() });
        }
      }
    } catch (err) {
      logger.warn('Konflikt-Check Prüfungen fehlgeschlagen', { error: err.message });
    }

    // Stundenplan (reguläre Einträge am gleichen Wochentag)
    try {
      const checkDow = checkStart.getDay(); // 0=So, 1=Mo, ...
      const DOW_TO_TAGNAME = { 0: 'Sonntag', 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag' };
      const tagName = DOW_TO_TAGNAME[checkDow];
      let spQuery, spParams;
      if (dojoId) {
        spQuery = `SELECT s.uhrzeit_start, s.uhrzeit_ende, CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname
                   FROM stundenplan s JOIN kurse k ON s.kurs_id = k.kurs_id
                   WHERE s.typ = 'regulaer' AND s.tag = ? AND k.dojo_id = ?`;
        spParams = [tagName, dojoId];
      } else {
        spQuery = `SELECT s.uhrzeit_start, s.uhrzeit_ende, CONCAT_WS(' – ', k.stil, k.gruppenname) AS kursname
                   FROM stundenplan s JOIN kurse k ON s.kurs_id = k.kurs_id
                   WHERE s.typ = 'regulaer' AND s.tag = ?`;
        spParams = [tagName];
      }
      const [spRows] = await pool.query(spQuery, spParams);
      for (const sp of spRows) {
        const spStart = new Date(`${dateStr}T${sp.uhrzeit_start || '00:00:00'}`);
        const spEnd = new Date(`${dateStr}T${sp.uhrzeit_ende || sp.uhrzeit_start || '01:00:00'}`);
        if (!(spEnd <= checkStart || spStart >= checkEnd)) {
          konflikte.push({ typ: 'training', titel: sp.kursname || 'Training', von: spStart.toISOString(), bis: spEnd.toISOString() });
        }
      }
    } catch (err) {
      logger.warn('Konflikt-Check Stundenplan fehlgeschlagen', { error: err.message });
    }

    res.json({ success: true, konflikt: konflikte.length > 0, konflikte });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
