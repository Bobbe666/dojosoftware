const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const ALLOWED_FIELDS = [
  'name', 'typ', 'lieferant_id', 'modell', 'modell_name',
  'artikel_nr_vorl', 'farbe', 'wkf', 'stickerei_pos',
  'stickerei_text', 'stickerei_farben', 'stickerei_datei', 'bemerkungen'
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

// GET / — alle aktiven Vorlagen inkl. Lieferantenname + Anzahl verknüpfter Artikel
router.get('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const sql = `
    SELECT bv.*,
           l.firmenname AS lieferant_name,
           COUNT(a.artikel_id) AS artikel_count
    FROM bestellvorlagen bv
    LEFT JOIN lieferanten l ON bv.lieferant_id = l.lieferant_id
    LEFT JOIN artikel a ON a.vorlage_id = bv.vorlage_id AND a.dojo_id = ?
    WHERE bv.dojo_id = ? AND bv.aktiv = 1
    GROUP BY bv.vorlage_id
    ORDER BY bv.name ASC
  `;

  db.query(sql, [dojoId, dojoId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });
    res.json({ success: true, data: results });
  });
});

// GET /:id — eine Vorlage + zugeordnete artikel_ids
router.get('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  db.query(
    'SELECT bv.*, l.firmenname AS lieferant_name FROM bestellvorlagen bv LEFT JOIN lieferanten l ON bv.lieferant_id = l.lieferant_id WHERE bv.vorlage_id = ? AND bv.dojo_id = ?',
    [req.params.id, dojoId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
      if (!results.length) return res.status(404).json({ success: false, message: 'Vorlage nicht gefunden' });

      const vorlage = results[0];

      db.query(
        'SELECT artikel_id FROM artikel WHERE vorlage_id = ? AND dojo_id = ?',
        [req.params.id, dojoId],
        (err2, artikelRows) => {
          if (err2) return res.status(500).json({ success: false, message: 'Datenbankfehler' });
          vorlage.artikel_ids = artikelRows.map(r => r.artikel_id);
          res.json({ success: true, data: vorlage });
        }
      );
    }
  );
});

// POST / — neue Vorlage anlegen
router.post('/', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const fields = extractFields(req.body);
  if (!fields.name || !fields.name.trim()) {
    return res.status(400).json({ success: false, message: 'Name ist Pflichtfeld' });
  }

  // stickerei_pos als JSON serialisieren wenn Array
  if (Array.isArray(fields.stickerei_pos)) {
    fields.stickerei_pos = JSON.stringify(fields.stickerei_pos);
  }

  const data = { ...fields, dojo_id: dojoId };
  const cols = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const vals = Object.values(data);

  db.query(
    `INSERT INTO bestellvorlagen (${cols}) VALUES (${placeholders})`,
    vals,
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });

      const newId = result.insertId;
      const artikelIds = req.body.artikel_ids;

      if (artikelIds && artikelIds.length > 0) {
        db.query(
          'UPDATE artikel SET vorlage_id = ? WHERE artikel_id IN (?) AND dojo_id = ?',
          [newId, artikelIds, dojoId],
          (err2) => {
            if (err2) return res.status(500).json({ success: false, message: 'Fehler beim Zuordnen der Artikel' });
            res.json({ success: true, vorlage_id: newId });
          }
        );
      } else {
        res.json({ success: true, vorlage_id: newId });
      }
    }
  );
});

// PUT /:id — Vorlage aktualisieren (inkl. Artikel-Zuordnung)
router.put('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const vorId = req.params.id;
  const fields = extractFields(req.body);

  if (!fields.name || !fields.name.trim()) {
    return res.status(400).json({ success: false, message: 'Name ist Pflichtfeld' });
  }

  // stickerei_pos als JSON serialisieren wenn Array
  if (Array.isArray(fields.stickerei_pos)) {
    fields.stickerei_pos = JSON.stringify(fields.stickerei_pos);
  }

  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), vorId, dojoId];

  db.query(
    `UPDATE bestellvorlagen SET ${setClauses} WHERE vorlage_id = ? AND dojo_id = ?`,
    vals,
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler', error: err.message });

      // Artikel-Zuordnung zurücksetzen
      db.query(
        'UPDATE artikel SET vorlage_id = NULL WHERE vorlage_id = ? AND dojo_id = ?',
        [vorId, dojoId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Fehler beim Zurücksetzen der Artikel' });

          const artikelIds = req.body.artikel_ids;
          if (artikelIds && artikelIds.length > 0) {
            db.query(
              'UPDATE artikel SET vorlage_id = ? WHERE artikel_id IN (?) AND dojo_id = ?',
              [vorId, artikelIds, dojoId],
              (err3) => {
                if (err3) return res.status(500).json({ success: false, message: 'Fehler beim Zuordnen der Artikel' });
                res.json({ success: true });
              }
            );
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  );
});

// DELETE /:id — soft-delete + vorlage_id bei Artikeln auf NULL setzen
router.delete('/:id', (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ success: false, message: 'Dojo-ID fehlt' });

  const vorId = req.params.id;

  db.query(
    'UPDATE bestellvorlagen SET aktiv = 0 WHERE vorlage_id = ? AND dojo_id = ?',
    [vorId, dojoId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Datenbankfehler' });

      db.query(
        'UPDATE artikel SET vorlage_id = NULL WHERE vorlage_id = ? AND dojo_id = ?',
        [vorId, dojoId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Fehler beim Zurücksetzen der Artikel' });
          res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;
