/**
 * SEPA Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält alle SEPA-Mandat Endpoints
 *
 * 🔒 SICHERHEIT: Alle Routes verwenden getSecureDojoId() für Multi-Tenancy Isolation
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const SepaPdfGenerator = require('../../utils/sepaPdfGenerator');
const { validateId, requireFields } = require('../../middleware/validation');
const { getSecureDojoId, isSuperAdmin } = require('../../middleware/tenantSecurity');
const router = express.Router();

// SEPA-Mandat abrufen
router.get('/:id/sepa-mandate', (req, res) => {
  const { id } = req.params;
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const userIsSuperAdmin = isSuperAdmin(req);

  let whereConditions = ['sm.mitglied_id = ?', "sm.status = 'aktiv'"];
  let queryParams = [id];

  if (userIsSuperAdmin && secureDojoId === null) {
    // Super-Admin ohne spezifisches Dojo: Nur zentral verwaltete Dojos
    whereConditions.push(`m.dojo_id NOT IN (
      SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
    )`);
  } else if (secureDojoId) {
    // Normaler Admin oder Super-Admin mit spezifischem Dojo
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const query = `
    SELECT sm.*
    FROM sepa_mandate sm
    JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY sm.erstellungsdatum DESC
    LIMIT 1
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des SEPA-Mandats:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen des SEPA-Mandats' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Kein aktives SEPA-Mandat gefunden oder keine Berechtigung' });
    }

    res.json(results[0]);
  });
});

// SEPA-Mandat erstellen
router.post('/:id/sepa-mandate',
  validateId('id'),
  requireFields(['iban', 'bic', 'kontoinhaber']),
  (req, res) => {
    const { id } = req.params;
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);
    let { iban, bic, kontoinhaber, bankname } = req.body;

    iban = iban.replace(/\s/g, '').toUpperCase();
    bic = bic.replace(/\s/g, '').toUpperCase();

    const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;
    if (!ibanRegex.test(iban)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Ungültiges IBAN-Format', code: 400 }
      });
    }

    let checkConditions = ['mitglied_id = ?'];
    let checkParams = [id];

    if (secureDojoId) {
      checkConditions.push('dojo_id = ?');
      checkParams.push(secureDojoId);
    }

    const checkQuery = `SELECT mitglied_id, dojo_id FROM mitglieder WHERE ${checkConditions.join(' AND ')}`;

    db.query(checkQuery, checkParams, (checkErr, checkResults) => {
      if (checkErr) {
        logger.error('Fehler bei Berechtigungsprüfung:', checkErr);
        return res.status(500).json({ error: 'Fehler bei Berechtigungsprüfung' });
      }

      if (checkResults.length === 0) {
        logger.error(`SICHERHEITSVERLETZUNG: Versuch SEPA-Mandat für fremdes Mitglied ${id} zu erstellen!`);
        return res.status(403).json({ error: 'Keine Berechtigung - Mitglied gehört nicht zum ausgewählten Dojo' });
      }

      const memberDojoId = checkResults[0].dojo_id;
      const dojoQuery = `SELECT id, sepa_glaeubiger_id FROM dojo WHERE id = ? LIMIT 1`;

      db.query(dojoQuery, [memberDojoId], (dojoErr, dojoResults) => {
        if (dojoErr) {
          logger.error('Fehler beim Abrufen der Dojo-Einstellungen:', dojoErr);
          return res.status(500).json({ error: 'Fehler beim Abrufen der Dojo-Einstellungen' });
        }

        const glaeubiger_id = (dojoResults.length > 0 && dojoResults[0].sepa_glaeubiger_id)
          ? dojoResults[0].sepa_glaeubiger_id
          : 'DE98ZZZ09999999999';

        const timestamp = Date.now();
        const mandatsreferenz = `DOJO${memberDojoId}-${id}-${timestamp}`;

        const query = `
          INSERT INTO sepa_mandate (
            mitglied_id, mandatsreferenz, glaeubiger_id,
            iban, bic, kontoinhaber, bankname
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(query, [id, mandatsreferenz, glaeubiger_id, iban, bic, kontoinhaber, bankname], (err, result) => {
          if (err) {
            logger.error('Fehler beim Erstellen des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Fehler beim Erstellen des SEPA-Mandats' });
          }

          const newMandate = {
            mandat_id: result.insertId,
            mitglied_id: id,
            dojo_id: memberDojoId,
            mandatsreferenz,
            glaeubiger_id,
            erstellungsdatum: new Date(),
            status: 'aktiv',
            iban, bic, kontoinhaber, bankname
          };

          const updateMemberQuery = `
            UPDATE mitglieder
            SET iban = ?, bic = ?, kontoinhaber = ?, bankname = ?, zahlungsmethode = 'SEPA-Lastschrift'
            WHERE mitglied_id = ? AND dojo_id = ?
          `;

          db.query(updateMemberQuery, [iban, bic, kontoinhaber, bankname, id, memberDojoId], () => {});

          res.status(201).json(newMandate);
        });
      });
    });
  });

// SEPA-Mandat widerrufen
router.delete('/:id/sepa-mandate', (req, res) => {
  const { id } = req.params;
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { grund } = req.body;

  let whereConditions = ['sm.mitglied_id = ?', "sm.status = 'aktiv'"];
  let queryParams = [grund || 'Widerrufen durch Benutzer', id];

  let joinClause = '';
  if (secureDojoId) {
    joinClause = 'JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id';
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const query = `
    UPDATE sepa_mandate sm
    ${joinClause}
    SET sm.status = 'widerrufen',
        sm.widerruf_datum = NOW(),
        sm.archiviert = 1,
        sm.archiviert_am = NOW(),
        sm.archiviert_grund = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, queryParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Archivieren des SEPA-Mandats:', err);
      return res.status(500).json({ error: 'Fehler beim Archivieren des SEPA-Mandats' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kein aktives SEPA-Mandat gefunden oder keine Berechtigung' });
    }

    res.json({ success: true, message: 'SEPA-Mandat wurde archiviert' });
  });
});

// Archivierte SEPA-Mandate abrufen
router.get('/:id/sepa-mandate/archiv', (req, res) => {
  const { id } = req.params;
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = ['sm.mitglied_id = ?', "(sm.archiviert = 1 OR sm.status = 'widerrufen')"];
  let queryParams = [id];

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const query = `
    SELECT sm.*, m.vorname, m.nachname, m.email, m.dojo_id
    FROM sepa_mandate sm
    JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY COALESCE(sm.archiviert_am, sm.widerruf_datum) DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen archivierter SEPA-Mandate:', err);
      return res.status(500).json({ error: 'Fehler beim Abrufen archivierter Mandate' });
    }

    res.json(results);
  });
});

// SEPA-Mandat als PDF herunterladen
router.get('/:id/sepa-mandate/download', async (req, res) => {
  const { id } = req.params;
  const { mandate_id } = req.query;
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  try {
    let query;
    let queryParams;
    let whereConditions = [];

    if (mandate_id) {
      whereConditions = ['sm.mandat_id = ?', 'sm.mitglied_id = ?'];
      queryParams = [mandate_id, id];

      if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
      }

      query = `
        SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
               d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
               d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        JOIN dojo d ON m.dojo_id = d.id
        WHERE ${whereConditions.join(' AND ')}
      `;
    } else {
      whereConditions = ['sm.mitglied_id = ?', "sm.status = 'aktiv'"];
      queryParams = [id];

      if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
      }

      query = `
        SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
               d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
               d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        JOIN dojo d ON m.dojo_id = d.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sm.erstellungsdatum DESC
        LIMIT 1
      `;
    }

    db.query(query, queryParams, async (err, results) => {
      if (err) {
        logger.error('Fehler beim Abrufen der Mandate-Daten:', err);
        return res.status(500).json({ error: 'Fehler beim Generieren des PDFs' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Kein aktives SEPA-Mandat gefunden' });
      }

      const mandate = results[0];

      try {
        const pdfGenerator = new SepaPdfGenerator();
        const pdfBuffer = await pdfGenerator.generateSepaMandatePDF(mandate);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="SEPA-Mandat_${mandate.nachname}_${mandate.vorname}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);
      } catch (pdfError) {
        logger.error('Fehler bei der PDF-Generierung:', pdfError);
        res.status(500).json({ error: 'Fehler bei der PDF-Generierung' });
      }
    });
  } catch (error) {
    logger.error('Allgemeiner Fehler beim PDF-Download:', error);
    res.status(500).json({ error: 'Fehler beim PDF-Download' });
  }
});

module.exports = router;
