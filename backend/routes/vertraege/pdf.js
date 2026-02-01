/**
 * Vertraege PDF Routes
 * PDF-Generierung für Verträge und Kündigungsbestätigungen
 */
const express = require('express');
const logger = require('../../utils/logger');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { generateCompleteVertragPDF } = require('../../services/vertragPdfGeneratorExtended');
const { generatePDFWithDefaultTemplate } = require('../../services/templatePdfGenerator');
const { generateKuendigungsbestaetigungPDF } = require('../../utils/kuendigungsbestaetigungPdfGenerator');
const { queryAsync, ensureDocumentsDir } = require('./shared');

// GET /:id/pdf - Vertrag als PDF herunterladen
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const vertragResults = await queryAsync(`
      SELECT v.*, m.vorname, m.nachname, m.email, m.geburtsdatum, m.strasse, m.hausnummer, m.plz, m.ort,
        m.telefon, m.anrede, m.mitgliedsnummer, m.iban, m.bic, m.bank, t.name as tarif_name
      FROM vertraege v
      LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE v.id = ?
    `, [id]);

    if (vertragResults.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden' });

    const vertrag = vertragResults[0];

    const dojoResults = await queryAsync(`SELECT * FROM dojo WHERE id = ?`, [vertrag.dojo_id]);
    if (dojoResults.length === 0) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    const dojo = dojoResults[0];

    const mitgliedData = {
      vorname: vertrag.vorname, nachname: vertrag.nachname, email: vertrag.email, geburtsdatum: vertrag.geburtsdatum,
      strasse: vertrag.strasse, hausnummer: vertrag.hausnummer, plz: vertrag.plz, ort: vertrag.ort,
      telefon: vertrag.telefon, anrede: vertrag.anrede, mitgliedsnummer: vertrag.mitgliedsnummer,
      iban: vertrag.iban, bic: vertrag.bic, bank: vertrag.bank
    };

    const vertragData = {
      vertragsnummer: vertrag.vertragsnummer, vertragsbeginn: vertrag.vertragsbeginn, vertragsende: vertrag.vertragsende,
      monatsbeitrag: vertrag.monatsbeitrag, billing_cycle: vertrag.billing_cycle, payment_method: vertrag.payment_method,
      mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate, kuendigungsfrist_monate: vertrag.kuendigungsfrist_monate,
      automatische_verlaengerung: vertrag.automatische_verlaengerung, verlaengerung_monate: vertrag.verlaengerung_monate,
      tarifname: vertrag.tarif_name, aufnahmegebuehr: vertrag.aufnahmegebuehr || 0
    };

    let pdfBuffer;
    try {
      pdfBuffer = await generatePDFWithDefaultTemplate(vertrag.dojo_id, 'vertrag', mitgliedData, vertragData);
    } catch (templateError) {
      pdfBuffer = await generateCompleteVertragPDF(vertrag.dojo_id, mitgliedData, vertragData);
    }

    const filename = `Vertrag_${vertrag.vertragsnummer || vertrag.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Fehler beim Generieren des PDFs:', { error: err });
    res.status(500).json({ error: 'Fehler beim Generieren des PDFs', details: err.message });
  }
});

// GET /:id/kuendigungsbestaetigung - Kündigungsbestätigung als PDF generieren
router.get('/:id/kuendigungsbestaetigung', async (req, res) => {
  try {
    const { id } = req.params;

    const vertragResults = await queryAsync(`
      SELECT v.*, m.vorname, m.nachname, m.email, m.geburtsdatum, m.strasse, m.hausnummer, m.plz, m.ort,
        m.telefon, m.anrede, m.mitgliedsnummer, t.name as tarif_name
      FROM vertraege v
      LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE v.id = ?
    `, [id]);

    if (vertragResults.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden' });

    const vertrag = vertragResults[0];

    const dojoResults = await queryAsync(`SELECT * FROM dojo WHERE id = ?`, [vertrag.dojo_id]);
    if (dojoResults.length === 0) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    const dojo = dojoResults[0];

    const mitgliedData = {
      vorname: vertrag.vorname, nachname: vertrag.nachname, anrede: vertrag.anrede, strasse: vertrag.strasse,
      hausnummer: vertrag.hausnummer, plz: vertrag.plz, ort: vertrag.ort, email: vertrag.email,
      telefon: vertrag.telefon, mitgliedsnummer: vertrag.mitgliedsnummer
    };

    const vertragData = {
      vertragsnummer: vertrag.vertragsnummer, vertragsbeginn: vertrag.vertragsbeginn, vertragsende: vertrag.vertragsende,
      kuendigung_eingegangen: vertrag.kuendigung_eingegangen, kuendigungsdatum: vertrag.kuendigungsdatum,
      kuendigungsgrund: vertrag.kuendigungsgrund, status: vertrag.status, mitgliedsnummer: vertrag.mitgliedsnummer
    };

    const dojoData = {
      dojoname: dojo.dojoname, inhaber: dojo.inhaber, strasse: dojo.strasse, hausnummer: dojo.hausnummer,
      plz: dojo.plz, ort: dojo.ort, telefon: dojo.telefon, email: dojo.email
    };

    const pdfBuffer = await generateKuendigungsbestaetigungPDF({ mitglied: mitgliedData, vertrag: vertragData, dojo: dojoData });

    const filename = `Kuendigungsbestaetigung_${vertrag.vertragsnummer || vertrag.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Fehler beim Generieren der Kuendigungsbestaetigung:', { error: err });
    res.status(500).json({ error: 'Fehler beim Generieren der Kuendigungsbestaetigung', details: err.message });
  }
});

