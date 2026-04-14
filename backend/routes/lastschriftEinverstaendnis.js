/**
 * lastschriftEinverstaendnis.js
 * Verwaltung der Lastschrift-Einverständniserklärungen für Einkäufe.
 *
 * Endpunkte:
 *   GET    /                       — Admin: alle Mitglieder mit Status (auth)
 *   GET    /stats                  — Admin: Kennzahlen (auth)
 *   POST   /senden                 — Admin: E-Mail-Anfrage senden (auth)
 *   POST   /erinnerung             — Admin: Erinnerung an Ausstehende (auth)
 *   PUT    /:id/status             — Admin: Status manuell setzen (auth)
 *   GET    /formular/:token        — Public: Formular abrufen (kein Login)
 *   POST   /formular/:token        — Public: Antwort eintragen (kein Login)
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const db       = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { sendEmailForDojo } = require('../services/emailService');
const logger   = require('../utils/logger');

const pool = db.promise();

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tokenAblauf() {
  const d = new Date();
  d.setDate(d.getDate() + 30); // 30 Tage gültig
  return d;
}

function getFrontendBase(req) {
  // Prodcution: https://dojo.tda-intl.org  bzw. Subdomain
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host  = req.headers['x-forwarded-host'] || req.get('host') || 'dojo.tda-intl.org';
  return `${proto}://${host}`;
}

// ── Hilfsfunktion: dojoId aus Query ODER Body ODER JWT ───────────────────────
function resolveDojoId(req) {
  return getSecureDojoId(req)
    || (req.body?.dojo_id ? parseInt(req.body.dojo_id, 10) : null)
    || req.user?.dojo_id
    || null;
}

// ── Admin-Endpunkte (auth middleware sitzt in server.js beim Mounten) ────────

// GET / — alle Mitglieder mit Einverständnis-Status
router.get('/', async (req, res) => {
  const dojoId = resolveDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });

  const { status, search } = req.query;
  try {
    let conds = ['m.dojo_id = ?', 'm.aktiv = 1'];
    let params = [dojoId];

    const [rows] = await pool.query(
      `SELECT
         m.mitglied_id,
         m.vorname,
         m.nachname,
         m.email,
         le.id           AS einverstaendnis_id,
         le.status       AS einverstaendnis_status,
         le.angefragt_am,
         le.erinnerung_am,
         le.beantwortet_am,
         le.kanal,
         le.notiz,
         le.email_versendet
       FROM mitglieder m
       LEFT JOIN lastschrift_einverstaendnis le
              ON le.mitglied_id = m.mitglied_id AND le.dojo_id = ?
       WHERE m.dojo_id = ? AND m.aktiv = 1
       ORDER BY m.nachname, m.vorname`,
      [dojoId, dojoId]
    );

    // Filter nach Status
    let filtered = rows;
    if (status === 'ohne')          filtered = rows.filter(r => !r.einverstaendnis_id);
    else if (status === 'ausstehend') filtered = rows.filter(r => r.einverstaendnis_status === 'ausstehend');
    else if (status === 'zugestimmt') filtered = rows.filter(r => r.einverstaendnis_status === 'zugestimmt');
    else if (status === 'abgelehnt')  filtered = rows.filter(r => r.einverstaendnis_status === 'abgelehnt');

    // Suchfilter
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        `${r.vorname} ${r.nachname}`.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, data: filtered, total: filtered.length });
  } catch (err) {
    logger.error('Lastschrift-Einverständnis GET /:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /stats
router.get('/stats', async (req, res) => {
  const dojoId = resolveDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  try {
    const [[{ total }]]       = await pool.query('SELECT COUNT(*) AS total FROM mitglieder WHERE dojo_id = ? AND aktiv = 1', [dojoId]);
    const [[{ zugestimmt }]]  = await pool.query("SELECT COUNT(*) AS zugestimmt FROM lastschrift_einverstaendnis WHERE dojo_id = ? AND status = 'zugestimmt'", [dojoId]);
    const [[{ abgelehnt }]]   = await pool.query("SELECT COUNT(*) AS abgelehnt FROM lastschrift_einverstaendnis WHERE dojo_id = ? AND status = 'abgelehnt'", [dojoId]);
    const [[{ ausstehend }]]  = await pool.query("SELECT COUNT(*) AS ausstehend FROM lastschrift_einverstaendnis WHERE dojo_id = ? AND status = 'ausstehend'", [dojoId]);
    const beantwortet         = zugestimmt + abgelehnt;
    const ohne                = total - zugestimmt - abgelehnt - ausstehend;

    res.json({ success: true, stats: { total, zugestimmt, abgelehnt, ausstehend, beantwortet, ohne } });
  } catch (err) {
    logger.error('Lastschrift stats:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /senden — E-Mail-Anfrage an ausgewählte Mitglieder (oder alle ohne Anfrage)
router.post('/senden', async (req, res) => {
  const dojoId = resolveDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });

  const { mitglied_ids, nur_ohne_anfrage = true } = req.body;
  const base = getFrontendBase(req);

  try {
    // Dojo-Name laden
    const [[dojo]] = await pool.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Ihr Dojo';

    // Welche Mitglieder?
    let members;
    if (Array.isArray(mitglied_ids) && mitglied_ids.length > 0) {
      const [rows] = await pool.query(
        'SELECT mitglied_id, vorname, nachname, email FROM mitglieder WHERE mitglied_id IN (?) AND dojo_id = ? AND aktiv = 1',
        [mitglied_ids, dojoId]
      );
      members = rows;
    } else {
      // Alle aktiven Mitglieder ohne bestehende Anfrage (oder alle wenn nur_ohne_anfrage=false)
      const excludeSql = nur_ohne_anfrage
        ? 'AND m.mitglied_id NOT IN (SELECT mitglied_id FROM lastschrift_einverstaendnis WHERE dojo_id = ?)'
        : '';
      const queryParams = nur_ohne_anfrage ? [dojoId, dojoId] : [dojoId];
      const [rows] = await pool.query(
        `SELECT m.mitglied_id, m.vorname, m.nachname, m.email
         FROM mitglieder m
         WHERE m.dojo_id = ? AND m.aktiv = 1 AND m.email IS NOT NULL AND m.email != '' ${excludeSql}`,
        queryParams
      );
      members = rows;
    }

    if (members.length === 0) {
      return res.json({ success: true, gesendet: 0, message: 'Keine Empfänger gefunden.' });
    }

    let gesendet = 0;
    let fehler   = 0;

    for (const m of members) {
      if (!m.email) continue;
      try {
        // Token erstellen / aktualisieren
        const token  = genToken();
        const ablauf = tokenAblauf();

        await pool.query(
          `INSERT INTO lastschrift_einverstaendnis
             (mitglied_id, dojo_id, status, token, token_ablauf, angefragt_am, email_versendet)
           VALUES (?, ?, 'ausstehend', ?, ?, NOW(), 1)
           ON DUPLICATE KEY UPDATE
             token = VALUES(token),
             token_ablauf = VALUES(token_ablauf),
             angefragt_am = NOW(),
             email_versendet = 1,
             status = IF(status = 'ausstehend', 'ausstehend', status)`,
          [m.mitglied_id, dojoId, token, ablauf]
        );

        // E-Mail senden
        const linkJa    = `${base}/lastschrift-zustimmung/${token}?antwort=ja`;
        const linkNein  = `${base}/lastschrift-zustimmung/${token}?antwort=nein`;
        const linkForm  = `${base}/lastschrift-zustimmung/${token}`;

        const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f8f8; padding: 20px; border-radius: 10px;">
  <div style="background: #1a1a2e; color: #e0e0e0; padding: 20px 25px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="margin: 0; font-size: 1.2rem;">${dojoName}</h2>
    <p style="margin: 5px 0 0; color: #aaa; font-size: 0.9rem;">Einverständniserklärung Lastschrifteinzug</p>
  </div>

  <div style="background: #fff; padding: 25px; border-radius: 0 0 8px 8px;">
    <p>Hallo ${m.vorname} ${m.nachname},</p>

    <p>um Ihnen den Einkauf in unserem Shop so komfortabel wie möglich zu gestalten,
    möchten wir Sie fragen, ob Sie damit einverstanden sind, dass zukünftige Einkäufe
    automatisch per <strong>SEPA-Lastschrift</strong> von Ihrem hinterlegten Konto eingezogen werden.</p>

    <div style="background: #f0f4ff; border-left: 4px solid #6c63ff; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <strong>Was bedeutet das konkret?</strong><br>
      Bei jedem Kauf im Dojo-Shop wird der Betrag automatisch von Ihrem Bankkonto
      abgebucht — bequem ohne weiteren Zahlungsschritt. Sie haben gemäß SEPA-Regelwerk
      ein Widerrufsrecht von 8 Wochen.
    </div>

    <p>Bitte teilen Sie uns Ihre Entscheidung mit:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${linkJa}" style="display: inline-block; background: #2ea043; color: #fff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem; margin: 0 8px;">
        ✓ Ja, ich stimme zu
      </a>
      <a href="${linkNein}" style="display: inline-block; background: #d73a49; color: #fff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.1rem; margin: 0 8px;">
        ✗ Nein, ich lehne ab
      </a>
    </div>

    <p style="color: #888; font-size: 0.85rem; text-align: center;">
      Oder öffnen Sie das Formular im Browser:
      <a href="${linkForm}" style="color: #6c63ff;">${linkForm}</a>
    </p>

    <p style="color: #888; font-size: 0.82rem;">
      Dieser Link ist 30 Tage gültig. Sie können Ihre Entscheidung jederzeit über uns widerrufen.
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #aaa; font-size: 0.8rem; text-align: center;">
      ${dojoName} · Diese E-Mail wurde automatisch erstellt.
    </p>
  </div>
</div>`;

        await sendEmailForDojo(dojoId, {
          to:      m.email,
          subject: `Einverständnis Lastschrifteinzug — ${dojoName}`,
          html,
          text: `Hallo ${m.vorname} ${m.nachname},\n\nBitte stimmen Sie dem Lastschrifteinzug zu oder lehnen Sie ab:\n\nJa: ${linkJa}\nNein: ${linkNein}\n\nDieser Link ist 30 Tage gültig.`
        });

        gesendet++;
      } catch (mailErr) {
        logger.error('Lastschrift E-Mail fehlgeschlagen:', { mitglied_id: m.mitglied_id, error: mailErr.message });
        fehler++;
      }
    }

    res.json({ success: true, gesendet, fehler, message: `${gesendet} E-Mails versendet${fehler > 0 ? `, ${fehler} fehlgeschlagen` : ''}.` });
  } catch (err) {
    logger.error('Lastschrift /senden:', { error: err });
    res.status(500).json({ error: 'Fehler beim Versenden' });
  }
});

// POST /erinnerung — Erinnerung an Mitglieder mit status=ausstehend
router.post('/erinnerung', async (req, res) => {
  const dojoId = resolveDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  const base = getFrontendBase(req);

  try {
    const [[dojo]] = await pool.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Ihr Dojo';

    const [ausstehende] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.email, le.token
       FROM lastschrift_einverstaendnis le
       JOIN mitglieder m ON m.mitglied_id = le.mitglied_id
       WHERE le.dojo_id = ? AND le.status = 'ausstehend' AND m.email IS NOT NULL AND m.email != ''`,
      [dojoId]
    );

    if (ausstehende.length === 0) {
      return res.json({ success: true, gesendet: 0, message: 'Keine ausstehenden Anfragen.' });
    }

    let gesendet = 0;
    for (const m of ausstehende) {
      try {
        // Token erneuern
        const token  = genToken();
        const ablauf = tokenAblauf();
        await pool.query(
          'UPDATE lastschrift_einverstaendnis SET token = ?, token_ablauf = ?, erinnerung_am = NOW() WHERE mitglied_id = ? AND dojo_id = ?',
          [token, ablauf, m.mitglied_id, dojoId]
        );

        const linkJa   = `${base}/lastschrift-zustimmung/${token}?antwort=ja`;
        const linkNein = `${base}/lastschrift-zustimmung/${token}?antwort=nein`;
        const linkForm = `${base}/lastschrift-zustimmung/${token}`;

        const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f8f8; padding: 20px; border-radius: 10px;">
  <div style="background: #1a1a2e; color: #e0e0e0; padding: 20px 25px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="margin: 0; font-size: 1.2rem;">${dojoName}</h2>
    <p style="margin: 5px 0 0; color: #aaa; font-size: 0.9rem;">Erinnerung: Einverständnis Lastschrifteinzug</p>
  </div>
  <div style="background: #fff; padding: 25px; border-radius: 0 0 8px 8px;">
    <p>Hallo ${m.vorname} ${m.nachname},</p>
    <p>wir haben Sie bereits um Ihr Einverständnis zum automatischen Lastschrifteinzug bei Einkäufen gebeten. Bitte teilen Sie uns noch Ihre Entscheidung mit:</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${linkJa}" style="display: inline-block; background: #2ea043; color: #fff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 0 8px;">✓ Ja, ich stimme zu</a>
      <a href="${linkNein}" style="display: inline-block; background: #d73a49; color: #fff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 0 8px;">✗ Nein, ich lehne ab</a>
    </div>
    <p style="color: #888; font-size: 0.82rem;">Link: <a href="${linkForm}" style="color: #6c63ff;">${linkForm}</a> · Gültig 30 Tage</p>
  </div>
</div>`;

        await sendEmailForDojo(dojoId, {
          to:      m.email,
          subject: `Erinnerung: Einverständnis Lastschrifteinzug — ${dojoName}`,
          html,
          text: `Erinnerung: Bitte antworten Sie noch auf unsere Anfrage.\nJa: ${linkJa}\nNein: ${linkNein}`
        });
        gesendet++;
      } catch { /* einzelne Fehler überspringen */ }
    }

    res.json({ success: true, gesendet, message: `${gesendet} Erinnerungen versendet.` });
  } catch (err) {
    logger.error('Lastschrift /erinnerung:', { error: err });
    res.status(500).json({ error: 'Fehler beim Versenden' });
  }
});

