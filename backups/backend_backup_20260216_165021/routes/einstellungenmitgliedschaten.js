// routes/tarife.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tarife
// Liefert alle Tarife
router.get('/', (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      price_cents,
      currency,
      duration_months,
      billing_cycle,
      payment_method,
      active
    FROM tarife
    ORDER BY id
  `;
  db.query(sql, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Tarife:', { error: err });
      return res.status(500).json({ error: 'Serverfehler beim Abrufen der Tarife' });
    }
    res.json(results);
  });
});

// GET /api/tarife/:id
// Liefert einen einzelnen Tarif
router.get('/:id', (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      price_cents,
      currency,
      duration_months,
      billing_cycle,
      payment_method,
      active
    FROM tarife
    WHERE id = ?
    LIMIT 1
  `;
  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Tarifs:', { error: err });
      return res.status(500).json({ error: 'Serverfehler beim Abrufen des Tarifs' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Tarif nicht gefunden' });
    }
    res.json(results[0]);
  });
});

// POST /api/tarife
// Legt einen neuen Tarif an
router.post('/', (req, res) => {
  const {
    name,
    price_cents,
    currency = 'EUR',
    duration_months,
    billing_cycle,
    payment_method,
    active = 1
  } = req.body;

  // MySQL SET erwartet komma-separierten String
  const pm = Array.isArray(payment_method) ? payment_method.join(',') : payment_method;

  const sql = `
    INSERT INTO tarife
      (name, price_cents, currency, duration_months, billing_cycle, payment_method, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [name, price_cents, currency, duration_months, billing_cycle, pm, active ? 1 : 0],
    (err, result) => {
      if (err) {
        logger.error('Fehler beim Anlegen des Tarifs:', { error: err });
        return res.status(500).json({ error: 'Serverfehler beim Anlegen des Tarifs' });
      }
      // neuen Datensatz zurückliefern
      const newId = result.insertId;
      db.query(
        'SELECT * FROM tarife WHERE id = ? LIMIT 1',
        [newId],
        (err2, rows) => {
          if (err2) {
            logger.error('Fehler nach dem Anlegen des Tarifs:', { error: err2 });
            return res.status(500).json({ error: 'Serverfehler nach Anlegen des Tarifs' });
          }
          res.status(201).json(rows[0]);
        }
      );
    }
  );
});

// PUT /api/tarife/:id
// Aktualisiert einen bestehenden Tarif
router.put('/:id', (req, res) => {
  const {
    name,
    price_cents,
    currency,
    duration_months,
    billing_cycle,
    payment_method,
    active
  } = req.body;

  const pm = Array.isArray(payment_method) ? payment_method.join(',') : payment_method;

  const sql = `
    UPDATE tarife SET
      name = ?,
      price_cents = ?,
      currency = ?,
      duration_months = ?,
      billing_cycle = ?,
      payment_method = ?,
      active = ?
    WHERE id = ?
  `;
  db.query(
    sql,
    [name, price_cents, currency, duration_months, billing_cycle, pm, active ? 1 : 0, req.params.id],
    (err) => {
      if (err) {
        logger.error('Fehler beim Aktualisieren des Tarifs:', { error: err });
        return res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Tarifs' });
      }
      // aktualisierten Datensatz laden
      db.query(
        'SELECT * FROM tarife WHERE id = ? LIMIT 1',
        [req.params.id],
        (err2, rows) => {
          if (err2) {
            logger.error('Fehler nach dem Aktualisieren des Tarifs:', { error: err2 });
            return res.status(500).json({ error: 'Serverfehler nach Aktualisieren des Tarifs' });
          }
          res.json(rows[0]);
        }
      );
    }
  );
});

// PATCH /api/tarife/:id/active
// Aktiv/Inaktiv-Status eines Tarifs ändern
router.patch('/:id/active', (req, res) => {
  const { active } = req.body;
  const sql = 'UPDATE tarife SET active = ? WHERE id = ?';
  db.query(sql, [active ? 1 : 0, req.params.id], (err) => {
    if (err) {
      logger.error('Fehler beim Setzen des Active-Flags:', { error: err });
      return res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Active-Flags' });
    }
    res.sendStatus(204);
  });
});

// DELETE /api/tarife/:id
// Tarif löschen
router.delete('/:id', (req, res) => {
  db.query('DELETE FROM tarife WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      logger.error('Fehler beim Löschen des Tarifs:', { error: err });
      return res.status(500).json({ error: 'Serverfehler beim Löschen des Tarifs' });
    }
    res.sendStatus(204);
  });
});

module.exports = router;
