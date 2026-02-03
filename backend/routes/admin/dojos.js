/**
 * Admin Dojo Routes
 * CRUD-Operationen für Dojo-Management
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin, calculateDojoStorageUsage } = require('./shared');

// GET /dojos - Alle Dojos auflisten
router.get('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const { filter } = req.query;

    const whereClause = filter === 'managed'
      ? `WHERE d.ist_aktiv = TRUE AND (d.id = 2 OR d.id NOT IN (
          SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND dojo_id != 2
        ))`
      : '';

    const query = `
      SELECT
        d.id, d.dojoname, d.subdomain, d.inhaber, d.ort, d.email, d.telefon,
        d.ist_aktiv, d.mitgliederzahl_aktuell, d.created_at, d.onboarding_completed,
        d.subscription_status, d.trial_ends_at, d.subscription_plan,
        d.subscription_started_at, d.subscription_ends_at, d.payment_interval, d.last_payment_at,
        DATEDIFF(d.trial_ends_at, NOW()) as trial_days_remaining,
        DATEDIFF(d.subscription_ends_at, NOW()) as subscription_days_remaining,
        COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count,
        COUNT(DISTINCT t.trainer_id) AS trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY d.dojoname
    `;

    const [dojos] = await db.promise().query(query);

    const dojosWithStorage = await Promise.all(
      dojos.map(async (dojo) => {
        const storage_mb = await calculateDojoStorageUsage(dojo.id);
        return { ...dojo, storage_mb, storage_gb: (storage_mb / 1024).toFixed(2) };
      })
    );

    res.json({ success: true, count: dojosWithStorage.length, dojos: dojosWithStorage });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dojos', details: error.message });
  }
});

// GET /dojos/:id - Einzelnes Dojo abrufen
router.get('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT d.*, COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count, COUNT(DISTINCT t.trainer_id) AS trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      WHERE d.id = ?
      GROUP BY d.id
    `;
    const [dojos] = await db.promise().query(query, [id]);

    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }
    res.json({ success: true, dojo: dojos[0] });
  } catch (error) {
    logger.error('Fehler beim Abrufen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Dojos', details: error.message });
  }
});

// POST /dojos - Neues Dojo anlegen
router.post('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const { dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land = 'Deutschland' } = req.body;

    if (!dojoname || !inhaber) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen', required: ['dojoname', 'inhaber'] });
    }

    if (subdomain) {
      const [existing] = await db.promise().query('SELECT id FROM dojo WHERE subdomain = ?', [subdomain]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Subdomain bereits vergeben', subdomain });
      }
    }

    const [result] = await db.promise().query(`
      INSERT INTO dojo (dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land, ist_aktiv, onboarding_completed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())`,
      [dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land]
    );

    logger.info('Neues Dojo angelegt:', { dojoname, id: result.insertId });
    res.status(201).json({ success: true, message: 'Dojo erfolgreich angelegt', dojo_id: result.insertId, dojoname, subdomain });
  } catch (error) {
    logger.error('Fehler beim Anlegen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen des Dojos', details: error.message });
  }
});

// PUT /dojos/:id - Dojo bearbeiten
router.put('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const [existing] = await db.promise().query('SELECT id FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    if (updates.subdomain) {
      const [subdomainCheck] = await db.promise().query('SELECT id FROM dojo WHERE subdomain = ? AND id != ?', [updates.subdomain, id]);
      if (subdomainCheck.length > 0) {
        return res.status(400).json({ error: 'Subdomain bereits vergeben', subdomain: updates.subdomain });
      }
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen übergeben' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(id);

    await db.promise().query(`UPDATE dojo SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);

    logger.info('Dojo aktualisiert:', { id });
    res.json({ success: true, message: 'Dojo erfolgreich aktualisiert', dojo_id: id });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Dojos', details: error.message });
  }
});

// DELETE /dojos/:id - Dojo löschen (Soft-Delete)
router.delete('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.promise().query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    if (parseInt(id) === 2) {
      return res.status(403).json({ error: 'TDA International kann nicht gelöscht werden' });
    }

    await db.promise().query('UPDATE dojo SET ist_aktiv = 0, updated_at = NOW() WHERE id = ?', [id]);

    logger.info('Dojo deaktiviert:', { dojoname: existing[0].dojoname, id });
    res.json({ success: true, message: 'Dojo erfolgreich deaktiviert', dojo_id: id, dojoname: existing[0].dojoname });
  } catch (error) {
    logger.error('Fehler beim Löschen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Dojos', details: error.message });
  }
});

module.exports = router;