// PUT /:id/status — Admin: Status manuell setzen
router.put('/:id/status', async (req, res) => {
  const dojoId = resolveDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });

  const { status, notiz } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!['zugestimmt', 'abgelehnt', 'ausstehend'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  try {
    const [r] = await pool.query(
      `UPDATE lastschrift_einverstaendnis
       SET status = ?, beantwortet_am = NOW(), kanal = 'admin', notiz = COALESCE(?, notiz)
       WHERE id = ? AND dojo_id = ?`,
      [status, notiz || null, id, dojoId]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Lastschrift PUT /:id/status:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ── Öffentliche Endpunkte (kein Login) ───────────────────────────────────────

// GET /formular/:token — Mitgliedsdaten für das Formular laden
router.get('/formular/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT le.id, le.status, le.token_ablauf, le.beantwortet_am,
              m.vorname, m.nachname,
              d.dojoname
       FROM lastschrift_einverstaendnis le
       JOIN mitglieder m ON m.mitglied_id = le.mitglied_id
       JOIN dojo d ON d.id = le.dojo_id
       WHERE le.token = ? LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link ungültig oder abgelaufen.' });
    }

    const row = rows[0];

    if (row.token_ablauf && new Date(row.token_ablauf) < new Date()) {
      return res.status(410).json({ error: 'Dieser Link ist abgelaufen. Bitte kontaktieren Sie Ihr Dojo.' });
    }

    res.json({
      success: true,
      vorname:        row.vorname,
      nachname:       row.nachname,
      dojoname:       row.dojoname,
      status:         row.status,
      beantwortet_am: row.beantwortet_am,
    });
  } catch (err) {
    logger.error('Lastschrift GET /formular/:token:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /formular/:token — Antwort des Mitglieds speichern
router.post('/formular/:token', async (req, res) => {
  const { token } = req.params;
  const { antwort } = req.body; // 'ja' | 'nein'

  if (!['ja', 'nein'].includes(antwort)) {
    return res.status(400).json({ error: 'Ungültige Antwort. Erlaubt: ja | nein' });
  }

  const status = antwort === 'ja' ? 'zugestimmt' : 'abgelehnt';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null;

  try {
    const [rows] = await pool.query(
      'SELECT id, status, token_ablauf FROM lastschrift_einverstaendnis WHERE token = ? LIMIT 1',
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link ungültig.' });
    }

    const row = rows[0];
    if (row.token_ablauf && new Date(row.token_ablauf) < new Date()) {
      return res.status(410).json({ error: 'Dieser Link ist abgelaufen.' });
    }

    await pool.query(
      `UPDATE lastschrift_einverstaendnis
       SET status = ?, beantwortet_am = NOW(), kanal = 'email', ip_adresse = ?
       WHERE id = ?`,
      [status, ip, row.id]
    );

    res.json({
      success: true,
      status,
      message: status === 'zugestimmt'
        ? 'Vielen Dank! Ihre Zustimmung wurde gespeichert.'
        : 'Ihre Ablehnung wurde gespeichert. Zukünftige Einkäufe müssen manuell bezahlt werden.'
    });
  } catch (err) {
    logger.error('Lastschrift POST /formular/:token:', { error: err });
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

module.exports = router;
