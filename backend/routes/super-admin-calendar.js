// ============================================================================
// SUPER-ADMIN KALENDER — iCloud iCal Sync + Konflikt-Check
// Route: /api/admin/calendar/...
// ============================================================================
const express = require('express');
const router  = express.Router();
const https   = require('https');
const http    = require('http');
const crypto  = require('crypto');
const db      = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const pool = db.promise();

// Verbände, die per Sync abgefragt werden (Default, falls Client keine Auswahl schickt)
const DEFAULT_SYNC_VERBAENDE = ['DKV', 'WKU', 'WAKO', 'Taekwondo', 'BKO', 'WMAC', 'WOMAA'];

// In-Memory Cache (1 Stunde)
let icalCache = { events: [], fetchedAt: null, url: null };
const CACHE_TTL = 60 * 60 * 1000;

// Super-Admin Guard
function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const isSuperAdmin = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

// ── ICS Parser ────────────────────────────────────────────────────────────────
function parseICSDate(value, keyFull) {
  if (!value) return null;
  if (/VALUE=DATE/.test(keyFull) || /^\d{8}$/.test(value)) {
    return { date: new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00`), allDay: true };
  }
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return { date: new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}Z`), allDay: false };
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    return { date: new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}`), allDay: false };
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
    } else { unfolded.push(line); }
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
    if (key === 'DTSTART') { const p = parseICSDate(val, keyFull); if (p) { cur.start = p.date; cur.allDay = p.allDay; } }
    else if (key === 'DTEND') { const p = parseICSDate(val, keyFull); if (p) cur.end = p.date; }
    else if (key === 'SUMMARY') cur.summary = val.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\;/g, ';');
    else if (key === 'LOCATION') cur.location = val.replace(/\\n/g, ' ').replace(/\\,/g, ',');
    else if (key === 'UID') cur.uid = val;
  }
  return events;
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const normalized = url.replace(/^webcal:\/\//i, 'https://');
    const mod = normalized.startsWith('https') ? https : http;
    const req = mod.get(normalized, { timeout: 12000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout beim Abrufen der iCal-URL')); });
  });
}

async function getOrRefreshCache(url) {
  const now = Date.now();
  if (icalCache.url === url && icalCache.fetchedAt && (now - icalCache.fetchedAt) < CACHE_TTL) {
    return icalCache.events;
  }
  const icsText = await fetchURL(url);
  const events  = parseICS(icsText);
  icalCache = { events, fetchedAt: now, url };
  return events;
}

// ── GET /api/admin/calendar/settings ─────────────────────────────────────────
router.get('/settings', onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
    );
    res.json({ success: true, ical_url: rows[0]?.setting_value || '' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/admin/calendar/settings ─────────────────────────────────────────
router.put('/settings', onlySuperAdmin, async (req, res) => {
  try {
    const { ical_url } = req.body;
    await pool.query(`
      INSERT INTO saas_settings (setting_key, display_name, setting_value, setting_type, category, is_secret)
      VALUES ('super_admin_ical_url', 'iCloud Kalender URL', ?, 'string', 'general', 1)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `, [ical_url || '']);
    icalCache = { events: [], fetchedAt: null, url: null };
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/calendar/events ────────────────────────────────────────────
router.get('/events', onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
    );
    const url = rows[0]?.setting_value || '';
    if (!url) return res.json({ success: true, events: [], hint: 'Keine iCal-URL konfiguriert' });

    const allEvents = await getOrRefreshCache(url);
    const now   = new Date(); now.setHours(0,0,0,0);
    const limit = new Date(now); limit.setDate(limit.getDate() + 90);

    const filtered = allEvents
      .filter(e => e.start >= now && e.start <= limit)
      .sort((a, b) => a.start - b.start)
      .map(e => ({
        uid:      e.uid || '',
        summary:  e.summary,
        location: e.location || '',
        allDay:   !!e.allDay,
        start:    e.start.toISOString(),
        end:      e.end ? e.end.toISOString() : null
      }));

    res.json({ success: true, events: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/calendar/check-conflict ───────────────────────────────────
router.post('/check-conflict', onlySuperAdmin, async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start) return res.status(400).json({ success: false, error: 'start fehlt' });

    const checkStart = new Date(start);
    const checkEnd   = end ? new Date(end) : new Date(checkStart.getTime() + 2 * 60 * 60 * 1000);
    const conflicts  = [];

    // 1) Privater iCloud-Kalender (falls konfiguriert)
    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
    );
    const url = rows[0]?.setting_value || '';
    if (url) {
      const allEvents = await getOrRefreshCache(url);
      allEvents.forEach(e => {
        if (!e.start) return;
        const eEnd = e.end || new Date(e.start.getTime() + 60 * 60 * 1000);
        if (!(eEnd <= checkStart || e.start >= checkEnd)) {
          conflicts.push({
            source:   'privat',
            summary:  e.summary,
            location: e.location || '',
            allDay:   !!e.allDay,
            start:    e.start.toISOString(),
            end:      e.end ? e.end.toISOString() : null
          });
        }
      });
    }

    // 2) Verbands-Fremdtermine (nur bestätigte) — tagesbasierter Overlap
    const dStart = checkStart.toISOString().slice(0, 10);
    const dEnd   = checkEnd.toISOString().slice(0, 10);
    try {
      const [ft] = await pool.query(
        `SELECT verband, titel, start_datum, end_datum, ort, region, quelle_url
           FROM verbands_fremdtermine
          WHERE status = 'bestaetigt'
            AND start_datum <= ?
            AND COALESCE(end_datum, start_datum) >= ?
          ORDER BY start_datum`,
        [dEnd, dStart]
      );
      ft.forEach(f => {
        conflicts.push({
          source:   'verband',
          verband:  f.verband,
          summary:  `[${f.verband}] ${f.titel}`,
          location: [f.ort, f.region].filter(Boolean).join(', '),
          allDay:   true,
          start:    f.start_datum,
          end:      f.end_datum || f.start_datum,
          quelle_url: f.quelle_url || ''
        });
      });
    } catch (e) {
      // Tabelle evtl. noch nicht migriert → Verbandsprüfung still überspringen
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    res.json({ success: true, conflicts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/calendar/my-feed-url ───────────────────────────────────────
router.get('/my-feed-url', onlySuperAdmin, (req, res) => {
  const token   = crypto.createHash('sha256').update(`super-admin-ical-${JWT_SECRET}`).digest('hex').substring(0, 32);
  const baseUrl = (process.env.API_BASE_URL || 'https://dojo.tda-intl.org/api').replace(/\/api$/, '');
  const feedUrl = `${baseUrl}/api/ical/super-admin/${token}`;
  res.json({ success: true, feedUrl, webcalUrl: feedUrl.replace(/^https?:\/\//, 'webcal://') });
});

// ============================================================================
// VERBANDS-FREMDTERMINE — Turniertermine anderer Kampfsportverbände
// ============================================================================

function isValidDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// ── GET /api/admin/calendar/fremdtermine ──────────────────────────────────────
// Optional: ?status=bestaetigt|unbestaetigt  ?upcoming=1 (nur ab heute)
router.get('/fremdtermine', onlySuperAdmin, async (req, res) => {
  try {
    const where = [];
    const params = [];
    if (req.query.status === 'bestaetigt' || req.query.status === 'unbestaetigt') {
      where.push('status = ?'); params.push(req.query.status);
    }
    if (req.query.upcoming === '1') {
      where.push('COALESCE(end_datum, start_datum) >= CURDATE()');
    }
    const sql = `SELECT id, verband, titel, start_datum, end_datum, ort, region,
                        quelle_url, notiz, status, quelle_typ, created_at
                   FROM verbands_fremdtermine
                  ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                  ORDER BY start_datum ASC, verband ASC`;
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, termine: rows });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, termine: [], hint: 'Migration 209 noch nicht ausgeführt' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/calendar/fremdtermine ─────────────────────────────────────
router.post('/fremdtermine', onlySuperAdmin, async (req, res) => {
  try {
    const { verband, titel, start_datum, end_datum, ort, region, quelle_url, notiz, status } = req.body || {};
    if (!verband || !String(verband).trim()) return res.status(400).json({ success: false, error: 'Verband fehlt' });
    if (!titel || !String(titel).trim())     return res.status(400).json({ success: false, error: 'Titel fehlt' });
    if (!isValidDate(start_datum))            return res.status(400).json({ success: false, error: 'Startdatum ungültig (YYYY-MM-DD)' });
    if (end_datum && !isValidDate(end_datum)) return res.status(400).json({ success: false, error: 'Enddatum ungültig (YYYY-MM-DD)' });

    const [r] = await pool.query(
      `INSERT INTO verbands_fremdtermine
         (verband, titel, start_datum, end_datum, ort, region, quelle_url, notiz, status, quelle_typ)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manuell')`,
      [String(verband).trim().slice(0, 80), String(titel).trim().slice(0, 255),
       start_datum, end_datum || null, ort || null, region || null,
       quelle_url || null, notiz || null,
       status === 'unbestaetigt' ? 'unbestaetigt' : 'bestaetigt']
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/admin/calendar/fremdtermine/:id ──────────────────────────────────
router.put('/fremdtermine/:id', onlySuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, error: 'Ungültige ID' });

    const fields = [];
    const params = [];
    const b = req.body || {};
    if (b.verband !== undefined)    { fields.push('verband = ?');    params.push(String(b.verband).trim().slice(0, 80)); }
    if (b.titel !== undefined)      { fields.push('titel = ?');      params.push(String(b.titel).trim().slice(0, 255)); }
    if (b.start_datum !== undefined) {
      if (!isValidDate(b.start_datum)) return res.status(400).json({ success: false, error: 'Startdatum ungültig' });
      fields.push('start_datum = ?'); params.push(b.start_datum);
    }
    if (b.end_datum !== undefined)  {
      if (b.end_datum && !isValidDate(b.end_datum)) return res.status(400).json({ success: false, error: 'Enddatum ungültig' });
      fields.push('end_datum = ?'); params.push(b.end_datum || null);
    }
    if (b.ort !== undefined)        { fields.push('ort = ?');        params.push(b.ort || null); }
    if (b.region !== undefined)     { fields.push('region = ?');     params.push(b.region || null); }
    if (b.quelle_url !== undefined) { fields.push('quelle_url = ?'); params.push(b.quelle_url || null); }
    if (b.notiz !== undefined)      { fields.push('notiz = ?');      params.push(b.notiz || null); }
    if (b.status !== undefined)     { fields.push('status = ?');     params.push(b.status === 'unbestaetigt' ? 'unbestaetigt' : 'bestaetigt'); }

    if (!fields.length) return res.status(400).json({ success: false, error: 'Keine Felder zum Aktualisieren' });
    params.push(id);
    await pool.query(`UPDATE verbands_fremdtermine SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/calendar/fremdtermine/:id ───────────────────────────────
router.delete('/fremdtermine/:id', onlySuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, error: 'Ungültige ID' });
    await pool.query('DELETE FROM verbands_fremdtermine WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/calendar/fremdtermine/sync ────────────────────────────────
// Stufe 2: Claude mit Web-Suche findet kommende Verbands-Turniere → als
// 'unbestaetigt' eingetragen. Bestätigung erfolgt manuell im Frontend.
router.post('/fremdtermine/sync', onlySuperAdmin, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(400).json({ success: false, error: 'ANTHROPIC_API_KEY nicht konfiguriert' });
    }
    const verbaende = (Array.isArray(req.body?.verbaende) && req.body.verbaende.length)
      ? req.body.verbaende.map(v => String(v).trim()).filter(Boolean)
      : DEFAULT_SYNC_VERBAENDE;

    const heute = new Date().toISOString().slice(0, 10);
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Du recherchierst kommende Kampfsport-Turniere/Wettkämpfe folgender Verbände, um Terminüberschneidungen mit eigenen Turnieren zu vermeiden.

Verbände: ${verbaende.join(', ')}
Zeitraum: ab heute (${heute}) bis 12 Monate in die Zukunft.
Fokus: Deutschland (DACH-Raum), plus international relevante Großevents dieser Verbände.

Nutze die Web-Suche, um die offiziellen Turnierkalender/Terminlisten dieser Verbände zu finden. Trage NUR Termine mit konkretem Datum ein (keine "TBA"/unklaren Termine).

Gib am Ende AUSSCHLIESSLICH ein JSON-Array zurück (kein weiterer Text danach), Format pro Eintrag:
{"verband":"<Kürzel aus der Liste>","titel":"<Turniername>","start_datum":"YYYY-MM-DD","end_datum":"YYYY-MM-DD oder null","ort":"<Stadt/Halle oder null>","region":"<Bundesland/Land oder null>","quelle_url":"<direkter Link zur konkreten Turnier-/Ausschreibungsseite; falls es keine eigene Turnierseite gibt, die offizielle Kalender-/Terminseite des Verbands>"}

Wenn für einen Verband nichts Konkretes auffindbar ist, lass ihn weg. Maximal 40 Einträge.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: prompt }]
    });

    const text = (response.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // JSON-Array aus der Antwort extrahieren
    let parsed = [];
    const m = text.match(/\[[\s\S]*\]/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = []; } }
    if (!Array.isArray(parsed)) parsed = [];

    let inserted = 0, skipped = 0;
    for (const e of parsed) {
      const verband = String(e?.verband || '').trim().slice(0, 80);
      const titel   = String(e?.titel || '').trim().slice(0, 255);
      const start   = e?.start_datum;
      if (!verband || !titel || !isValidDate(start)) { skipped++; continue; }
      const end = isValidDate(e?.end_datum) ? e.end_datum : null;

      // Duplikat-Check: gleicher Verband + gleiches Startdatum + ähnlicher Titel
      const [dup] = await pool.query(
        `SELECT id FROM verbands_fremdtermine
          WHERE verband = ? AND start_datum = ? AND LOWER(titel) = LOWER(?) LIMIT 1`,
        [verband, start, titel]
      );
      if (dup.length) { skipped++; continue; }

      await pool.query(
        `INSERT INTO verbands_fremdtermine
           (verband, titel, start_datum, end_datum, ort, region, quelle_url, status, quelle_typ)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'unbestaetigt', 'sync')`,
        [verband, titel, start, end,
         e?.ort ? String(e.ort).slice(0, 255) : null,
         e?.region ? String(e.region).slice(0, 120) : null,
         e?.quelle_url ? String(e.quelle_url).slice(0, 500) : null]
      );
      inserted++;
    }

    res.json({ success: true, found: parsed.length, inserted, skipped });
  } catch (err) {
    console.error('[fremdtermine/sync]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
