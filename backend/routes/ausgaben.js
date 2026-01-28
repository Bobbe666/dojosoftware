/**
 * Ausgaben-Verwaltung Routes
 * ==========================
 * CRUD-Operationen für Betriebsausgaben (EÜR-relevant)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

/**
 * Helper: Query als Promise
 */
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * GET /api/ausgaben
 * Liste aller Ausgaben für ein Dojo
 */
router.get('/', async (req, res) => {
  const dojo_id = req.query.dojo_id || req.user?.dojo_id;
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
  const monat = req.query.monat ? parseInt(req.query.monat) : null;
  const kategorie = req.query.kategorie || null;

  if (!dojo_id) {
    return res.status(400).json({ error: 'dojo_id erforderlich' });
  }

  try {
    let query = `
      SELECT
        eintrag_id as id,
        geschaeft_datum as datum,
        betrag_cent / 100 as betrag,
        beschreibung,
        beleg_nummer,
        kategorie,
        erfasst_von_name,
        eintrag_timestamp as erstellt_am
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
    `;
    const params = [dojo_id, jahr];

    if (monat) {
      query += ' AND MONTH(geschaeft_datum) = ?';
      params.push(monat);
    }

    if (kategorie) {
      query += ' AND kategorie = ?';
      params.push(kategorie);
    }

    query += ' ORDER BY geschaeft_datum DESC, eintrag_id DESC';

    const ausgaben = await queryAsync(query, params);

    // Summen berechnen
    const summenQuery = `
      SELECT
        COUNT(*) as anzahl,
        SUM(betrag_cent) / 100 as gesamt
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
        ${monat ? 'AND MONTH(geschaeft_datum) = ?' : ''}
    `;
    const summenParams = monat ? [dojo_id, jahr, monat] : [dojo_id, jahr];
    const [summen] = await queryAsync(summenQuery, summenParams);

    res.json({
      success: true,
      ausgaben,
      summen: {
        anzahl: summen?.anzahl || 0,
        gesamt: summen?.gesamt || 0
      }
    });

  } catch (err) {
    console.error('Ausgaben laden Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Ausgaben' });
  }
});

/**
 * GET /api/ausgaben/kategorien
 * Verfügbare Ausgaben-Kategorien
 */
router.get('/kategorien', (req, res) => {
  res.json({
    success: true,
    kategorien: [
      { key: 'miete', label: 'Miete & Nebenkosten', icon: 'home' },
      { key: 'personal', label: 'Personalkosten', icon: 'users' },
      { key: 'material', label: 'Material & Ausstattung', icon: 'box' },
      { key: 'marketing', label: 'Marketing & Werbung', icon: 'megaphone' },
      { key: 'versicherung', label: 'Versicherungen', icon: 'shield' },
      { key: 'gebuehren', label: 'Gebühren & Beiträge', icon: 'receipt' },
      { key: 'fahrtkosten', label: 'Fahrtkosten', icon: 'car' },
      { key: 'telefon', label: 'Telefon & Internet', icon: 'phone' },
      { key: 'software', label: 'Software & Lizenzen', icon: 'laptop' },
      { key: 'fortbildung', label: 'Fortbildung & Seminare', icon: 'graduation-cap' },
      { key: 'reparatur', label: 'Reparaturen & Wartung', icon: 'wrench' },
      { key: 'buero', label: 'Büromaterial', icon: 'paperclip' },
      { key: 'sonstiges', label: 'Sonstige Ausgaben', icon: 'ellipsis' }
    ]
  });
});

/**
 * POST /api/ausgaben
 * Neue Ausgabe erfassen
 */
