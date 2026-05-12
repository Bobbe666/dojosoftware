const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

// GET / — alle Bestellungen (optional ?vorlage_id=X)
router.get('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const vorId = req.query.vorlage_id;
  const params = vorId ? [dojoId, vorId] : [dojoId];
  const sql = `
    SELECT b.*, l.firmenname AS lieferant_firmenname
    FROM gi_bestellungen b
    LEFT JOIN lieferanten l ON b.lieferant_id = l.lieferant_id
    WHERE b.dojo_id = ?
    ${vorId ? 'AND b.vorlage_id = ?' : ''}
    ORDER BY b.erstellt_am DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
    res.json({ success: true, data: rows });
  });
});

// POST / — neue Bestellung speichern
router.post('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const { vorlage_id, lieferant_id, lieferant_name, bestelldatum, lieferdatum, formdata } = req.body;

  db.query(
    `INSERT INTO gi_bestellungen (dojo_id, vorlage_id, lieferant_id, lieferant_name, bestelldatum, lieferdatum, formdata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dojoId, vorlage_id || null, lieferant_id || null, lieferant_name || null, bestelldatum || null, lieferdatum || null,
     formdata ? JSON.stringify(formdata) : null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
      res.json({ success: true, bestellung_id: result.insertId });
    }
  );
});

// PUT /:id — Bestellung überschreiben (gleiche ID, neues formdata)
router.put('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const { lieferant_id, lieferant_name, bestelldatum, lieferdatum, status, formdata } = req.body;

  db.query(
    `UPDATE gi_bestellungen
     SET lieferant_id=?, lieferant_name=?, bestelldatum=?, lieferdatum=?,
         ${status ? 'status=?,' : ''} formdata=?
     WHERE bestellung_id=? AND dojo_id=?`,
    [
      lieferant_id || null, lieferant_name || null,
      bestelldatum || null, lieferdatum || null,
      ...(status ? [status] : []),
      formdata ? JSON.stringify(formdata) : null,
      req.params.id, dojoId,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// PATCH /:id/status — Status aktualisieren
router.patch('/:id/status', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const STATI = ['bestellt', 'bestaetigt', 'geliefert', 'storniert'];
  const { status } = req.body;
  if (!STATI.includes(status)) return res.status(400).json({ success: false, message: 'Ungültiger Status' });

  db.query(
    'UPDATE gi_bestellungen SET status = ? WHERE bestellung_id = ? AND dojo_id = ?',
    [status, req.params.id, dojoId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'DELETE FROM gi_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
    [req.params.id, dojoId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Bestellung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

module.exports = router;
