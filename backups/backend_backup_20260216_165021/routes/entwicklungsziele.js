const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Admin-Prüfung
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
  }
};

// ==================== ENTWICKLUNGSZIELE ====================

// Ziele abrufen
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { typ, kontext_typ, kontext_id } = req.query;

    let query = 'SELECT * FROM entwicklungsziele WHERE 1=1';
    const params = [];

    if (typ) {
      query += ' AND typ = ?';
      params.push(typ);
    }
    if (kontext_typ) {
      query += ' AND kontext_typ = ?';
      params.push(kontext_typ);
    }
    if (kontext_id) {
      query += ' AND kontext_id = ?';
      params.push(kontext_id);
    } else if (kontext_typ && kontext_typ !== 'global') {
      query += ' AND kontext_id IS NULL';
    }

    query += ' ORDER BY jahr ASC';

    const [ziele] = await db.promise().query(query, params);
    res.json(ziele);
  } catch (error) {
    logger.error('Fehler beim Laden der Ziele:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Ziele' });
  }
});

// Ziel erstellen oder aktualisieren (Upsert)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { typ, kontext_typ, kontext_id, jahr, ziel_wert, notizen } = req.body;

    const [result] = await db.promise().query(`
      INSERT INTO entwicklungsziele (typ, kontext_typ, kontext_id, jahr, ziel_wert, notizen, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ziel_wert = VALUES(ziel_wert),
        notizen = VALUES(notizen)
    `, [typ, kontext_typ || 'global', kontext_id || null, jahr, ziel_wert, notizen, req.user.id]);

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Fehler beim Speichern des Ziels:', { error: error });
    res.status(500).json({ error: 'Fehler beim Speichern des Ziels' });
  }
});

// Mehrere Ziele auf einmal speichern
router.post('/batch', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const { ziele } = req.body;

    for (const ziel of ziele) {
      await connection.query(`
        INSERT INTO entwicklungsziele (typ, kontext_typ, kontext_id, jahr, ziel_wert, notizen, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          ziel_wert = VALUES(ziel_wert),
          notizen = VALUES(notizen)
      `, [ziel.typ, ziel.kontext_typ || 'global', ziel.kontext_id || null,
          ziel.jahr, ziel.ziel_wert, ziel.notizen, req.user.id]);
    }

    await connection.commit();
    res.json({ success: true, count: ziele.length });
  } catch (error) {
    await connection.rollback();
    logger.error('Fehler beim Batch-Speichern:', { error: error });
    res.status(500).json({ error: 'Fehler beim Speichern der Ziele' });
  } finally {
    connection.release();
  }
});

// Ziel löschen
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.promise().query('DELETE FROM entwicklungsziele WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Löschen:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen des Ziels' });
  }
});

// ==================== BEITRAGSSTRUKTUREN ====================

// Beitragsstrukturen abrufen
router.get('/beitraege', authenticateToken, async (req, res) => {
  try {
    const { kontext_typ, kontext_id } = req.query;

    let query = 'SELECT * FROM beitragsstrukturen WHERE aktiv = 1';
    const params = [];

    if (kontext_typ) {
      query += ' AND kontext_typ = ?';
      params.push(kontext_typ);
    }
    if (kontext_id) {
      query += ' AND kontext_id = ?';
      params.push(kontext_id);
    }

    query += ' ORDER BY sortierung ASC';

    const [beitraege] = await db.promise().query(query, params);
    res.json(beitraege);
  } catch (error) {
    logger.error('Fehler beim Laden der Beiträge:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Beitragsstrukturen' });
  }
});

// Beitragsstruktur speichern
router.post('/beitraege', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { kontext_typ, kontext_id, name, monatsbeitrag, jahresbeitrag, einmalig, beschreibung, anteil_prozent, sortierung } = req.body;

    const [result] = await db.promise().query(`
      INSERT INTO beitragsstrukturen (kontext_typ, kontext_id, name, monatsbeitrag, jahresbeitrag, einmalig, beschreibung, anteil_prozent, sortierung)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        monatsbeitrag = VALUES(monatsbeitrag),
        jahresbeitrag = VALUES(jahresbeitrag),
        einmalig = VALUES(einmalig),
        beschreibung = VALUES(beschreibung),
        anteil_prozent = VALUES(anteil_prozent),
        sortierung = VALUES(sortierung)
    `, [kontext_typ || 'global', kontext_id || null, name, monatsbeitrag,
        jahresbeitrag || monatsbeitrag * 12, einmalig || 0, beschreibung, anteil_prozent || 0, sortierung || 0]);

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Fehler beim Speichern:', { error: error });
    res.status(500).json({ error: 'Fehler beim Speichern der Beitragsstruktur' });
  }
});

