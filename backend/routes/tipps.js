// ============================================================================
// ADMIN-TIPPS — API für die „Wusstest du schon…?"-Feature-Tipps im Dashboard.
//
// Nur für den Admin-Bereich der Dojo-Software (Inhaber/Staff), NICHT für die
// Mitglieder-App. Der Lese-/Später-/Aus-Status wird pro Mitarbeiter gespeichert
// (admin_users.id = req.user.id).
//
// Endpunkte (gemountet unter /api/admin/tipps):
//   GET  /                 → { aktiv, tipps: [{...tipp, status}] }
//   POST /status           → { tipp_id, status: 'erledigt'|'spaeter'|null }
//   POST /einstellung      → { aktiv: boolean }   (keine Tipps mehr / wieder an)
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { ADMIN_TIPPS } = require('../data/adminTipps');

// Staff-Rollen, die Tipps sehen dürfen. Mitglieder (member/user/mitglied) NICHT
// — die Tipps drehen sich ausschließlich um die Bedienung der Admin-Software.
const STAFF_ROLLEN = new Set([
  'admin', 'super_admin', 'dojoleiter', 'assistenztrainer',
  'kassenwart', 'pruefer', 'rezeption', 'trainer',
]);

const gueltigeTippIds = new Set(ADMIN_TIPPS.map(t => t.id));

// Middleware: nur Staff, und wir brauchen eine stabile admin_users-id.
function requireStaffTipps(req, res, next) {
  const rolle = (req.user?.rolle || req.user?.role || '').toString().toLowerCase();
  if (!STAFF_ROLLEN.has(rolle)) {
    return res.status(403).json({ error: 'Tipps sind nur im Admin-Bereich verfügbar.' });
  }
  const adminId = Number(req.user?.id);
  if (!adminId) {
    return res.status(400).json({ error: 'Kein gültiger Benutzer im Token.' });
  }
  req.tippAdminId = adminId;
  next();
}

router.use(requireStaffTipps);

// ── GET / — Tipps inkl. persönlichem Status + Aktiv-Flag ────────────────────
router.get('/', async (req, res) => {
  const adminId = req.tippAdminId;
  try {
    const [[einstellung]] = await db.promise().query(
      'SELECT aktiv FROM admin_tipp_einstellung WHERE admin_id = ?',
      [adminId]
    );
    const aktiv = einstellung ? Number(einstellung.aktiv) === 1 : true;

    const [statusRows] = await db.promise().query(
      'SELECT tipp_id, status FROM admin_tipp_status WHERE admin_id = ?',
      [adminId]
    );
    const statusMap = new Map(statusRows.map(r => [Number(r.tipp_id), r.status]));

    const tipps = ADMIN_TIPPS.map(t => ({
      id: t.id,
      kategorie: t.kategorie,
      icon: t.icon,
      titel: t.titel,
      text: t.text,
      status: statusMap.get(t.id) || null, // null = ungelesen, 'spaeter', 'erledigt'
    }));

    res.json({ aktiv, tipps });
  } catch (err) {
    logger.error('Fehler beim Laden der Admin-Tipps:', err);
    res.status(500).json({ error: 'Tipps konnten nicht geladen werden.' });
  }
});

// ── POST /status — Tipp abhaken / später / zurücksetzen ─────────────────────
router.post('/status', async (req, res) => {
  const adminId = req.tippAdminId;
  const tippId = Number(req.body?.tipp_id);
  const status = req.body?.status; // 'erledigt' | 'spaeter' | null

  if (!gueltigeTippIds.has(tippId)) {
    return res.status(400).json({ error: 'Unbekannter Tipp.' });
  }
  if (status !== 'erledigt' && status !== 'spaeter' && status !== null) {
    return res.status(400).json({ error: 'Ungültiger Status.' });
  }

  try {
    if (status === null) {
      // Zurücksetzen = Zeile löschen (Tipp gilt wieder als ungelesen)
      await db.promise().query(
        'DELETE FROM admin_tipp_status WHERE admin_id = ? AND tipp_id = ?',
        [adminId, tippId]
      );
    } else {
      await db.promise().query(
        `INSERT INTO admin_tipp_status (admin_id, tipp_id, status)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), aktualisiert_am = CURRENT_TIMESTAMP`,
        [adminId, tippId, status]
      );
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Speichern des Tipp-Status:', err);
    res.status(500).json({ error: 'Status konnte nicht gespeichert werden.' });
  }
});

// ── POST /einstellung — Tipps global aus/ein ────────────────────────────────
router.post('/einstellung', async (req, res) => {
  const adminId = req.tippAdminId;
  const aktiv = req.body?.aktiv ? 1 : 0;
  try {
    await db.promise().query(
      `INSERT INTO admin_tipp_einstellung (admin_id, aktiv)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE aktiv = VALUES(aktiv), aktualisiert_am = CURRENT_TIMESTAMP`,
      [adminId, aktiv]
    );
    res.json({ success: true, aktiv: aktiv === 1 });
  } catch (err) {
    logger.error('Fehler beim Speichern der Tipp-Einstellung:', err);
    res.status(500).json({ error: 'Einstellung konnte nicht gespeichert werden.' });
  }
});

module.exports = router;
