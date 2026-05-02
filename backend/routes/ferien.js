/**
 * Schulferien-Route — DojoSoftware
 * Daten von openholidaysapi.org (kostenlos, kein Key nötig)
 * Cache: 24h im Memory
 */
const express = require('express');
const https   = require('https');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Memory-Cache: key → { data, ts }
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const BUNDESLAENDER = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

function fetchHolidays(subdivisionCode, validFrom, validTo) {
  const cacheKey = `${subdivisionCode}-${validFrom.substring(0,7)}-${validTo.substring(0,7)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Promise.resolve(cached.data);

  const qs = subdivisionCode
    ? `countryIsoCode=DE&languageIsoCode=DE&validFrom=${validFrom}&validTo=${validTo}&subdivisionCode=DE-${subdivisionCode}`
    : `countryIsoCode=DE&languageIsoCode=DE&validFrom=${validFrom}&validTo=${validTo}`;

  const url = `https://openholidaysapi.org/SchoolHolidays?${qs}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' }, timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          cache.set(cacheKey, { data, ts: Date.now() });
          resolve(data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// GET /api/ferien/bundeslaender — Liste aller Bundesländer
router.get('/bundeslaender', (req, res) => {
  res.json({ bundeslaender: Object.entries(BUNDESLAENDER).map(([code, name]) => ({ code, name })) });
});

// GET /api/ferien/check?datum=2026-06-15&end_datum=2026-06-20&bundesland=BY&modus=bundesland
router.get('/check', async (req, res) => {
  const { datum, end_datum, bundesland, modus } = req.query;
  if (!datum) return res.status(400).json({ error: 'datum fehlt' });

  const start = datum.substring(0, 10);
  const end   = (end_datum || datum).substring(0, 10);

  // Jahres-Range für API (ggf. jahresübergreifend)
  const y1 = start.substring(0, 4);
  const y2 = end.substring(0, 4);
  const apiFrom = `${y1}-01-01`;
  const apiTo   = `${y2}-12-31`;

  try {
    let holidays;
    if (modus === 'alle' || !bundesland) {
      holidays = await fetchHolidays(null, apiFrom, apiTo);
    } else {
      holidays = await fetchHolidays(bundesland, apiFrom, apiTo);
    }

    // Überschneidung prüfen
    const eventStart = new Date(start);
    const eventEnd   = new Date(end);

    const treffer = (holidays || []).filter(h => {
      const fs = new Date(h.startDate);
      const fe = new Date(h.endDate);
      return fs <= eventEnd && fe >= eventStart;
    }).map(h => ({
      name:  (h.name || []).find(n => n.language === 'DE')?.text || 'Schulferien',
      start: h.startDate,
      end:   h.endDate,
      bundesland: (h.subdivisions || []).map(s => s.shortName).join(', ') || 'DE',
    }));

    res.json({ warnung: treffer.length > 0, ferien: treffer });
  } catch (err) {
    // Bei API-Fehler: kein Blocking, nur leere Antwort
    res.json({ warnung: false, ferien: [], fehler: err.message });
  }
});

module.exports = router;