// Beitragsstruktur löschen
router.delete('/beitraege/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.promise().query('UPDATE beitragsstrukturen SET aktiv = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Löschen:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ==================== STATISTIKEN (IST-Werte) ====================

// Aktuelle IST-Werte abrufen (für Vergleich mit Zielen)
router.get('/statistiken', authenticateToken, async (req, res) => {
  try {
    const { kontext_typ, kontext_id } = req.query;
    const stats = {};

    // Verbandsmitglieder zählen
    const [verbandResult] = await db.promise().query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN typ = 'dojo' THEN 1 ELSE 0 END) as dojos,
        SUM(CASE WHEN typ = 'einzelperson' THEN 1 ELSE 0 END) as einzelpersonen,
        SUM(jahresbeitrag) as umsatz_verband
      FROM verbandsmitgliedschaften
      WHERE status = 'aktiv'
    `);
    stats.verband_mitglieder = verbandResult[0]?.total || 0;
    stats.verband_dojos = verbandResult[0]?.dojos || 0;
    stats.verband_einzelpersonen = verbandResult[0]?.einzelpersonen || 0;
    stats.umsatz_verband = parseFloat(verbandResult[0]?.umsatz_verband) || 0;

    // Dojo-Mitglieder zählen (ohne status-Filter da Spalte nicht existiert)
    let dojoQuery = 'SELECT COUNT(*) as count FROM mitglieder WHERE 1=1';
    const dojoParams = [];
    if (kontext_id) {
      dojoQuery += ' AND dojo_id = ?';
      dojoParams.push(kontext_id);
    }
    const [dojoResult] = await db.promise().query(dojoQuery, dojoParams);
    stats.dojo_mitglieder = dojoResult[0]?.count || 0;

    // Software-Nutzer (User) zählen
    const [userResult] = await db.promise().query(`
      SELECT COUNT(*) as count FROM users
    `);
    stats.software_nutzer = userResult[0]?.count || 0;

    // Dojos zählen
    const [dojoCountResult] = await db.promise().query(`
      SELECT COUNT(*) as count FROM dojo WHERE ist_aktiv = 1
    `);
    stats.dojos = dojoCountResult[0]?.count || 0;

    // Durchschnittlichen Dojo-Umsatz schätzen (basierend auf Tarifen)
    const [tarifResult] = await db.promise().query(`
      SELECT AVG(price_cents)/100 as durchschnitt
      FROM tarife
      WHERE active = 1 AND ist_archiviert = 0 AND price_cents > 0
    `);
    const avgBeitrag = parseFloat(tarifResult[0]?.durchschnitt) || 55;
    stats.umsatz_dojo = Math.round(stats.dojo_mitglieder * avgBeitrag * 12);

    // Gesamtumsatz
    stats.umsatz = stats.umsatz_verband + stats.umsatz_dojo;

    res.json(stats);
  } catch (error) {
    logger.error('Fehler beim Laden der Statistiken:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// ==================== VERGLEICHE ====================

// Vergleichsdaten abrufen (IST vs SOLL pro Jahr)
router.get('/vergleiche', authenticateToken, async (req, res) => {
  try {
    const { kontext_typ, kontext_id } = req.query;
    const currentYear = new Date().getFullYear();

    // Aktuelle IST-Werte
    const [verbandResult] = await db.promise().query(`
      SELECT COUNT(*) as total, SUM(jahresbeitrag) as umsatz
      FROM verbandsmitgliedschaften WHERE status = 'aktiv'
    `);

    const [dojoResult] = await db.promise().query('SELECT COUNT(*) as count FROM mitglieder');
    const [userResult] = await db.promise().query('SELECT COUNT(*) as count FROM users');
    const [dojosResult] = await db.promise().query('SELECT COUNT(*) as count FROM dojo WHERE ist_aktiv = 1');

    // Durchschnittsbeitrag für Umsatzberechnung
    const [tarifResult] = await db.promise().query(`
      SELECT AVG(price_cents)/100 as durchschnitt FROM tarife
      WHERE active = 1 AND ist_archiviert = 0 AND price_cents > 0
    `);
    const avgBeitrag = parseFloat(tarifResult[0]?.durchschnitt) || 55;

    const istWerte = {
      verband_mitglieder: verbandResult[0]?.total || 0,
      dojo_mitglieder: dojoResult[0]?.count || 0,
      software_nutzer: userResult[0]?.count || 0,
      dojos: dojosResult[0]?.count || 0,
      umsatz: (parseFloat(verbandResult[0]?.umsatz) || 0) + ((dojoResult[0]?.count || 0) * avgBeitrag * 12)
    };

    // SOLL-Werte aus entwicklungsziele
    let zieleQuery = 'SELECT typ, jahr, ziel_wert FROM entwicklungsziele WHERE 1=1';
    const params = [];
    if (kontext_typ) {
      zieleQuery += ' AND kontext_typ = ?';
      params.push(kontext_typ);
    }

    const [ziele] = await db.promise().query(zieleQuery, params);

    // Vergleiche strukturieren
    const vergleiche = {};
    const typen = ['verband_mitglieder', 'dojo_mitglieder', 'software_nutzer', 'dojos', 'umsatz'];

    typen.forEach(typ => {
      vergleiche[typ] = {
        ist: istWerte[typ] || 0,
        soll: {},
        differenz: {},
        prozent: {}
      };

      // SOLL-Werte pro Jahr
      ziele.filter(z => z.typ === typ).forEach(z => {
        const soll = parseFloat(z.ziel_wert);
        vergleiche[typ].soll[z.jahr] = soll;

        // Für aktuelles Jahr Differenz berechnen
        if (z.jahr === currentYear) {
          const ist = istWerte[typ] || 0;
          vergleiche[typ].differenz[z.jahr] = ist - soll;
          vergleiche[typ].prozent[z.jahr] = soll > 0 ? Math.round((ist / soll) * 100) : 0;
        }
      });
    });

    res.json({
      success: true,
      currentYear,
      istWerte,
      vergleiche
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Vergleiche:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Vergleiche' });
  }
});

module.exports = router;
