const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const ALLOWED_FIELDS = [
  'firmenname', 'ansprechpartner', 'rechtsform',
  'email', 'telefon', 'telefon_mobil', 'fax', 'website',
  'strasse', 'hausnummer', 'plz', 'ort', 'land',
  'ust_id', 'eori_nummer', 'handelsreg_nr', 'handelsreg_gericht',
  'zolltarifnummer', 'ursprungsland',
  'incoterms', 'transportweg', 'spediteur', 'zollagent',
  'waehrung', 'zahlungsziel_tage', 'skonto_prozent', 'skonto_tage',
  'mindestbestellwert_cent', 'lieferzeit_tage',
  'bank_name', 'bank_iban', 'bank_bic', 'bank_kontoinhaber',
  'swift_code', 'routing_number', 'account_number',
  'aktiv', 'bemerkungen'
];

function extractFields(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  return data;
}

router.use(authenticateToken);

router.get('/', (req, res) => {
  const dojoId = getSecureDojoId(req);

  const isSuperAdmin = !req.user?.dojo_id && (req.user?.rolle === 'admin' || req.user?.role === 'admin');
  if (!dojoId && !isSuperAdmin) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  // 🔒 Nur Super-Admin darf dojoübergreifend sehen; alle=1 umging bisher die Tenant-Isolation
  const showAll = isSuperAdmin;

  const sql = showAll
    ? 'SELECT *, (SELECT dojoname FROM dojo WHERE id = l.dojo_id) AS dojo_name FROM lieferanten l WHERE aktiv = 1 ORDER BY firmenname ASC'
    : 'SELECT *, (SELECT dojoname FROM dojo WHERE id = l.dojo_id) AS dojo_name FROM lieferanten l WHERE dojo_id = ? AND aktiv = 1 ORDER BY firmenname ASC';
  const params = showAll ? [] : [dojoId];

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
    res.json({ success: true, data: results });
  });
});

router.get('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'SELECT * FROM lieferanten WHERE lieferant_id = ? AND dojo_id = ?',
    [req.params.id, dojoId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (!results.length) return res.status(404).json({ success: false, message: 'Lieferant nicht gefunden' });
      res.json({ success: true, data: results[0] });
    }
  );
});

router.post('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const { firmenname } = req.body;
  if (!firmenname || !firmenname.trim()) {
    return res.status(400).json({ success: false, message: 'Firmenname ist erforderlich' });
  }

  const fields = extractFields(req.body);
  const insertData = { dojo_id: dojoId, ...fields };

  db.query(
    'INSERT INTO lieferanten SET ?',
    [insertData],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      res.status(201).json({ success: true, data: { lieferant_id: result.insertId, ...insertData } });
    }
  );
});

router.put('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'SELECT lieferant_id FROM lieferanten WHERE lieferant_id = ? AND dojo_id = ?',
    [req.params.id, dojoId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (!results.length) return res.status(404).json({ success: false, message: 'Lieferant nicht gefunden' });

      const fields = extractFields(req.body);
      if (!Object.keys(fields).length) {
        return res.status(400).json({ success: false, message: 'Keine Felder zum Aktualisieren' });
      }

      db.query(
        'UPDATE lieferanten SET ? WHERE lieferant_id = ? AND dojo_id = ?',
        [fields, req.params.id, dojoId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
          res.json({ success: true });
        }
      );
    }
  );
});

router.delete('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'SELECT lieferant_id FROM lieferanten WHERE lieferant_id = ? AND dojo_id = ?',
    [req.params.id, dojoId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (!results.length) return res.status(404).json({ success: false, message: 'Lieferant nicht gefunden' });

      db.query(
        'UPDATE lieferanten SET aktiv = 0 WHERE lieferant_id = ? AND dojo_id = ?',
        [req.params.id, dojoId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
          res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;
