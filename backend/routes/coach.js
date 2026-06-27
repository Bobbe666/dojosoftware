// ============================================================================
// COACH-APP (Enterprise Trainer-App, coach.tda-intl.org)
// Bootstrap-Endpunkt: prüft Zugang (Rolle + Enterprise-Feature) und liefert das
// White-Label-Branding des Dojos (Name, Logo, Primärfarbe).
// Auto-gemountet unter /api/coach.
// ============================================================================
const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const pool = db.promise();
const COACH_ROLES = ['trainer', 'supervisor', 'admin', 'super_admin'];

// Primärfarbe aus dem (JSON-)theme_config eines Dojos herausziehen — tolerant
// gegen verschiedene Schlüssel/Strukturen, sonst null (App nimmt Default-Rot).
function pickPrimary(themeConfig) {
  if (!themeConfig) return null;
  let c = themeConfig;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  return c.primary || c.accent || c['--accent'] || c.primaryColor
      || c?.colors?.primary || c?.colors?.accent || c?.tokens?.['--accent'] || null;
}

// GET /api/coach/bootstrap — Gate + Branding für die Coach-App
router.get('/bootstrap', authenticateToken, async (req, res) => {
  try {
    const role = req.user?.role || req.user?.rolle;
    if (!COACH_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Kein Coach-Zugang für diese Rolle.' });
    }

    const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
    const isSuper = userId == 1 || req.user?.username === 'admin';
    const isAdmin = ['admin', 'super_admin'].includes(role);
    let dojoId = req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null);
    if (!dojoId) dojoId = 3; // Super-Admin ohne Dojo-Kontext → Default (Schreiner)

    // Enterprise-Gate: Admins/Super-Admin immer; Trainer nur wenn Dojo freigeschaltet
    if (!isAdmin && !isSuper) {
      let enabled = false;
      try {
        const [[sub]] = await pool.query(
          'SELECT feature_trainer_app FROM dojo_subscriptions WHERE dojo_id = ?', [dojoId]
        );
        enabled = !!sub && (sub.feature_trainer_app === 1 || sub.feature_trainer_app === true);
      } catch (_) { enabled = false; }
      if (!enabled) {
        return res.status(403).json({ error: 'Die Coach-App ist für dein Dojo nicht freigeschaltet.' });
      }
    }

    const [[d]] = await pool.query('SELECT id, dojoname FROM dojo WHERE id = ?', [dojoId]);
    const [logoRows] = await pool.query(
      "SELECT file_path FROM dojo_logos WHERE dojo_id = ? AND logo_type = 'haupt' LIMIT 1", [dojoId]
    );
    const [themeRows] = await pool.query(
      'SELECT theme_config FROM dojo_theme WHERE dojo_id = ? LIMIT 1', [dojoId]
    );

    const logoPath = logoRows[0]?.file_path;
    const dojo = {
      id: dojoId,
      name: d?.dojoname || 'Dojo',
      logo: logoPath ? `/uploads/logos/${path.basename(logoPath)}` : null,
      primary_color: pickPrimary(themeRows[0]?.theme_config),
    };

    res.json({
      success: true,
      dojo,
      user: { role, vorname: req.user?.vorname || null, nachname: req.user?.nachname || null },
    });
  } catch (e) {
    logger.error('coach/bootstrap Fehler', { error: e.message });
    res.status(500).json({ error: 'Bootstrap fehlgeschlagen.' });
  }
});

// ============================================================================
// VERTRETUNGS-ANFRAGEN — Trainer fragt alle Trainer „kann jemand übernehmen?"
// first-come: wer zuerst „übernimmt" gewinnt. Anfragender + Admin werden informiert.
// ============================================================================
const { notifyTrainersNeueAnfrage, notifyUebernahme } = require('../services/vertretungNotify');

function coachCtx(req) {
  const role = req.user?.role || req.user?.rolle;
  const id = req.user?.id || req.user?.user_id || req.user?.admin_id || null;
  const name = `${req.user?.vorname || ''} ${req.user?.nachname || ''}`.trim() || req.user?.username || 'Trainer';
  let dojoId = req.user?.dojo_id || (req.query.dojo_id ? parseInt(req.query.dojo_id) : null) || 3;
  return { role, id, name, dojoId };
}

// POST /api/coach/vertretung — neue Anfrage anlegen + alle Trainer benachrichtigen
router.post('/vertretung', authenticateToken, async (req, res) => {
  try {
    const ctx = coachCtx(req);
    if (!COACH_ROLES.includes(ctx.role)) return res.status(403).json({ error: 'Kein Coach-Zugang.' });
    if (!ctx.id) return res.status(400).json({ error: 'Trainer nicht erkannt.' });

    const kurs_id  = req.body.kurs_id ? parseInt(req.body.kurs_id) : null;
    const kurs_name = (req.body.kurs_name || '').toString().trim().slice(0, 200) || null;
    const datum    = (req.body.datum || '').toString().trim().slice(0, 10) || null;
    const zeit     = (req.body.zeit || '').toString().trim().slice(0, 60) || null;
    const notiz    = (req.body.notiz || '').toString().trim().slice(0, 1000) || null;

    if (!kurs_name && !datum && !zeit) {
      return res.status(400).json({ error: 'Bitte Stunde wählen oder Datum/Zeit/Kurs angeben.' });
    }

    const [ins] = await pool.query(
      `INSERT INTO vertretungs_anfragen (dojo_id, anfrage_admin_id, anfrage_name, kurs_id, kurs_name, datum, zeit, notiz, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offen')`,
      [ctx.dojoId, ctx.id, ctx.name, kurs_id, kurs_name, datum, zeit, notiz]
    );
    const anfrage = { id: ins.insertId, dojo_id: ctx.dojoId, anfrage_admin_id: ctx.id, anfrage_name: ctx.name, kurs_name, datum, zeit, notiz };

    // Benachrichtigung best-effort (blockiert die Antwort nicht)
    notifyTrainersNeueAnfrage({ dojoId: ctx.dojoId, anfrage })
      .catch(e => logger.warn('vertretung notify Fehler', { error: e.message }));

    res.json({ success: true, id: ins.insertId });
  } catch (e) {
    logger.error('coach/vertretung POST Fehler', { error: e.message });
    res.status(500).json({ error: 'Anfrage konnte nicht angelegt werden.' });
  }
});

