const express = require('express');
const logger = require('../utils/logger');
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();
const router = express.Router();

// Hilfsfunktion: Prüfen ob mitglied_id zum anfragenden Dojo gehört
async function verifyMitgliedAccess(mitglied_id, dojoId) {
    if (!dojoId) return true; // Super-Admin: alle erlaubt
    const [rows] = await pool.query(
        'SELECT 1 FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, dojoId]
    );
    return rows.length > 0;
}

// =====================================================================================
// FORTSCHRITT - Skills & Techniken
// =====================================================================================

// GET: Alle Fortschritt-Skills eines Mitglieds
router.get('/mitglied/:mitglied_id', async (req, res) => {
  const { mitglied_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const [results] = await pool.query(`
      SELECT mf.*, fk.name as kategorie_name, fk.icon as kategorie_icon, fk.farbe_hex as kategorie_farbe
      FROM mitglieder_fortschritt mf
      LEFT JOIN fortschritt_kategorien fk ON mf.kategorie_id = fk.kategorie_id
      WHERE mf.mitglied_id = ?
      ORDER BY fk.reihenfolge, mf.prioritaet DESC, mf.fortschritt_prozent DESC
    `, [mitglied_id]);
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden des Fortschritts:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden des Fortschritts' });
  }
});

// POST: Neuer Fortschritt-Eintrag
router.post('/mitglied/:mitglied_id', async (req, res) => {
  const { mitglied_id } = req.params;
  const { kategorie_id, skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit, ziel_datum } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const [result] = await pool.query(`
      INSERT INTO mitglieder_fortschritt
      (mitglied_id, kategorie_id, skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit, ziel_datum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      mitglied_id, kategorie_id, skill_name, beschreibung || null,
      fortschritt_prozent || 0, status || 'nicht_gestartet',
      prioritaet || 'mittel', schwierigkeit || 'anfaenger', ziel_datum || null
    ]);

    const [rows] = await pool.query('SELECT * FROM mitglieder_fortschritt WHERE fortschritt_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Erstellen des Fortschritts:', { error: err });
    res.status(500).json({ error: 'Fehler beim Erstellen des Fortschritts' });
  }
});

// PUT: Fortschritt aktualisieren (mit dojo-Verifikation via Subquery)
router.put('/:fortschritt_id', async (req, res) => {
  const { fortschritt_id } = req.params;
  const { skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit,
          ziel_datum, trainer_bewertung, trainer_kommentar, updated_by, updated_by_name, update_reason } = req.body;
  try {
    const dojoId = getSecureDojoId(req);

    // Sicherheitsprüfung: Eintrag gehört zu einem Mitglied des anfragenden Dojos
    let checkQuery, checkParams;
    if (dojoId) {
      checkQuery = 'SELECT 1 FROM mitglieder_fortschritt mf JOIN mitglieder m ON mf.mitglied_id = m.mitglied_id WHERE mf.fortschritt_id = ? AND m.dojo_id = ?';
      checkParams = [fortschritt_id, dojoId];
    } else {
      checkQuery = 'SELECT 1 FROM mitglieder_fortschritt WHERE fortschritt_id = ?';
      checkParams = [fortschritt_id];
    }
    const [check] = await pool.query(checkQuery, checkParams);
    if (!check.length) return res.status(403).json({ error: 'Zugriff verweigert' });

    await pool.query(`
      UPDATE mitglieder_fortschritt
      SET skill_name = ?, beschreibung = ?, fortschritt_prozent = ?, status = ?,
          prioritaet = ?, schwierigkeit = ?, ziel_datum = ?, trainer_bewertung = ?, trainer_kommentar = ?
      WHERE fortschritt_id = ?
    `, [skill_name, beschreibung, fortschritt_prozent, status, prioritaet, schwierigkeit,
        ziel_datum || null, trainer_bewertung || null, trainer_kommentar || null, fortschritt_id]);

    if (updated_by && update_reason) {
      try {
        await pool.query(`
          INSERT INTO fortschritt_updates
          (fortschritt_id, mitglied_id, alter_fortschritt, neuer_fortschritt, alter_status, neuer_status, notiz, aktualisiert_von_name)
          SELECT ?, mitglied_id,
                 (SELECT fortschritt_prozent FROM mitglieder_fortschritt WHERE fortschritt_id = ?),
                 ?,
                 (SELECT status FROM mitglieder_fortschritt WHERE fortschritt_id = ?),
                 ?, ?, ?
          FROM mitglieder_fortschritt WHERE fortschritt_id = ?
        `, [fortschritt_id, fortschritt_id, fortschritt_prozent, fortschritt_id,
            status, `Slider geändert von ${updated_by_name}`, updated_by_name, fortschritt_id]);
      } catch (histErr) {
        logger.error('Fehler beim Speichern der Historie:', { error: histErr });
      }
    }

    const [rows] = await pool.query('SELECT * FROM mitglieder_fortschritt WHERE fortschritt_id = ?', [fortschritt_id]);
    res.json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Fortschritts:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// DELETE: Fortschritt löschen
router.delete('/:fortschritt_id', async (req, res) => {
  const { fortschritt_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    let query, params;
    if (dojoId) {
      query = 'DELETE FROM mitglieder_fortschritt WHERE fortschritt_id = ? AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)';
      params = [fortschritt_id, dojoId];
    } else {
      query = 'DELETE FROM mitglieder_fortschritt WHERE fortschritt_id = ?';
      params = [fortschritt_id];
    }
    const [result] = await pool.query(query, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, message: 'Fortschritt gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen des Fortschritts:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// GET: Fortschritt-Historie
router.get('/:fortschritt_id/history', async (req, res) => {
  const { fortschritt_id } = req.params;
  try {
    const [results] = await pool.query(`
      SELECT fu.*, mf.skill_name, CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
      FROM fortschritt_updates fu
      LEFT JOIN mitglieder_fortschritt mf ON fu.fortschritt_id = mf.fortschritt_id
      LEFT JOIN mitglieder m ON fu.mitglied_id = m.mitglied_id
      WHERE fu.fortschritt_id = ?
      ORDER BY fu.update_timestamp DESC
      LIMIT 50
    `, [fortschritt_id]);
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden der Historie:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Historie' });
  }
});

// =====================================================================================
// ZIELE (GOALS)
// =====================================================================================

router.get('/mitglied/:mitglied_id/ziele', async (req, res) => {
  const { mitglied_id } = req.params;
  const { status } = req.query;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    let query = 'SELECT * FROM mitglieder_ziele WHERE mitglied_id = ?';
    const params = [mitglied_id];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY prioritaet DESC, ziel_datum ASC';
    const [results] = await pool.query(query, params);
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden der Ziele:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Ziele' });
  }
});

router.post('/mitglied/:mitglied_id/ziele', async (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, beschreibung, start_datum, ziel_datum, prioritaet, messbar, einheit, ziel_wert } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [result] = await pool.query(`
      INSERT INTO mitglieder_ziele
      (mitglied_id, titel, beschreibung, start_datum, ziel_datum, prioritaet, messbar, einheit, ziel_wert)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [mitglied_id, titel, beschreibung || null, start_datum, ziel_datum,
        prioritaet || 'mittel', messbar || false, messbar ? einheit : null, messbar ? ziel_wert : null]);
    const [rows] = await pool.query('SELECT * FROM mitglieder_ziele WHERE ziel_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Erstellen des Ziels:', { error: err });
    res.status(500).json({ error: 'Fehler beim Erstellen des Ziels' });
  }
});