// POST /:id/kuendigungsbestaetigung/speichern - Kündigungsbestätigung speichern und optional per E-Mail senden
router.post('/:id/kuendigungsbestaetigung/speichern', async (req, res) => {
  try {
    const { id } = req.params;
    const { send_email } = req.body;

    const vertragResults = await queryAsync(`
      SELECT v.*, m.vorname, m.nachname, m.email, m.geburtsdatum, m.strasse, m.hausnummer, m.plz, m.ort,
        m.telefon, m.anrede, m.mitgliedsnummer
      FROM vertraege v
      LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      WHERE v.id = ?
    `, [id]);

    if (vertragResults.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden' });

    const vertrag = vertragResults[0];

    const dojoResults = await queryAsync(`SELECT * FROM dojo WHERE id = ?`, [vertrag.dojo_id]);
    const dojo = dojoResults.length > 0 ? dojoResults[0] : {};

    const pdfBuffer = await generateKuendigungsbestaetigungPDF({
      mitglied: {
        vorname: vertrag.vorname, nachname: vertrag.nachname, anrede: vertrag.anrede, strasse: vertrag.strasse,
        hausnummer: vertrag.hausnummer, plz: vertrag.plz, ort: vertrag.ort, email: vertrag.email, mitgliedsnummer: vertrag.mitgliedsnummer
      },
      vertrag: {
        vertragsnummer: vertrag.vertragsnummer, vertragsbeginn: vertrag.vertragsbeginn, vertragsende: vertrag.vertragsende,
        kuendigung_eingegangen: vertrag.kuendigung_eingegangen, kuendigungsdatum: vertrag.kuendigungsdatum, kuendigungsgrund: vertrag.kuendigungsgrund
      },
      dojo: {
        dojoname: dojo.dojoname, inhaber: dojo.inhaber, strasse: dojo.strasse, hausnummer: dojo.hausnummer,
        plz: dojo.plz, ort: dojo.ort, telefon: dojo.telefon, email: dojo.email
      }
    });

    const docsDir = await ensureDocumentsDir();
    const timestamp = Date.now();
    const filename = `Kuendigungsbestaetigung_${vertrag.vertragsnummer || id}_${timestamp}.pdf`;
    const filepath = path.join(docsDir, filename);
    const relativePath = `generated_documents/${filename}`;

    await fs.writeFile(filepath, pdfBuffer);

    const dokumentname = `Kuendigungsbestaetigung ${vertrag.vertragsnummer || ''}`;
    const insertQuery = `
      INSERT INTO mitglied_dokumente (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
      VALUES (?, ?, NULL, ?, ?, NOW())
    `;

    const dokumentResult = await queryAsync(insertQuery, [vertrag.mitglied_id, vertrag.dojo_id, dokumentname, relativePath]);

    try {
      await queryAsync(`
        INSERT INTO vertragshistorie (vertrag_id, aenderung_typ, aenderung_beschreibung, geaendert_von)
        VALUES (?, 'kuendigung_bestaetigt', 'Kuendigungsbestaetigung wurde erstellt und gespeichert', 'System')
      `, [id]);
    } catch (histErr) {
      logger.warn('Fehler beim Erstellen des Historie-Eintrags:', { details: histErr.message });
    }

    let emailSent = false;
    if (send_email && vertrag.email) {
      try {
        logger.debug('E-Mail-Versand für Kündigungsbestätigung (noch nicht implementiert)');
      } catch (emailErr) {
        logger.error('Fehler beim E-Mail-Versand:', { error: emailErr });
      }
    }

    res.json({
      success: true,
      message: 'Kuendigungsbestaetigung erfolgreich erstellt',
      data: { dokument_id: dokumentResult.insertId, filename: filename, filepath: relativePath, email_sent: emailSent }
    });
  } catch (err) {
    logger.error('Fehler beim Speichern der Kuendigungsbestaetigung:', { error: err });
    res.status(500).json({ error: 'Fehler beim Speichern', details: err.message });
  }
});

module.exports = router;
