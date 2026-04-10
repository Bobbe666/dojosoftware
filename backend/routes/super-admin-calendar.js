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

    const [rows] = await pool.query(
      "SELECT setting_value FROM saas_settings WHERE setting_key = 'super_admin_ical_url' LIMIT 1"
    );
    const url = rows[0]?.setting_value || '';
    if (!url) return res.json({ success: true, conflicts: [] });

    const allEvents  = await getOrRefreshCache(url);
    const checkStart = new Date(start);
    const checkEnd   = end ? new Date(end) : new Date(checkStart.getTime() + 2 * 60 * 60 * 1000);

    const conflicts = allEvents.filter(e => {
      if (!e.start) return false;
      const eEnd = e.end || new Date(e.start.getTime() + 60 * 60 * 1000);
      return !(eEnd <= checkStart || e.start >= checkEnd);
    }).map(e => ({
      summary:  e.summary,
      location: e.location || '',
      allDay:   !!e.allDay,
      start:    e.start.toISOString(),
      end:      e.end ? e.end.toISOString() : null
    }));

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

module.exports = router;
