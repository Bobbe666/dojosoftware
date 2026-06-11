// Schlanke Member-App-Telemetrie: erfasst pro App-Start Ladezeit + Gerät + Netzqualität.
// Ziel: herausfinden, WELCHE Mitglieder/Geräte/Netze langsam sind ("bei mir geht, bei manchen nicht").
// Auto-gemountet unter /api/perf.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const clip = (s, n) => (s == null ? null : String(s).slice(0, n));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

// POST /api/perf/member-load — Beacon vom Member-Dashboard
router.post('/member-load', authenticateToken, (req, res) => {
  const u = req.user || {};
  const b = req.body || {};
  db.query(
    `INSERT INTO member_perf_log
       (mitglied_id, dojo_id, load_ms, ttfb_ms, dom_ms, conn_type, downlink, rtt,
        device_memory, hw_concurrency, viewport, user_agent, fehler, erstellt_am)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [
      u.mitglied_id || null, u.dojo_id || null,
      int(b.load_ms), int(b.ttfb_ms), int(b.dom_ms),
      clip(b.conn_type, 20), num(b.downlink), int(b.rtt),
      num(b.device_memory), int(b.hw_concurrency),
      clip(b.viewport, 20), clip(b.user_agent, 300), clip(b.fehler, 500),
    ],
    () => {} // fire-and-forget, Telemetrie darf nie stören
  );
  res.json({ success: true });
});

module.exports = router;
