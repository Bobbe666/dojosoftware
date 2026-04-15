// =====================================================================================
// RATENPLAN ROUTES — Ratenzahlung für Mitglieder mit Nachzahlungen
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../../db');
const pool = db.promise();
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const logger = require('../../utils/logger');

// ─── GET /ratenplan/:mitglied_id — Aktiven Plan laden ────────────────────────

router.get('/ratenplan/:mitglied_id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const mitglied_id = parseInt(req.params.mitglied_id);

    // Tenant-Check: Mitglied gehört zum Dojo?
    if (dojoId) {
      const [[m]] = await pool.query(
        `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
        [mitglied_id, dojoId]
      );
      if (!m) return res.status(403).json({ success: false, message: 'Kein Zugriff' });
    }

    const [[plan]] = await pool.query(
      `SELECT * FROM mitglied_ratenplan WHERE mitglied_id = ? AND aktiv = 1 ORDER BY erstellt_am DESC LIMIT 1`,
      [mitglied_id]
    );

    // Summe offener Rechnungen für dieses Mitglied
    const [[offene]] = await pool.query(
      `SELECT COALESCE(SUM(betrag), 0) AS summe
       FROM rechnungen
       WHERE mitglied_id = ? AND status IN ('offen', 'ueberfaellig', 'teilweise_bezahlt')`,
      [mitglied_id]
    );

    res.json({
      success: true,
      plan: plan || null,
      offener_betrag: parseFloat(offene.summe)
    });
  } catch (err) {
    logger.error('Ratenplan laden Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// ─── POST /ratenplan — Plan erstellen ────────────────────────────────────────

router.post('/ratenplan', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

    const { mitglied_id, ausstehender_betrag, modell, monatlicher_aufschlag, notizen } = req.body;

    if (!mitglied_id || !ausstehender_betrag || !modell || !monatlicher_aufschlag) {
      return res.status(400).json({ success: false, message: 'Pflichtfelder fehlen' });
    }

    // Tenant-Check
    const [[m]] = await pool.query(
      `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
      [mitglied_id, dojoId]
    );
    if (!m) return res.status(403).json({ success: false, message: 'Kein Zugriff' });

    // Evtl. bestehende aktive Pläne deaktivieren
    await pool.query(
      `UPDATE mitglied_ratenplan SET aktiv = 0 WHERE mitglied_id = ? AND aktiv = 1`,
      [mitglied_id]
    );

    const [result] = await pool.query(
      `INSERT INTO mitglied_ratenplan
         (mitglied_id, dojo_id, ausstehender_betrag, modell, monatlicher_aufschlag, notizen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mitglied_id, dojoId, ausstehender_betrag, modell, monatlicher_aufschlag, notizen || null]
    );

    logger.info('Ratenplan erstellt', { mitglied_id, modell, aufschlag: monatlicher_aufschlag });
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    logger.error('Ratenplan erstellen Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
  }
});

// ─── PUT /ratenplan/:id — Plan aktualisieren (Betrag, Notizen, deaktivieren) ─

router.put('/ratenplan/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

    const plan_id = parseInt(req.params.id);
    const { aktiv, monatlicher_aufschlag, notizen, bereits_abgezahlt } = req.body;

    // Tenant-Check über JOIN
    const [[plan]] = await pool.query(
      `SELECT r.id FROM mitglied_ratenplan r
       JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.id = ? AND m.dojo_id = ?`,
      [plan_id, dojoId]
    );
    if (!plan) return res.status(403).json({ success: false, message: 'Kein Zugriff' });

    const updates = [];
    const values = [];
    if (aktiv !== undefined)               { updates.push('aktiv = ?');               values.push(aktiv ? 1 : 0); }
    if (monatlicher_aufschlag !== undefined){ updates.push('monatlicher_aufschlag = ?'); values.push(monatlicher_aufschlag); }
    if (notizen !== undefined)             { updates.push('notizen = ?');             values.push(notizen); }
    if (bereits_abgezahlt !== undefined)   { updates.push('bereits_abgezahlt = ?');   values.push(bereits_abgezahlt); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(plan_id);
    await pool.query(`UPDATE mitglied_ratenplan SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true });
  } catch (err) {
    logger.error('Ratenplan update Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren' });
  }
});

// ─── DELETE /ratenplan/:id — Plan löschen ────────────────────────────────────

router.delete('/ratenplan/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

    const plan_id = parseInt(req.params.id);

    const [[plan]] = await pool.query(
      `SELECT r.id FROM mitglied_ratenplan r
       JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
       WHERE r.id = ? AND m.dojo_id = ?`,
      [plan_id, dojoId]
    );
    if (!plan) return res.status(403).json({ success: false, message: 'Kein Zugriff' });

    await pool.query(`DELETE FROM mitglied_ratenplan WHERE id = ?`, [plan_id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ratenplan löschen Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

module.exports = router;
