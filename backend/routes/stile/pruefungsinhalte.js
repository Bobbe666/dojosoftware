/**
 * Prüfungsinhalte Routes
 * Verwaltung von Prüfungsinhalten und Kategorien für Graduierungen
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

const DEFAULT_KATEGORIEN = [
  { key: 'kondition',      label: 'Kondition / Warm Up',  icon: '💪', reihenfolge: 1 },
  { key: 'grundtechniken', label: 'Grundtechniken',        icon: '🥋', reihenfolge: 2 },
  { key: 'kata',           label: 'Kata / Kombinationen',  icon: '🎭', reihenfolge: 3 },
  { key: 'kumite',         label: 'Kumite / Sparring',     icon: '⚔️', reihenfolge: 4 },
  { key: 'theorie',        label: 'Theorie',               icon: '📚', reihenfolge: 5 }
];

// ============================================================================
// KATEGORIEN CRUD
// ============================================================================

// GET /:stilId/kategorien - Kategorien für einen Stil abrufen
router.get('/:stilId/kategorien', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  db.query(
    'SELECT * FROM pruefungsinhalte_kategorien WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge',
    [stilId],
    (err, rows) => {
      if (err) {
        // Tabelle existiert noch nicht (Migration noch nicht ausgeführt) → Defaults zurückgeben
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res.json({ kategorien: DEFAULT_KATEGORIEN.map((k, i) => ({
            kategorie_id: i + 1, stil_id: stilId,
            kategorie_key: k.key, label: k.label, icon: k.icon, reihenfolge: k.reihenfolge
          }))});
        }
        logger.error('Fehler beim Abrufen der Kategorien:', err);
        return res.status(500).json({ error: 'Fehler beim Abrufen der Kategorien' });
      }

      // Parse JSON-Spalte aktive_graduierung_ids
      rows.forEach(r => {
        if (r.aktive_graduierung_ids && typeof r.aktive_graduierung_ids === 'string') {
          try { r.aktive_graduierung_ids = JSON.parse(r.aktive_graduierung_ids); } catch { r.aktive_graduierung_ids = null; }
        }
      });

      if (rows.length === 0) {
        // Noch keine Kategorien → Standard-Kategorien anlegen
        const insertValues = DEFAULT_KATEGORIEN.map(k => [stilId, k.key, k.label, k.icon, k.reihenfolge]);
        db.query(
          'INSERT INTO pruefungsinhalte_kategorien (stil_id, kategorie_key, label, icon, reihenfolge) VALUES ?',
          [insertValues],
          (insertErr) => {
            if (insertErr) {
              logger.error('Fehler beim Anlegen der Standard-Kategorien:', insertErr);
              return res.status(500).json({ error: 'Fehler beim Anlegen der Standard-Kategorien' });
            }
            db.query(
              'SELECT * FROM pruefungsinhalte_kategorien WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge',
              [stilId],
              (err2, rows2) => {
                if (err2) return res.status(500).json({ error: 'DB-Fehler' });
                rows2.forEach(r => {
                  if (r.aktive_graduierung_ids && typeof r.aktive_graduierung_ids === 'string') {
                    try { r.aktive_graduierung_ids = JSON.parse(r.aktive_graduierung_ids); } catch { r.aktive_graduierung_ids = null; }
                  }
                });
                res.json({ kategorien: rows2 });
              }
            );
          }
        );
      } else {
        res.json({ kategorien: rows });
      }
    }
  );
});

// POST /:stilId/kategorien - Neue Kategorie anlegen
router.post('/:stilId/kategorien', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const { label, icon = '📋' } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Bezeichnung ist erforderlich' });
  if (label.trim().length > 100) return res.status(400).json({ error: 'Bezeichnung zu lang (max. 100 Zeichen)' });

  // Einzigartigen Key generieren
  const baseKey = label.trim().toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 40) || 'kategorie';

  const iconVal = (icon || '📋').substring(0, 4);

  db.query(
    'SELECT COALESCE(MAX(reihenfolge), 0) + 1 AS next_reihenfolge FROM pruefungsinhalte_kategorien WHERE stil_id = ? AND aktiv = 1',
    [stilId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB-Fehler' });
      const nextReihenfolge = rows[0].next_reihenfolge;

      // Sicherstellen dass der Key eindeutig ist
      const uniqueKey = `${baseKey}_${Date.now()}`.substring(0, 50);

      db.query(
        'INSERT INTO pruefungsinhalte_kategorien (stil_id, kategorie_key, label, icon, reihenfolge) VALUES (?, ?, ?, ?, ?)',
        [stilId, uniqueKey, label.trim(), iconVal, nextReihenfolge],
        (insertErr, result) => {
          if (insertErr) {
            logger.error('Fehler beim Anlegen der Kategorie:', insertErr);
            return res.status(500).json({ error: 'Fehler beim Anlegen der Kategorie' });
          }
          res.json({ success: true, kategorie_id: result.insertId, kategorie_key: uniqueKey });
        }
      );
    }
  );
});

// PUT /:stilId/kategorien/:katId/graduierungen - Aktive Graduierungen für eine Kategorie setzen
router.put('/:stilId/kategorien/:katId/graduierungen', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  const katId = parseInt(req.params.katId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });
  if (!katId || isNaN(katId)) return res.status(400).json({ error: 'Ungültige Kategorie-ID' });

  // null = gilt für alle; Array von graduierung_ids = nur für diese
  const { aktive_graduierung_ids } = req.body;
  const value = (aktive_graduierung_ids === null || aktive_graduierung_ids === undefined)
    ? null
    : JSON.stringify(aktive_graduierung_ids);

  db.query(
    'UPDATE pruefungsinhalte_kategorien SET aktive_graduierung_ids = ? WHERE kategorie_id = ? AND stil_id = ?',
    [value, katId, stilId],
    (err, result) => {
      if (err) {
        logger.error('Fehler beim Setzen der aktiven Graduierungen:', err);
        return res.status(500).json({ error: 'Fehler beim Speichern' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// PUT /:stilId/kategorien/reorder - Reihenfolge aktualisieren (muss VOR /:katId stehen!)
router.put('/:stilId/kategorien/reorder', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const { kategorien } = req.body;
  if (!Array.isArray(kategorien) || kategorien.length === 0) {
    return res.status(400).json({ error: 'Kategorien-Array erforderlich' });
  }

  const updates = kategorien.map(k =>
    new Promise((resolve, reject) => {
      db.query(
        'UPDATE pruefungsinhalte_kategorien SET reihenfolge = ? WHERE kategorie_id = ? AND stil_id = ?',
        [k.reihenfolge, k.kategorie_id, stilId],
        (err) => err ? reject(err) : resolve()
      );
    })
  );

  Promise.all(updates)
    .then(() => res.json({ success: true }))
    .catch(err => {
      logger.error('Fehler beim Neuordnen der Kategorien:', err);
      res.status(500).json({ error: 'Fehler beim Neuordnen' });
    });
});

// PUT /:stilId/kategorien/:katId - Kategorie aktualisieren
router.put('/:stilId/kategorien/:katId', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  const katId = parseInt(req.params.katId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });
  if (!katId || isNaN(katId)) return res.status(400).json({ error: 'Ungültige Kategorie-ID' });

  const { label, icon } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Bezeichnung ist erforderlich' });
  if (label.trim().length > 100) return res.status(400).json({ error: 'Bezeichnung zu lang (max. 100 Zeichen)' });

  const iconVal = (icon || '📋').substring(0, 4);

  db.query(
    'UPDATE pruefungsinhalte_kategorien SET label = ?, icon = ? WHERE kategorie_id = ? AND stil_id = ?',
    [label.trim(), iconVal, katId, stilId],
    (err, result) => {
      if (err) {
        logger.error('Fehler beim Aktualisieren der Kategorie:', err);
        return res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// DELETE /:stilId/kategorien/:katId - Kategorie löschen
router.delete('/:stilId/kategorien/:katId', (req, res) => {
  const stilId = parseInt(req.params.stilId);
  const katId = parseInt(req.params.katId);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });
  if (!katId || isNaN(katId)) return res.status(400).json({ error: 'Ungültige Kategorie-ID' });

  // Hole den kategorie_key um zu prüfen ob Inhalte vorhanden sind
  db.query(
    'SELECT kategorie_key FROM pruefungsinhalte_kategorien WHERE kategorie_id = ? AND stil_id = ?',
    [katId, stilId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB-Fehler' });
      if (rows.length === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

      const { kategorie_key } = rows[0];

      // Prüfe ob Prüfungsinhalte mit diesem Key existieren
      db.query(
        `SELECT COUNT(*) AS anzahl FROM pruefungsinhalte pi
         JOIN graduierungen g ON pi.graduierung_id = g.graduierung_id
         WHERE g.stil_id = ? AND pi.kategorie = ? AND pi.aktiv = 1`,
        [stilId, kategorie_key],
        (countErr, countRows) => {
          if (countErr) return res.status(500).json({ error: 'DB-Fehler beim Prüfen der Inhalte' });

          const anzahl = countRows[0].anzahl;
          if (anzahl > 0) {
            return res.status(409).json({
              error: `Kategorie enthält noch ${anzahl} Prüfungsinhalt${anzahl !== 1 ? 'e' : ''} — bitte zuerst alle Inhalte leeren`
            });
          }

          // Soft-delete
          db.query(
            'UPDATE pruefungsinhalte_kategorien SET aktiv = 0 WHERE kategorie_id = ? AND stil_id = ?',
            [katId, stilId],
            (delErr) => {
              if (delErr) {
                logger.error('Fehler beim Löschen der Kategorie:', delErr);
                return res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
              }
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// ============================================================================
// PRÜFUNGSINHALTE CRUD
// ============================================================================

// GET /:stilId/graduierungen/:graduierungId/pruefungsinhalte - Prüfungsinhalte abrufen
router.get('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { graduierungId } = req.params;

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  const query = `
    SELECT inhalt_id, kategorie, titel, beschreibung, reihenfolge, pflicht, aktiv, ohne_punkte, ist_gesprungen
    FROM pruefungsinhalte
    WHERE graduierung_id = ? AND aktiv = 1
    ORDER BY kategorie, reihenfolge
  `;

  db.query(query, [graduierungId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Prüfungsinhalte:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungsinhalte' });
    }

    const pruefungsinhalte = {};
    results.forEach(inhalt => {
      if (!pruefungsinhalte[inhalt.kategorie]) {
        pruefungsinhalte[inhalt.kategorie] = [];
      }
      pruefungsinhalte[inhalt.kategorie].push({
        id: inhalt.inhalt_id,
        titel: inhalt.titel,
        beschreibung: inhalt.beschreibung,
        pflicht: inhalt.pflicht === 1,
        reihenfolge: inhalt.reihenfolge,
        ohne_punkte: inhalt.ohne_punkte === 1,
        ist_gesprungen: inhalt.ist_gesprungen === 1
      });
    });

    res.json({ pruefungsinhalte });
  });
});

// PUT /:stilId/graduierungen/:graduierungId/pruefungsinhalte - Prüfungsinhalte aktualisieren
router.put('/:stilId/graduierungen/:graduierungId/pruefungsinhalte', (req, res) => {
  const { graduierungId } = req.params;
  const { pruefungsinhalte } = req.body;

  if (!graduierungId || isNaN(graduierungId)) {
    return res.status(400).json({ error: 'Ungültige Graduierung-ID' });
  }

  if (!pruefungsinhalte) {
    return res.status(400).json({ error: 'Prüfungsinhalte sind erforderlich' });
  }

  const deleteQuery = 'DELETE FROM pruefungsinhalte WHERE graduierung_id = ?';

  db.query(deleteQuery, [graduierungId], (deleteError) => {
    if (deleteError) {
      logger.error('Fehler beim Löschen alter Prüfungsinhalte:', deleteError);
      return res.status(500).json({ error: 'Fehler beim Löschen alter Prüfungsinhalte' });
    }

    const insertPromises = [];

    Object.entries(pruefungsinhalte).forEach(([kategorie, inhalte]) => {
      if (Array.isArray(inhalte)) {
        inhalte.forEach((inhalt, index) => {
          const insertQuery = `
            INSERT INTO pruefungsinhalte
            (graduierung_id, kategorie, titel, beschreibung, reihenfolge, pflicht, aktiv)
            VALUES (?, ?, ?, ?, ?, 0, 1)
          `;

          const values = [
            graduierungId,
            kategorie,
            inhalt.inhalt || inhalt.titel || '',
            inhalt.beschreibung || '',
            inhalt.reihenfolge !== undefined ? inhalt.reihenfolge : index
          ];

          insertPromises.push(
            new Promise((resolve, reject) => {
              db.query(insertQuery, values, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            })
          );
        });
      }
    });

    Promise.all(insertPromises)
      .then(() => {
        res.json({
          success: true,
          message: 'Prüfungsinhalte aktualisiert',
          count: insertPromises.length
        });
      })
      .catch(error => {
        logger.error('Fehler beim Speichern der Prüfungsinhalte:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Prüfungsinhalte' });
      });
  });
});

module.exports = router;
