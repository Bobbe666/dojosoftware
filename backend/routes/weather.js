// Backend/routes/weather.js — Wetter für den Standort des aktiven Dojos.
// Als Backend-Proxy gebaut, weil die Frontend-CSP (connect-src 'self') keine
// direkten open-meteo-Aufrufe erlaubt. Standort kommt aus dem JWT-Dojo (dojo.ort),
// nie hartcodiert — so sieht jedes Dojo sein eigenes Wetter.
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// GET /api/weather — aktuelles Wetter am Dojo-Standort
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.json({ success: false, reason: 'no_dojo' });

    const [[dojo]] = await db.promise().query('SELECT ort FROM dojo WHERE id = ?', [dojoId]);
    const ort = dojo?.ort ? String(dojo.ort).trim() : '';
    if (!ort) return res.json({ success: false, reason: 'no_ort' });

    // 1) Ort → Koordinaten (Open-Meteo Geocoding, kostenlos, kein Key)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ort)}&count=1&language=de&format=json`
    );
    const geo = geoRes.ok ? await geoRes.json() : null;
    const place = geo?.results?.[0];
    if (!place) return res.json({ success: false, reason: 'geocode_failed', ort });

    // 2) Aktuelles Wetter für diese Koordinaten
    const wRes = await fetch(
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${place.latitude}&longitude=${place.longitude}` +
      '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
      '&wind_speed_unit=kmh&timezone=Europe%2FBerlin'
    );
    if (!wRes.ok) throw new Error('Wetter-API nicht erreichbar');
    const data = await wRes.json();

    res.json({ success: true, location: place.name || ort, current: data.current });
  } catch (err) {
    logger.warn('Wetter konnte nicht geladen werden', { error: err.message });
    res.json({ success: false, reason: 'error' });
  }
});

module.exports = router;
