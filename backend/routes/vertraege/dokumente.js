/**
 * Vertraege Dokumente Routes
 * AGB, Datenschutz und Vertragsdokumente verwalten
 */
const express = require('express');
const logger = require('../../utils/logger');
const router = express.Router();
const { queryAsync } = require('./shared');

// GET /dokumente/:dojo_id - AGB und Datenschutz für ein Dojo abrufen
router.get('/dokumente/:dojo_id', async (req, res) => {
  try {
    const { dojo_id } = req.params;
    const { aktiv_nur } = req.query;

    let whereClause = '';
    let queryParams = [];

    if (dojo_id === 'all') {
      whereClause = aktiv_nur === 'true' ? 'WHERE aktiv = TRUE' : '';
    } else {
      whereClause = 'WHERE dojo_id = ?';
      queryParams.push(parseInt(dojo_id));
      if (aktiv_nur === 'true') whereClause += ' AND aktiv = TRUE';
    }

    const dokumente = await queryAsync(`
      SELECT vd.id, vd.dojo_id, vd.dokumenttyp, vd.version, vd.titel, vd.inhalt,
        vd.gueltig_ab, vd.gueltig_bis, vd.aktiv, vd.erstellt_am, vd.aktualisiert_am, d.dojoname
      FROM vertragsdokumente vd
      LEFT JOIN dojo d ON vd.dojo_id = d.id
      ${whereClause}
      ORDER BY vd.dokumenttyp, vd.version DESC
    `, queryParams);

    res.json({ success: true, data: dokumente });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Dokumente:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /dokumente - Neues Dokument/Version erstellen
router.post('/dokumente', async (req, res) => {
  try {
    const { dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, gueltig_bis, aktiv, erstellt_von } = req.body;

    if (!dojo_id || !dokumenttyp || !version || !titel || !inhalt || !gueltig_ab) {
      return res.status(400).json({
        error: 'Fehlende Pflichtfelder',
        required: ['dojo_id', 'dokumenttyp', 'version', 'titel', 'inhalt', 'gueltig_ab']
      });
    }

    const existing = await queryAsync(`
      SELECT id FROM vertragsdokumente WHERE dojo_id = ? AND dokumenttyp = ? AND version = ?
    `, [dojo_id, dokumenttyp, version]);

    if (existing.length > 0) {
      return res.status(400).json({ error: `Version ${version} für ${dokumenttyp} existiert bereits.` });
    }

    const result = await queryAsync(`
      INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, gueltig_bis, aktiv, erstellt_von)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [parseInt(dojo_id), dokumenttyp, version, titel, inhalt, gueltig_ab, gueltig_bis || null, aktiv !== undefined ? aktiv : true, erstellt_von || null]);

    res.json({ success: true, data: { id: result.insertId, dojo_id, dokumenttyp, version, titel } });
  } catch (err) {
    logger.error('Fehler beim Erstellen der Dokumentversion:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// PUT /dokumente/:id - Dokumentversion aktualisieren
router.put('/dokumente/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titel, inhalt, gueltig_ab, gueltig_bis, aktiv, dojo_id } = req.body;

    if (dojo_id) {
      const dokCheck = await queryAsync(`SELECT id, dojo_id FROM vertragsdokumente WHERE id = ?`, [id]);
      if (dokCheck.length === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });
      if (dokCheck[0].dojo_id !== parseInt(dojo_id)) return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const updates = [];
    const values = [];

    if (titel !== undefined) { updates.push('titel = ?'); values.push(titel); }
    if (inhalt !== undefined) { updates.push('inhalt = ?'); values.push(inhalt); }
    if (gueltig_ab !== undefined) { updates.push('gueltig_ab = ?'); values.push(gueltig_ab); }
    if (gueltig_bis !== undefined) { updates.push('gueltig_bis = ?'); values.push(gueltig_bis || null); }
    if (aktiv !== undefined) { updates.push('aktiv = ?'); values.push(aktiv); }

    if (updates.length === 0) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });

    values.push(id);

    const result = await queryAsync(`UPDATE vertragsdokumente SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });

    res.json({ success: true, message: 'Dokument erfolgreich aktualisiert' });
  } catch (err) {
    logger.error('Fehler beim Aktualisieren der Dokumentversion:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /dokumente/:id/copy - Dokument in anderes Dojo kopieren
router.post('/dokumente/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { target_dojo_id } = req.body;

    if (!target_dojo_id) return res.status(400).json({ error: 'target_dojo_id ist erforderlich' });

    const original = await queryAsync(`SELECT * FROM vertragsdokumente WHERE id = ?`, [id]);
    if (original.length === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });

    const doc = original[0];

    const existing = await queryAsync(`
      SELECT id FROM vertragsdokumente WHERE dojo_id = ? AND dokumenttyp = ? AND version = ?
    `, [target_dojo_id, doc.dokumenttyp, doc.version]);

    if (existing.length > 0) {
      return res.status(400).json({ error: `Dokument "${doc.titel}" (Version ${doc.version}) existiert bereits im Ziel-Dojo` });
    }

    const result = await queryAsync(`
      INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, gueltig_bis, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [target_dojo_id, doc.dokumenttyp, doc.version, doc.titel, doc.inhalt, doc.gueltig_ab, doc.gueltig_bis, doc.aktiv]);

    res.json({ success: true, message: `Dokument "${doc.titel}" erfolgreich kopiert`, data: { id: result.insertId } });
  } catch (err) {
    logger.error('Fehler beim Kopieren des Dokuments:', { error: err });
    res.status(500).json({ error: 'Fehler beim Kopieren', details: err.message });
  }
});

// POST /dokumente/import-from-dojos - Dokumente aus Dojo-Tabelle importieren
router.post('/dokumente/import-from-dojos', async (req, res) => {
  try {
    const dojos = await queryAsync(`
      SELECT id, dojoname, agb_text, dsgvo_text, dojo_regeln_text, hausordnung_text,
        haftungsausschluss_text, widerrufsbelehrung_text, impressum_text, vertragsbedingungen_text
      FROM dojo
    `);

    let imported = 0;
    let skipped = 0;

    for (const dojo of dojos) {
      const dokumentTypen = [
        { typ: 'agb', text: dojo.agb_text, titel: 'AGB (Allgemeine Geschäftsbedingungen)' },
        { typ: 'datenschutz', text: dojo.dsgvo_text, titel: 'Datenschutzerklärung' },
        { typ: 'hausordnung', text: dojo.hausordnung_text || dojo.dojo_regeln_text, titel: dojo.dojo_regeln_text ? 'Dojo Regeln (Dojokun)' : 'Hausordnung' },
        { typ: 'haftung', text: dojo.haftungsausschluss_text, titel: 'Haftungsausschluss' },
        { typ: 'widerruf', text: dojo.widerrufsbelehrung_text, titel: 'Widerrufsbelehrung' },
        { typ: 'sonstiges', text: dojo.impressum_text, titel: 'Impressum' },
        { typ: 'sonstiges', text: dojo.vertragsbedingungen_text, titel: 'Vertragsbedingungen' }
      ];

      for (const dok of dokumentTypen) {
        if (!dok.text || dok.text.trim() === '') continue;

        const existing = await queryAsync(`
          SELECT id FROM vertragsdokumente WHERE dojo_id = ? AND dokumenttyp = ? AND version = '1.0'
        `, [dojo.id, dok.typ]);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await queryAsync(`
          INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
          VALUES (?, ?, ?, ?, ?, CURDATE(), TRUE)
        `, [dojo.id, dok.typ, '1.0', dok.titel, dok.text]);

        imported++;
      }
    }

    res.json({ success: true, message: `${imported} Dokumente importiert, ${skipped} übersprungen`, imported, skipped });
  } catch (err) {
    logger.error('Fehler beim Import der Dokumente:', { error: err });
    res.status(500).json({ error: 'Fehler beim Import', details: err.message });
  }
});

module.exports = router;