router.put('/ziele/:ziel_id', async (req, res) => {
  const { ziel_id } = req.params;
  const { titel, beschreibung, ziel_datum, status, fortschritt_prozent, aktueller_wert, prioritaet } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (dojoId) {
      const [check] = await pool.query(
        'SELECT 1 FROM mitglieder_ziele z JOIN mitglieder m ON z.mitglied_id = m.mitglied_id WHERE z.ziel_id = ? AND m.dojo_id = ?',
        [ziel_id, dojoId]
      );
      if (!check.length) return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await pool.query(`
      UPDATE mitglieder_ziele
      SET titel = ?, beschreibung = ?, ziel_datum = ?, status = ?,
          fortschritt_prozent = ?, aktueller_wert = ?, prioritaet = ?
      WHERE ziel_id = ?
    `, [titel, beschreibung, ziel_datum, status, fortschritt_prozent, aktueller_wert || 0, prioritaet, ziel_id]);
    const [rows] = await pool.query('SELECT * FROM mitglieder_ziele WHERE ziel_id = ?', [ziel_id]);
    res.json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Ziels:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

router.delete('/ziele/:ziel_id', async (req, res) => {
  const { ziel_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    let query, params;
    if (dojoId) {
      query = 'DELETE FROM mitglieder_ziele WHERE ziel_id = ? AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)';
      params = [ziel_id, dojoId];
    } else {
      query = 'DELETE FROM mitglieder_ziele WHERE ziel_id = ?';
      params = [ziel_id];
    }
    const [result] = await pool.query(query, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, message: 'Ziel gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen des Ziels:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// =====================================================================================
// MEILENSTEINE
// =====================================================================================

router.get('/mitglied/:mitglied_id/meilensteine', async (req, res) => {
  const { mitglied_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [results] = await pool.query(
      'SELECT * FROM mitglieder_meilensteine WHERE mitglied_id = ? ORDER BY erreicht DESC, ziel_datum ASC',
      [mitglied_id]
    );
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden der Meilensteine:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Meilensteine' });
  }
});

router.post('/mitglied/:mitglied_id/meilensteine', async (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, beschreibung, typ, ziel_datum, belohnung, oeffentlich } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [result] = await pool.query(`
      INSERT INTO mitglieder_meilensteine
      (mitglied_id, titel, beschreibung, typ, ziel_datum, belohnung, oeffentlich)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [mitglied_id, titel, beschreibung || null, typ || 'achievement', ziel_datum || null, belohnung || null, oeffentlich || false]);
    const [rows] = await pool.query('SELECT * FROM mitglieder_meilensteine WHERE meilenstein_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Erstellen des Meilensteins:', { error: err });
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

router.put('/meilensteine/:meilenstein_id/erreicht', async (req, res) => {
  const { meilenstein_id } = req.params;
  const { erreicht } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (dojoId) {
      const [check] = await pool.query(
        'SELECT 1 FROM mitglieder_meilensteine ms JOIN mitglieder m ON ms.mitglied_id = m.mitglied_id WHERE ms.meilenstein_id = ? AND m.dojo_id = ?',
        [meilenstein_id, dojoId]
      );
      if (!check.length) return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await pool.query(
      `UPDATE mitglieder_meilensteine SET erreicht = ?, erreicht_am = ${erreicht ? 'CURDATE()' : 'NULL'} WHERE meilenstein_id = ?`,
      [erreicht, meilenstein_id]
    );
    const [rows] = await pool.query('SELECT * FROM mitglieder_meilensteine WHERE meilenstein_id = ?', [meilenstein_id]);
    res.json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Meilensteins:', { error: err });
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

router.delete('/meilensteine/:meilenstein_id', async (req, res) => {
  const { meilenstein_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    let query, params;
    if (dojoId) {
      query = 'DELETE FROM mitglieder_meilensteine WHERE meilenstein_id = ? AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)';
      params = [meilenstein_id, dojoId];
    } else {
      query = 'DELETE FROM mitglieder_meilensteine WHERE meilenstein_id = ?';
      params = [meilenstein_id];
    }
    const [result] = await pool.query(query, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, message: 'Meilenstein gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen des Meilensteins:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// =====================================================================================
// TRAININGS-NOTIZEN
// =====================================================================================

router.get('/mitglied/:mitglied_id/notizen', async (req, res) => {
  const { mitglied_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [results] = await pool.query(
      'SELECT * FROM trainings_notizen WHERE mitglied_id = ? ORDER BY datum DESC, erstellt_am DESC LIMIT 100',
      [mitglied_id]
    );
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden der Notizen:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden der Notizen' });
  }
});

router.post('/mitglied/:mitglied_id/notizen', async (req, res) => {
  const { mitglied_id } = req.params;
  const { titel, notiz, typ, datum, privat, trainer_id } = req.body;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [result] = await pool.query(`
      INSERT INTO trainings_notizen (mitglied_id, trainer_id, titel, notiz, typ, datum, privat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [mitglied_id, trainer_id || null, titel || null, notiz, typ || 'allgemein',
        datum || new Date().toISOString().split('T')[0], privat || false]);
    const [rows] = await pool.query('SELECT * FROM trainings_notizen WHERE notiz_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('Fehler beim Erstellen der Notiz:', { error: err });
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});

router.delete('/notizen/:notiz_id', async (req, res) => {
  const { notiz_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    let query, params;
    if (dojoId) {
      query = 'DELETE FROM trainings_notizen WHERE notiz_id = ? AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)';
      params = [notiz_id, dojoId];
    } else {
      query = 'DELETE FROM trainings_notizen WHERE notiz_id = ?';
      params = [notiz_id];
    }
    const [result] = await pool.query(query, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, message: 'Notiz gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen der Notiz:', { error: err });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// =====================================================================================
// KATEGORIEN (globale Lookup-Tabelle - kein dojo_id Filter nötig)
// =====================================================================================

router.get('/kategorien', async (req, res) => {
  try {
    const [results] = await pool.query(
      'SELECT * FROM fortschritt_kategorien WHERE aktiv = TRUE ORDER BY reihenfolge'
    );
    res.json(results);
  } catch (err) {
    logger.error('Fehler beim Laden der Kategorien:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// =====================================================================================
// STATISTIKEN & ÜBERSICHTEN
// =====================================================================================

router.get('/mitglied/:mitglied_id/overview', async (req, res) => {
  const { mitglied_id } = req.params;
  try {
    const dojoId = getSecureDojoId(req);
    if (!(await verifyMitgliedAccess(mitglied_id, dojoId))) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const [results] = await pool.query(
      'SELECT * FROM mitglied_fortschritt_overview WHERE mitglied_id = ?',
      [mitglied_id]
    );
    res.json(results[0] || {});
  } catch (err) {
    logger.error('Fehler beim Laden der Übersicht:', { error: err });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

module.exports = router;