// GET /api/coach/vertretung — offene Anfragen des Dojos + eigene (zuletzt)
router.get('/vertretung', authenticateToken, async (req, res) => {
  try {
    const ctx = coachCtx(req);
    if (!COACH_ROLES.includes(ctx.role)) return res.status(403).json({ error: 'Kein Coach-Zugang.' });

    const [rows] = await pool.query(
      `SELECT id, anfrage_admin_id, anfrage_name, kurs_name, datum, zeit, notiz, status,
              uebernommen_admin_id, uebernommen_name, uebernommen_am, created_at
         FROM vertretungs_anfragen
        WHERE dojo_id = ? AND (status = 'offen' OR anfrage_admin_id = ? OR uebernommen_admin_id = ?)
        ORDER BY (status='offen') DESC, created_at DESC
        LIMIT 60`,
      [ctx.dojoId, ctx.id, ctx.id]
    );
    const liste = rows.map(r => ({
      ...r,
      ist_eigene: r.anfrage_admin_id === ctx.id,
      uebernehmbar: r.status === 'offen' && r.anfrage_admin_id !== ctx.id,
    }));
    res.json({ success: true, anfragen: liste });
  } catch (e) {
    logger.error('coach/vertretung GET Fehler', { error: e.message });
    res.status(500).json({ error: 'Anfragen konnten nicht geladen werden.' });
  }
});

// POST /api/coach/vertretung/:id/uebernehmen — first-come zusagen
router.post('/vertretung/:id/uebernehmen', authenticateToken, async (req, res) => {
  try {
    const ctx = coachCtx(req);
    if (!COACH_ROLES.includes(ctx.role)) return res.status(403).json({ error: 'Kein Coach-Zugang.' });
    if (!ctx.id) return res.status(400).json({ error: 'Trainer nicht erkannt.' });
    const id = parseInt(req.params.id);

    const [[anfrage]] = await pool.query(
      'SELECT * FROM vertretungs_anfragen WHERE id = ? AND dojo_id = ?', [id, ctx.dojoId]
    );
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
    if (anfrage.anfrage_admin_id === ctx.id) return res.status(400).json({ error: 'Du kannst deine eigene Anfrage nicht übernehmen.' });

    // Atomar: nur wer zuerst klickt, gewinnt
    const [upd] = await pool.query(
      `UPDATE vertretungs_anfragen
          SET status = 'uebernommen', uebernommen_admin_id = ?, uebernommen_name = ?, uebernommen_am = NOW()
        WHERE id = ? AND dojo_id = ? AND status = 'offen'`,
      [ctx.id, ctx.name, id, ctx.dojoId]
    );
    if (upd.affectedRows === 0) {
      return res.status(409).json({ error: 'Diese Vertretung wurde bereits übernommen oder zurückgezogen.', already_taken: true });
    }

    // Anfragenden + Admins informieren (best-effort)
    let anfrageEmail = null;
    try {
      const [[u]] = await pool.query('SELECT email FROM admin_users WHERE id = ?', [anfrage.anfrage_admin_id]);
      anfrageEmail = u?.email || null;
    } catch (_) {}
    notifyUebernahme({ dojoId: ctx.dojoId, anfrage, uebernehmerName: ctx.name, anfrageEmail })
      .catch(e => logger.warn('vertretung übernahme notify Fehler', { error: e.message }));

    res.json({ success: true });
  } catch (e) {
    logger.error('coach/vertretung uebernehmen Fehler', { error: e.message });
    res.status(500).json({ error: 'Übernahme fehlgeschlagen.' });
  }
});

// POST /api/coach/vertretung/:id/stornieren — eigene offene Anfrage zurückziehen
router.post('/vertretung/:id/stornieren', authenticateToken, async (req, res) => {
  try {
    const ctx = coachCtx(req);
    if (!ctx.id) return res.status(400).json({ error: 'Trainer nicht erkannt.' });
    const id = parseInt(req.params.id);
    const [upd] = await pool.query(
      `UPDATE vertretungs_anfragen SET status = 'storniert'
        WHERE id = ? AND dojo_id = ? AND anfrage_admin_id = ? AND status = 'offen'`,
      [id, ctx.dojoId, ctx.id]
    );
    if (upd.affectedRows === 0) return res.status(409).json({ error: 'Anfrage nicht (mehr) stornierbar.' });
    res.json({ success: true });
  } catch (e) {
    logger.error('coach/vertretung stornieren Fehler', { error: e.message });
    res.status(500).json({ error: 'Stornieren fehlgeschlagen.' });
  }
});

// GET /api/coach/vapid-key — öffentlicher VAPID-Key für Push-Subscription
router.get('/vapid-key', authenticateToken, (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

module.exports = router;