router.post('/', async (req, res) => {
  const {
    dojo_id,
    datum,
    betrag,
    beschreibung,
    beleg_nummer,
    kategorie
  } = req.body;

  const finalDojoId = dojo_id || req.user?.dojo_id;

  if (!finalDojoId || !datum || !betrag || !beschreibung) {
    return res.status(400).json({
      error: 'Pflichtfelder: dojo_id, datum, betrag, beschreibung'
    });
  }

  try {
    // Aktuellen Kassenstand holen
    const kassenstandQuery = `
      SELECT kassenstand_nachher_cent
      FROM kassenbuch
      WHERE dojo_id = ?
      ORDER BY eintrag_id DESC
      LIMIT 1
    `;
    const [letzterEintrag] = await queryAsync(kassenstandQuery, [finalDojoId]);
    const kassenstandVorher = letzterEintrag?.kassenstand_nachher_cent || 0;
    const betragCent = Math.round(parseFloat(betrag) * 100);
    const kassenstandNachher = kassenstandVorher - betragCent;

    // Ausgabe einfügen
    const insertQuery = `
      INSERT INTO kassenbuch (
        dojo_id,
        geschaeft_datum,
        bewegungsart,
        betrag_cent,
        beschreibung,
        beleg_nummer,
        kategorie,
        kassenstand_vorher_cent,
        kassenstand_nachher_cent,
        erfasst_von,
        erfasst_von_name
      ) VALUES (?, ?, 'Ausgabe', ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await queryAsync(insertQuery, [
      finalDojoId,
      datum,
      betragCent,
      beschreibung,
      beleg_nummer || null,
      kategorie || 'sonstiges',
      kassenstandVorher,
      kassenstandNachher,
      req.user?.id || null,
      req.user?.name || req.user?.email || 'System'
    ]);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Ausgabe erfolgreich erfasst'
    });

  } catch (err) {
    console.error('Ausgabe erfassen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Erfassen der Ausgabe' });
  }
});

/**
 * PUT /api/ausgaben/:id
 * Ausgabe bearbeiten
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    datum,
    betrag,
    beschreibung,
    beleg_nummer,
    kategorie
  } = req.body;

  try {
    const betragCent = betrag ? Math.round(parseFloat(betrag) * 100) : null;

    let updateFields = [];
    let params = [];

    if (datum) {
      updateFields.push('geschaeft_datum = ?');
      params.push(datum);
    }
    if (betragCent !== null) {
      updateFields.push('betrag_cent = ?');
      params.push(betragCent);
    }
    if (beschreibung) {
      updateFields.push('beschreibung = ?');
      params.push(beschreibung);
    }
    if (beleg_nummer !== undefined) {
      updateFields.push('beleg_nummer = ?');
      params.push(beleg_nummer || null);
    }
    if (kategorie) {
      updateFields.push('kategorie = ?');
      params.push(kategorie);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    params.push(id);

    const query = `
      UPDATE kassenbuch
      SET ${updateFields.join(', ')}
      WHERE eintrag_id = ? AND bewegungsart = 'Ausgabe'
    `;

    await queryAsync(query, params);

    res.json({
      success: true,
      message: 'Ausgabe erfolgreich aktualisiert'
    });

  } catch (err) {
    console.error('Ausgabe aktualisieren Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Ausgabe' });
  }
});

/**
 * DELETE /api/ausgaben/:id
 * Ausgabe löschen
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM kassenbuch
      WHERE eintrag_id = ? AND bewegungsart = 'Ausgabe'
    `;

    const result = await queryAsync(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ausgabe nicht gefunden' });
    }

    res.json({
      success: true,
      message: 'Ausgabe erfolgreich gelöscht'
    });

  } catch (err) {
    console.error('Ausgabe löschen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Löschen der Ausgabe' });
  }
});

/**
 * GET /api/ausgaben/summen
 * Ausgaben-Summen nach Kategorie
 */
router.get('/summen', async (req, res) => {
  const dojo_id = req.query.dojo_id || req.user?.dojo_id;
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

  if (!dojo_id) {
    return res.status(400).json({ error: 'dojo_id erforderlich' });
  }

  try {
    const query = `
      SELECT
        COALESCE(kategorie, 'sonstiges') as kategorie,
        COUNT(*) as anzahl,
        SUM(betrag_cent) / 100 as summe
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
      GROUP BY kategorie
      ORDER BY summe DESC
    `;

    const summen = await queryAsync(query, [dojo_id, jahr]);

    // Monatliche Entwicklung
    const monatlichQuery = `
      SELECT
        MONTH(geschaeft_datum) as monat,
        SUM(betrag_cent) / 100 as summe
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
      GROUP BY MONTH(geschaeft_datum)
      ORDER BY monat
    `;

    const monatlich = await queryAsync(monatlichQuery, [dojo_id, jahr]);

    res.json({
      success: true,
      nachKategorie: summen,
      monatlich
    });

  } catch (err) {
    console.error('Ausgaben-Summen Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Summen' });
  }
});

module.exports = router;
