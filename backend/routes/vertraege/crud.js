/**
 * Vertraege CRUD Routes
 * Hauptoperationen: Liste, Statistiken, Erstellen, Aktualisieren, Löschen
 */
const express = require('express');
const logger = require('../../utils/logger');
const router = express.Router();
const { generateCompleteVertragPDF } = require('../../services/vertragPdfGeneratorExtended');
const { sendVertragEmail } = require('../../services/emailService');
const {
  queryAsync,
  handleFamilyCancellation,
  savePdfToMitgliedDokumente,
  createSepaMandate,
  generateInitialBeitraege
} = require('./shared');

// GET / - Alle Verträge abrufen (inkl. gelöschte)
router.get('/', async (req, res) => {
  try {
    const { dojo_id, mitglied_id } = req.query;
    let whereConditions = [];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('v.dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }

    if (mitglied_id) {
      whereConditions.push('v.mitglied_id = ?');
      queryParams.push(parseInt(mitglied_id));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const vertraege = await queryAsync(`
      SELECT v.*, m.vorname, m.nachname, m.email, t.name as tarif_name, t.price_cents,
        COALESCE(v.monatsbeitrag, t.price_cents / 100) as monatsbeitrag, FALSE as geloescht
      FROM vertraege v
      LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      LEFT JOIN tarife t ON v.tarif_id = t.id
      ${whereClause}
    `, queryParams);

    let geloeschteVertraege = [];
    if (mitglied_id) {
      const whereConditionsArchive = ['vg.mitglied_id = ?'];
      const queryParamsArchive = [parseInt(mitglied_id)];

      if (dojo_id && dojo_id !== 'all') {
        whereConditionsArchive.push('vg.dojo_id = ?');
        queryParamsArchive.push(parseInt(dojo_id));
      }

      geloeschteVertraege = await queryAsync(`
        SELECT vg.*, m.vorname, m.nachname, m.email, t.name as tarif_name, t.price_cents,
          COALESCE(vg.monatsbeitrag, t.price_cents / 100) as monatsbeitrag, TRUE as geloescht
        FROM vertraege_geloescht vg
        LEFT JOIN mitglieder m ON vg.mitglied_id = m.mitglied_id
        LEFT JOIN tarife t ON vg.tarif_id = t.id
        WHERE ${whereConditionsArchive.join(' AND ')}
      `, queryParamsArchive);
    }

    const alleVertraege = [...vertraege, ...geloeschteVertraege].sort((a, b) => b.id - a.id);
    res.json({ success: true, data: alleVertraege });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Verträge:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// GET /stats - Statistiken für Beitragsverwaltung
router.get('/stats', async (req, res) => {
  try {
    const { dojo_id } = req.query;
    let whereConditions = ['status = ?'];
    let queryParams = ['aktiv'];

    if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const aktiveVertraege = await queryAsync(`
      SELECT COUNT(*) as count FROM vertraege ${whereClause}
    `, queryParams);

    const stats = {
      aktiveVertraege: aktiveVertraege[0].count,
      gesamteinnahmen: 0,
      monatlicheEinnahmen: 0
    };
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('Fehler beim Berechnen der Vertrags-Statistiken:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST / - Neuen Vertrag erstellen
router.post('/', async (req, res) => {
  try {
    const {
      mitglied_id, status, dojo_id, tarif_id, vertragsbeginn, vertragsende, billing_cycle, payment_method,
      monatsbeitrag, aufnahmegebuehr_cents, vertragsnummer, kuendigungsfrist_monate, mindestlaufzeit_monate,
      automatische_verlaengerung, verlaengerung_monate, faelligkeit_tag, rabatt_prozent, rabatt_grund, sepa_mandat_id,
      agb_version, agb_akzeptiert_am, datenschutz_version, datenschutz_akzeptiert_am, widerruf_akzeptiert_am,
      hausordnung_akzeptiert_am, gesundheitserklaerung, gesundheitserklaerung_datum, haftungsausschluss_akzeptiert,
      haftungsausschluss_datum, foto_einverstaendnis, foto_einverstaendnis_datum, unterschrift_datum,
      unterschrift_digital, unterschrift_ip, vertragstext_pdf_path, created_by
    } = req.body;

    if (!mitglied_id) return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
    if (!dojo_id) {
      return res.status(400).json({ error: "dojo_id ist erforderlich - jeder Vertrag MUSS einem Dojo zugeordnet sein", required: ['mitglied_id', 'dojo_id'] });
    }

    const memberCheck = await queryAsync(`SELECT mitglied_id, dojo_id FROM mitglieder WHERE mitglied_id = ?`, [mitglied_id]);
    if (memberCheck.length === 0) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    if (memberCheck[0].dojo_id !== parseInt(dojo_id)) {
      return res.status(403).json({ error: 'Keine Berechtigung - Mitglied gehört zu anderem Dojo' });
    }

    const fields = ['mitglied_id', 'status', 'dojo_id'];
    const values = [mitglied_id, status || 'aktiv', parseInt(dojo_id)];

    if (tarif_id !== undefined && tarif_id !== null && tarif_id !== '') { fields.push('tarif_id'); values.push(parseInt(tarif_id)); }
    if (vertragsbeginn) { fields.push('vertragsbeginn'); values.push(vertragsbeginn); }
    if (vertragsende) { fields.push('vertragsende'); values.push(vertragsende); }
    if (billing_cycle) { fields.push('billing_cycle'); values.push(billing_cycle); }
    if (payment_method) { fields.push('payment_method'); values.push(payment_method); }
    if (monatsbeitrag !== undefined) { fields.push('monatsbeitrag'); values.push(monatsbeitrag); }
    if (aufnahmegebuehr_cents !== undefined) { fields.push('aufnahmegebuehr_cents'); values.push(aufnahmegebuehr_cents); }
    if (vertragsnummer) { fields.push('vertragsnummer'); values.push(vertragsnummer); }
    if (kuendigungsfrist_monate !== undefined) { fields.push('kuendigungsfrist_monate'); values.push(kuendigungsfrist_monate); }
    if (mindestlaufzeit_monate !== undefined) { fields.push('mindestlaufzeit_monate'); values.push(mindestlaufzeit_monate); }
    if (automatische_verlaengerung !== undefined) { fields.push('automatische_verlaengerung'); values.push(automatische_verlaengerung); }
    if (verlaengerung_monate !== undefined) { fields.push('verlaengerung_monate'); values.push(verlaengerung_monate); }
    if (faelligkeit_tag !== undefined) { fields.push('faelligkeit_tag'); values.push(faelligkeit_tag); }
    if (rabatt_prozent !== undefined) { fields.push('rabatt_prozent'); values.push(rabatt_prozent); }
    if (rabatt_grund) { fields.push('rabatt_grund'); values.push(rabatt_grund); }
    if (sepa_mandat_id) { fields.push('sepa_mandat_id'); values.push(sepa_mandat_id); }
    if (agb_version) { fields.push('agb_version'); values.push(agb_version); }
    if (agb_akzeptiert_am) { fields.push('agb_akzeptiert_am'); values.push(agb_akzeptiert_am); }
    if (datenschutz_version) { fields.push('datenschutz_version'); values.push(datenschutz_version); }
    if (datenschutz_akzeptiert_am) { fields.push('datenschutz_akzeptiert_am'); values.push(datenschutz_akzeptiert_am); }
    if (widerruf_akzeptiert_am) { fields.push('widerruf_akzeptiert_am'); values.push(widerruf_akzeptiert_am); }
    if (hausordnung_akzeptiert_am) { fields.push('hausordnung_akzeptiert_am'); values.push(hausordnung_akzeptiert_am); }
    if (gesundheitserklaerung !== undefined) { fields.push('gesundheitserklaerung'); values.push(gesundheitserklaerung); }
    if (gesundheitserklaerung_datum) { fields.push('gesundheitserklaerung_datum'); values.push(gesundheitserklaerung_datum); }
    if (haftungsausschluss_akzeptiert !== undefined) { fields.push('haftungsausschluss_akzeptiert'); values.push(haftungsausschluss_akzeptiert); }
    if (haftungsausschluss_datum) { fields.push('haftungsausschluss_datum'); values.push(haftungsausschluss_datum); }
    if (foto_einverstaendnis !== undefined) { fields.push('foto_einverstaendnis'); values.push(foto_einverstaendnis); }
    if (foto_einverstaendnis_datum) { fields.push('foto_einverstaendnis_datum'); values.push(foto_einverstaendnis_datum); }
    if (unterschrift_datum) { fields.push('unterschrift_datum'); values.push(unterschrift_datum); }
    if (unterschrift_digital) { fields.push('unterschrift_digital'); values.push(unterschrift_digital); }
    if (unterschrift_ip) { fields.push('unterschrift_ip'); values.push(unterschrift_ip); }
    if (vertragstext_pdf_path) { fields.push('vertragstext_pdf_path'); values.push(vertragstext_pdf_path); }
    if (created_by) { fields.push('created_by'); values.push(created_by); }

    const placeholders = fields.map(() => '?').join(', ');
    const query = `INSERT INTO vertraege (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await queryAsync(query, values);

    let generatedVertragsnummer = null;
    if (result.insertId && !vertragsnummer) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const vertragId = String(result.insertId).padStart(5, '0');
      const mitgliedIdFormatted = String(mitglied_id).padStart(4, '0');
      generatedVertragsnummer = `VTR-${year}${month}-M${mitgliedIdFormatted}-${vertragId}`;
      await queryAsync(`UPDATE vertraege SET vertragsnummer = ? WHERE id = ?`, [generatedVertragsnummer, result.insertId]);
    }

    if (result.insertId) {
      try {
        await queryAsync(`
          INSERT INTO vertragshistorie (vertrag_id, aenderung_typ, aenderung_beschreibung, geaendert_von, ip_adresse)
          VALUES (?, 'erstellt', 'Vertrag wurde erstellt', ?, ?)
        `, [result.insertId, created_by || null, unterschrift_ip || null]);
      } catch (histErr) {
        logger.warn('Fehler beim Erstellen des Historie-Eintrags:', { details: histErr.message });
      }
    }

    let pdfGenerated = false, emailSent = false, pdfSaved = false, dokumentId = null;
    let sepaMandatCreated = false, sepaMandatId = null, sepaMandatsreferenz = null;

    if (result.insertId) {
      try {
        const mitgliedResults = await queryAsync(`SELECT * FROM mitglieder WHERE mitglied_id = ?`, [mitglied_id]);
        if (mitgliedResults.length === 0) throw new Error('Mitgliedsdaten nicht gefunden');
        const mitgliedData = mitgliedResults[0];

        const dojoResults = await queryAsync(`SELECT * FROM dojo WHERE id = ?`, [dojo_id]);
        if (dojoResults.length === 0) throw new Error('Dojo-Daten nicht gefunden');
        const dojoData = dojoResults[0];

        const vertragData = {
          vertragsnummer: generatedVertragsnummer || vertragsnummer || `VTR-${result.insertId}`,
          vertragsbeginn: vertragsbeginn || new Date().toISOString().split('T')[0],
          monatsbeitrag: monatsbeitrag || 0,
          billing_cycle: billing_cycle || 'monatlich',
          payment_method: payment_method || 'sepa',
          mindestlaufzeit_monate: mindestlaufzeit_monate || 12,
          kuendigungsfrist_monate: kuendigungsfrist_monate || 3,
          automatische_verlaengerung: automatische_verlaengerung !== undefined ? automatische_verlaengerung : true,
          verlaengerung_monate: verlaengerung_monate || 12
        };

        const pdfBuffer = await generateCompleteVertragPDF(dojo_id, mitgliedData, vertragData);
        pdfGenerated = true;

        try {
          const saveResult = await savePdfToMitgliedDokumente(pdfBuffer, mitglied_id, dojo_id, vertragData.vertragsnummer, null);
          pdfSaved = saveResult.success;
          dokumentId = saveResult.dokumentId;
        } catch (saveError) {
          logger.error('Fehler beim Speichern des Vertragsdokuments:', { error: saveError.message });
        }

        if (mitgliedData.email) {
          const emailResult = await sendVertragEmail({
            email: mitgliedData.email,
            vorname: mitgliedData.vorname || '',
            nachname: mitgliedData.nachname || '',
            vertragsnummer: vertragData.vertragsnummer,
            pdfBuffer: pdfBuffer,
            dojoname: dojoData.name || 'Dojo'
          });
          if (emailResult.success) emailSent = true;
        }

        try {
          const sepaResult = await createSepaMandate(mitgliedData, dojoData, dojo_id);
          if (sepaResult.success) {
            sepaMandatCreated = true;
            sepaMandatId = sepaResult.mandatId;
            sepaMandatsreferenz = sepaResult.mandatsreferenz;
            await queryAsync(`UPDATE vertraege SET sepa_mandat_id = ? WHERE id = ?`, [sepaMandatId, result.insertId]);
          }
        } catch (sepaError) {
          logger.error('Fehler beim Erstellen des SEPA-Mandats:', { error: sepaError.message });
        }

        // Initiale Beiträge generieren (anteiliger erster Monat + voller zweiter Monat + Aufnahmegebühr)
        try {
          const beitragAmount = monatsbeitrag || (tarif_id ? (await queryAsync('SELECT price_cents FROM tarife WHERE id = ?', [tarif_id]))[0]?.price_cents / 100 : 0);
          const aufnahmegebuehr = aufnahmegebuehr_cents || (tarif_id ? (await queryAsync('SELECT aufnahmegebuehr_cents FROM tarife WHERE id = ?', [tarif_id]))[0]?.aufnahmegebuehr_cents : 0);

          if (beitragAmount > 0) {
            const beitraegeResult = await generateInitialBeitraege(
              mitglied_id,
              dojo_id,
              vertragsbeginn || new Date().toISOString().split('T')[0],
              beitragAmount,
              aufnahmegebuehr || 0
            );
            logger.info('Initiale Beiträge für Vertrag erstellt:', { vertrag_id: result.insertId, beitraege: beitraegeResult.beitraege?.length || 0 });
          }
        } catch (beitraegeError) {
          logger.error('Fehler beim Erstellen der initialen Beiträge:', { error: beitraegeError.message });
        }
      } catch (pdfError) {
        logger.error('Fehler bei PDF-Generierung oder E-Mail-Versand:', { error: pdfError });
      }
    }

    res.json({
      success: true,
      data: {
        id: result.insertId,
        mitglied_id,
        dojo_id: parseInt(dojo_id),
        status: status || 'aktiv',
        vertragsnummer: generatedVertragsnummer || vertragsnummer,
        fields_saved: fields.length,
        pdf_generated: pdfGenerated,
        pdf_saved: pdfSaved,
        dokument_id: dokumentId,
        email_sent: emailSent,
        sepa_mandat_created: sepaMandatCreated,
        sepa_mandat_id: sepaMandatId,
        sepa_mandatsreferenz: sepaMandatsreferenz
      }
    });
  } catch (err) {
    logger.error('Fehler beim Erstellen des Vertrags:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message, sqlError: err.sqlMessage, code: err.code });
  }
});

// PUT /:id - Vertrag aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dojo_id, kuendigung_eingegangen, kuendigungsgrund, kuendigungsdatum, ruhepause_von, ruhepause_bis, ruhepause_dauer_monate } = req.body;

    let updateFields = [];
    let queryParams = [];

    if (status !== undefined) { updateFields.push('status = ?'); queryParams.push(status); }
    if (kuendigung_eingegangen !== undefined) { updateFields.push('kuendigung_eingegangen = ?'); queryParams.push(kuendigung_eingegangen); }
    if (kuendigungsgrund !== undefined) { updateFields.push('kuendigungsgrund = ?'); queryParams.push(kuendigungsgrund); }
    if (kuendigungsdatum !== undefined) { updateFields.push('kuendigungsdatum = ?'); queryParams.push(kuendigungsdatum); }
    if (ruhepause_von !== undefined) { updateFields.push('ruhepause_von = ?'); queryParams.push(ruhepause_von); }
    if (ruhepause_bis !== undefined) { updateFields.push('ruhepause_bis = ?'); queryParams.push(ruhepause_bis); }
    if (ruhepause_dauer_monate !== undefined) { updateFields.push('ruhepause_dauer_monate = ?'); queryParams.push(ruhepause_dauer_monate); }

    if (updateFields.length === 0) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });

    let whereConditions = ['id = ?'];
    queryParams.push(id);

    if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }

    const result = await queryAsync(`UPDATE vertraege SET ${updateFields.join(', ')} WHERE ${whereConditions.join(' AND ')}`, queryParams);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden oder keine Berechtigung' });

    let familyResult = null;
    if (status === 'gekuendigt' || status === 'inaktiv' || status === 'beendet') {
      try {
        const vertrag = await queryAsync('SELECT mitglied_id FROM vertraege WHERE id = ?', [id]);
        if (vertrag.length > 0) {
          familyResult = await handleFamilyCancellation(vertrag[0].mitglied_id);
        }
      } catch (familyErr) {
        logger.error('Fehler bei Familien-Kündigungs-Verarbeitung:', { error: familyErr });
      }
    }

    res.json({ success: true, message: 'Vertrag erfolgreich aktualisiert', familyUpdate: familyResult });
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Vertrags:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// DELETE /:id - Vertrag archivieren
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dojo_id, geloescht_von, geloescht_grund } = req.body;

    let whereConditions = ['id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }

    const vertrag = await queryAsync(`SELECT * FROM vertraege WHERE ${whereConditions.join(' AND ')}`, queryParams);
    if (vertrag.length === 0) return res.status(404).json({ error: 'Vertrag nicht gefunden oder keine Berechtigung' });

    const vertragData = vertrag[0];

    await queryAsync(`
      INSERT INTO vertraege_geloescht (
        id, mitglied_id, dojo_id, tarif_id, status, vertragsbeginn, vertragsende, billing_cycle, payment_method,
        monatsbeitrag, kuendigung_eingegangen, kuendigungsgrund, kuendigungsdatum, ruhepause_von, ruhepause_bis,
        ruhepause_dauer_monate, agb_akzeptiert_am, datenschutz_akzeptiert_am, hausordnung_akzeptiert_am,
        unterschrift_datum, unterschrift_ip, created_at, updated_at, geloescht_von, geloescht_grund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vertragData.id, vertragData.mitglied_id, vertragData.dojo_id, vertragData.tarif_id, vertragData.status,
      vertragData.vertragsbeginn, vertragData.vertragsende, vertragData.billing_cycle, vertragData.payment_method,
      vertragData.monatsbeitrag, vertragData.kuendigung_eingegangen, vertragData.kuendigungsgrund, vertragData.kuendigungsdatum,
      vertragData.ruhepause_von, vertragData.ruhepause_bis, vertragData.ruhepause_dauer_monate,
      vertragData.agb_akzeptiert_am, vertragData.datenschutz_akzeptiert_am, vertragData.hausordnung_akzeptiert_am,
      vertragData.unterschrift_datum, vertragData.unterschrift_ip, vertragData.created_at, vertragData.updated_at,
      geloescht_von || 'Admin', geloescht_grund || 'Kein Grund angegeben'
    ]);

    await queryAsync(`DELETE FROM vertraege WHERE ${whereConditions.join(' AND ')}`, queryParams);

    let familyResult = null;
    try {
      familyResult = await handleFamilyCancellation(vertragData.mitglied_id);
    } catch (familyErr) {
      logger.error('Fehler bei Familien-Archivierungs-Verarbeitung:', { error: familyErr });
    }

    res.json({ success: true, message: 'Vertrag erfolgreich archiviert', familyUpdate: familyResult });
  } catch (err) {
    logger.error('Fehler beim Archivieren des Vertrags:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

module.exports = router;
