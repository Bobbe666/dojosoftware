/**
 * Admin SEPA Routes
 * SEPA Lastschrift Management für TDA
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');
const { sendPaymentReminderEmail } = require('../../services/emailTemplates');

// SEPA Return Reason Codes
const SEPA_RETURN_CODES = {
  'AC01': 'IBAN ungültig',
  'AC04': 'Konto geschlossen',
  'AC06': 'Konto gesperrt',
  'AC13': 'Kontoart ungültig (kein Zahlungskonto)',
  'AG01': 'Transaktion nicht erlaubt',
  'AG02': 'Ungültiger Bankcode',
  'AM04': 'Deckung nicht ausreichend',
  'AM05': 'Doppelte Einreichung',
  'BE04': 'Gläubiger-Adresse fehlt',
  'BE05': 'Kreditgeber-ID ungültig',
  'CNOR': 'Gläubiger-Bank nicht erreichbar',
  'DNOR': 'Schuldner-Bank nicht erreichbar',
  'FF01': 'Dateiformat ungültig',
  'MD01': 'Kein gültiges Mandat',
  'MD02': 'Mandat-Daten ungültig',
  'MD06': 'Rückgabe durch Zahler (Widerspruch)',
  'MD07': 'Schuldner verstorben',
  'MS02': 'Unbekannter Grund vom Kunden',
  'MS03': 'Unbekannter Grund',
  'RC01': 'BIC ungültig',
  'RR01': 'Regulatorische Gründe (fehlende Doku)',
  'RR02': 'Regulatorische Gründe (Name/Adresse)',
  'RR03': 'Regulatorische Gründe (sonstige)',
  'RR04': 'Regulatorische Gründe',
  'SL01': 'Spezifischer Dienst der Schuldner-Bank',
  'TM01': 'Timeout bei Empfängerbank',
  'FOCR': 'Rückgabe nach Stornierungsanfrage',
  'DUPL': 'Doppelte Zahlung',
  'TECH': 'Technischer Fehler',
  'FRAD': 'Betrugsverdacht'
};

// GET /sepa/mandate - Alle SEPA-Mandate (aus verbandsmitgliedschaften)
router.get('/sepa/mandate', requireSuperAdmin, async (req, res) => {
  try {
    // Query verbandsmitgliedschaften with SEPA data (for Dojo subscriptions to TDA)
    const [mandate] = await db.promise().query(`
      SELECT
        vm.id,
        vm.dojo_id,
        vm.dojo_name as dojoname,
        vm.sepa_kontoinhaber as kontoinhaber,
        vm.sepa_iban as iban,
        vm.sepa_bic as bic,
        vm.sepa_mandatsreferenz as mandats_referenz,
        vm.sepa_mandatsdatum as mandats_datum,
        vm.jahresbeitrag as monthly_price,
        vm.status,
        vm.zahlungsart,
        'RCUR' as sequenz_typ,
        vm.created_at,
        vm.updated_at,
        d.dojoname as dojo_dojoname
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.typ = 'dojo'
        AND vm.zahlungsart = 'lastschrift'
        AND vm.sepa_mandatsreferenz IS NOT NULL
        AND vm.sepa_iban IS NOT NULL
      ORDER BY vm.created_at DESC
    `);

    // Map to expected format
    const formattedMandate = mandate.map(m => ({
      ...m,
      dojoname: m.dojo_dojoname || m.dojoname,
      status: m.status === 'aktiv' ? 'aktiv' : m.status
    }));

    res.json({ success: true, mandate: formattedMandate });
  } catch (error) {
    logger.error('Fehler beim Laden der Mandate:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Mandate' });
  }
});

// POST /sepa/mandate - Neues SEPA-Mandat (updates verbandsmitgliedschaft)
router.post('/sepa/mandate', requireSuperAdmin, async (req, res) => {
  try {
    const { dojo_id, kontoinhaber, iban, bic, mandats_datum } = req.body;
    const mandats_referenz = `TDA-DOJO${dojo_id}-${Date.now()}`;

    // Update the verbandsmitgliedschaft with SEPA data
    const [result] = await db.promise().query(`
      UPDATE verbandsmitgliedschaften
      SET zahlungsart = 'lastschrift',
          sepa_kontoinhaber = ?,
          sepa_iban = ?,
          sepa_bic = ?,
          sepa_mandatsreferenz = ?,
          sepa_mandatsdatum = ?
      WHERE dojo_id = ? AND typ = 'dojo'
    `, [kontoinhaber, iban.replace(/\s/g, ''), bic, mandats_referenz, mandats_datum, dojo_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Keine Verbandsmitgliedschaft für dieses Dojo gefunden' });
    }

    res.json({ success: true, mandats_referenz });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Mandats:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Mandats' });
  }
});

// PUT /sepa/mandate/:id (updates verbandsmitgliedschaft)
router.put('/sepa/mandate/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    // If status is 'widerrufen' or similar, clear SEPA data
    if (status === 'widerrufen' || status === 'inaktiv') {
      await db.promise().query(`
        UPDATE verbandsmitgliedschaften
        SET zahlungsart = 'rechnung'
        WHERE id = ?
      `, [req.params.id]);
    } else {
      await db.promise().query('UPDATE verbandsmitgliedschaften SET status = ? WHERE id = ?', [status, req.params.id]);
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// GET /sepa/batches
router.get('/sepa/batches', requireSuperAdmin, async (req, res) => {
  try {
    const [batches] = await db.promise().query('SELECT * FROM sepa_batches ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, batches });
  } catch (error) {
    logger.error('Fehler beim Laden der Batches:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /sepa/batch/create - Neuen Batch erstellen (from verbandsmitgliedschaften)
router.post('/sepa/batch/create', requireSuperAdmin, async (req, res) => {
  try {
    const { ausfuehrungsdatum, dojo_ids } = req.body;

    const [tdaBank] = await db.promise().query('SELECT * FROM dojo_banken WHERE dojo_id = 2 AND ist_standard = 1');
    if (!tdaBank.length || !tdaBank[0].sepa_glaeubiger_id) {
      return res.status(400).json({ error: 'TDA Bankdaten oder Gläubiger-ID nicht konfiguriert' });
    }

    let mandateQuery = `
      SELECT
        vm.id,
        vm.dojo_id,
        vm.dojo_name as dojoname,
        vm.sepa_kontoinhaber as kontoinhaber,
        vm.sepa_iban as iban,
        vm.sepa_bic as bic,
        vm.sepa_mandatsreferenz as mandats_referenz,
        vm.sepa_mandatsdatum as mandats_datum,
        vm.jahresbeitrag as monthly_price,
        'TDA Mitgliedschaft' as plan_type
      FROM verbandsmitgliedschaften vm
      WHERE vm.typ = 'dojo'
        AND vm.status = 'aktiv'
        AND vm.zahlungsart = 'lastschrift'
        AND vm.sepa_mandatsreferenz IS NOT NULL
        AND vm.sepa_iban IS NOT NULL
        AND vm.jahresbeitrag > 0
    `;

    let mandateParams = [];
    if (dojo_ids && dojo_ids.length > 0) {
      mandateQuery += ` AND vm.dojo_id IN (${dojo_ids.map(() => '?').join(',')})`;
      mandateParams = dojo_ids;
    }

    const [mandate] = await db.promise().query(mandateQuery, mandateParams);
    if (!mandate.length) return res.status(400).json({ error: 'Keine aktiven Mandate gefunden' });

    const batchRef = `TDA-BATCH-${Date.now()}`;
    const gesamtbetrag = mandate.reduce((sum, m) => sum + parseFloat(m.monthly_price), 0);

    const [batchResult] = await db.promise().query(`
      INSERT INTO sepa_batches (batch_referenz, erstelldatum, ausfuehrungsdatum, anzahl_transaktionen, gesamtbetrag, status)
      VALUES (?, NOW(), ?, ?, ?, 'erstellt')
    `, [batchRef, ausfuehrungsdatum, mandate.length, gesamtbetrag]);

    const batchId = batchResult.insertId;

    for (const mandat of mandate) {
      const endToEndId = `TDA-${mandat.dojo_id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const verwendungszweck = `TDA Mitgliedschaft - ${new Date(ausfuehrungsdatum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;

      await db.promise().query(`
        INSERT INTO sepa_transaktionen (batch_id, mandat_id, dojo_id, betrag, verwendungszweck, end_to_end_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'geplant')
      `, [batchId, mandat.id, mandat.dojo_id, mandat.monthly_price, verwendungszweck, endToEndId]);
    }

    res.json({ success: true, batch_id: batchId, batch_referenz: batchRef, anzahl: mandate.length, gesamtbetrag });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Batches:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Batches' });
  }
});

// GET /sepa/batch/:id/xml - SEPA XML generieren
router.get('/sepa/batch/:id/xml', requireSuperAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;

    const [batches] = await db.promise().query('SELECT * FROM sepa_batches WHERE id = ?', [batchId]);
    if (!batches.length) return res.status(404).json({ error: 'Batch nicht gefunden' });
    const batch = batches[0];

    const [tdaBank] = await db.promise().query('SELECT * FROM dojo_banken WHERE dojo_id = 2 AND ist_standard = 1');
    const bank = tdaBank[0];

    // Query from verbandsmitgliedschaften via sepa_transaktionen
    const [transaktionen] = await db.promise().query(`
      SELECT t.*,
        vm.sepa_mandatsreferenz as mandats_referenz,
        vm.sepa_mandatsdatum as mandats_datum,
        vm.sepa_kontoinhaber as kontoinhaber,
        vm.sepa_iban as iban,
        vm.sepa_bic as bic,
        'RCUR' as sequenz_typ,
        COALESCE(d.dojoname, vm.dojo_name) as dojoname
      FROM sepa_transaktionen t
      LEFT JOIN verbandsmitgliedschaften vm ON t.mandat_id = vm.id
      LEFT JOIN dojo d ON t.dojo_id = d.id
      WHERE t.batch_id = ?
    `, [batchId]);

    const creationDateTime = new Date().toISOString();
    const msgId = batch.batch_referenz;

    let xml = `<?xml version=1.0 encoding=UTF-8?>
<Document xmlns=urn:iso:std:iso:20022:tech:xsd:pain.008.001.02>
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${transaktionen.length}</NbOfTxs>
      <CtrlSum>${batch.gesamtbetrag.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${bank.kontoinhaber}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${transaktionen.length}</NbOfTxs>
      <CtrlSum>${batch.gesamtbetrag.toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>${batch.ausfuehrungsdatum}</ReqdColltnDt>
      <Cdtr><Nm>${bank.kontoinhaber}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${bank.iban}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${bank.bic}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId><Id><PrvtId><Othr><Id>${bank.sepa_glaeubiger_id}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>`;

    for (const tx of transaktionen) {
      xml += `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${tx.end_to_end_id}</EndToEndId></PmtId>
        <InstdAmt Ccy=EUR>${parseFloat(tx.betrag).toFixed(2)}</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>${tx.mandats_referenz}</MndtId><DtOfSgntr>${tx.mandats_datum}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>${tx.bic || 'NOTPROVIDED'}</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${tx.kontoinhaber}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${tx.iban}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${tx.verwendungszweck}</Ustrd></RmtInf>
      </DrctDbtTxInf>`;
    }

    xml += `
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    await db.promise().query('UPDATE sepa_batches SET xml_datei = ?, status = ? WHERE id = ?', [xml, 'exportiert', batchId]);

    // Update letzte_lastschrift in verbandsmitgliedschaften
    const mandatIds = transaktionen.map(t => t.mandat_id).filter(id => id);
    if (mandatIds.length > 0) {
      await db.promise().query(`
        UPDATE verbandsmitgliedschaften
        SET updated_at = NOW()
        WHERE id IN (${mandatIds.join(',')})
      `);
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=SEPA-Lastschrift-${batch.batch_referenz}.xml`);
    res.send(xml);
  } catch (error) {
    logger.error('Fehler beim Generieren der XML:', error);
    res.status(500).json({ error: 'Fehler beim Generieren der SEPA-XML' });
  }
});

// GET /sepa/dojos-without-mandate (dojos without SEPA in verbandsmitgliedschaften)
router.get('/sepa/dojos-without-mandate', requireSuperAdmin, async (req, res) => {
  try {
    // Find Dojo verbandsmitgliedschaften that are active but don't have SEPA mandate
    const [dojos] = await db.promise().query(`
      SELECT
        vm.id,
        vm.dojo_id,
        vm.dojo_name as dojoname,
        vm.jahresbeitrag as monthly_price,
        vm.status as subscription_status,
        vm.zahlungsart,
        d.dojoname as dojo_dojoname
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.typ = 'dojo'
        AND vm.status = 'aktiv'
        AND (vm.sepa_mandatsreferenz IS NULL OR vm.sepa_iban IS NULL OR vm.zahlungsart != 'lastschrift')
        AND vm.dojo_id != 2
    `);

    // Map to expected format
    const formattedDojos = dojos.map(d => ({
      id: d.dojo_id || d.id,
      dojoname: d.dojo_dojoname || d.dojoname,
      monthly_price: d.monthly_price,
      subscription_status: d.subscription_status,
      zahlungsart: d.zahlungsart
    }));

    res.json({ success: true, dojos: formattedDojos });
  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// GET /sepa/ruecklastschriften
router.get('/sepa/ruecklastschriften', requireSuperAdmin, async (req, res) => {
  try {
    const [returns] = await db.promise().query(`
      SELECT r.*, d.dojoname, vm.sepa_kontoinhaber as kontoinhaber
      FROM sepa_ruecklastschriften r
      LEFT JOIN dojo d ON r.dojo_id = d.id
      LEFT JOIN verbandsmitgliedschaften vm ON r.mandat_id = vm.id
      ORDER BY r.importiert_am DESC LIMIT 100
    `);
    res.json({ success: true, ruecklastschriften: returns, codes: SEPA_RETURN_CODES });
  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /sepa/ruecklastschriften/upload
router.post('/sepa/ruecklastschriften/upload', requireSuperAdmin, async (req, res) => {
  try {
    const { content, filename, format } = req.body;
    let parsedReturns = [];

    if (format === 'camt054' || filename.endsWith('.xml')) {
      parsedReturns = parseCamt054(content);
    } else if (format === 'csv' || filename.endsWith('.csv')) {
      parsedReturns = parseCsvReturns(content);
    } else {
      return res.status(400).json({ error: 'Unbekanntes Dateiformat' });
    }

    if (parsedReturns.length === 0) {
      return res.status(400).json({ error: 'Keine Rücklastschriften gefunden' });
    }

    let inserted = 0;
    for (const ret of parsedReturns) {
      let transaktionId = null, mandatId = null, dojoId = null, mitgliedId = null;

      if (ret.end_to_end_id) {
        const [txRows] = await db.promise().query(`
          SELECT t.id, t.mandat_id, t.dojo_id, t.betrag, m.mitglied_id
          FROM sepa_transaktionen t
          LEFT JOIN sepa_mandate sm ON t.mandat_id = sm.id
          LEFT JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
          WHERE t.end_to_end_id = ?
        `, [ret.end_to_end_id]);

        if (txRows.length > 0) {
          transaktionId = txRows[0].id;
          mandatId = txRows[0].mandat_id;
          dojoId = txRows[0].dojo_id;
          mitgliedId = txRows[0].mitglied_id;
          await db.promise().query('UPDATE sepa_transaktionen SET status = ?, fehler_code = ? WHERE id = ?', ['fehlgeschlagen', ret.rueckgabe_code, transaktionId]);
        }
      }

      // Rücklastschrift in Tabelle speichern
      const [insertResult] = await db.promise().query(`
        INSERT INTO sepa_ruecklastschriften (transaktion_id, mandat_id, dojo_id, end_to_end_id, mandats_referenz,
          original_betrag, ruecklastschrift_betrag, rueckgabe_code, rueckgabe_grund, rueckgabe_datum, import_datei)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [transaktionId, mandatId, dojoId, ret.end_to_end_id, ret.mandats_referenz,
            ret.betrag, ret.betrag, ret.rueckgabe_code,
            SEPA_RETURN_CODES[ret.rueckgabe_code] || ret.rueckgabe_grund || 'Unbekannt',
            ret.rueckgabe_datum || new Date(), filename]);

      inserted++;

      // ============================================================================
      // NEU: Automatisch offene Zahlung erstellen
      // ============================================================================
      if (mitgliedId && dojoId) {
        const beschreibung = `SEPA Rücklastschrift: ${SEPA_RETURN_CODES[ret.rueckgabe_code] || ret.rueckgabe_code} (${ret.end_to_end_id || 'keine Ref'})`;

        await db.promise().query(`
          INSERT INTO offene_zahlungen (mitglied_id, dojo_id, betrag, typ, status, beschreibung, referenz)
          VALUES (?, ?, ?, 'ruecklastschrift', 'offen', ?, ?)
          ON DUPLICATE KEY UPDATE status = 'offen'
        `, [mitgliedId, dojoId, ret.betrag, beschreibung, ret.end_to_end_id]);

        logger.info(`✅ Offene Zahlung erstellt für Mitglied ${mitgliedId}: ${ret.betrag} EUR`);

        // Mitglied als zahlungsproblematisch markieren
        await db.promise().query(`
          UPDATE mitglieder
          SET zahlungsproblem = 1,
              zahlungsproblem_details = ?,
              zahlungsproblem_datum = NOW()
          WHERE mitglied_id = ?
        `, [`SEPA Rücklastschrift: ${ret.rueckgabe_code}`, mitgliedId]).catch(() => {
          // Spalte existiert eventuell noch nicht
        });
      }

      // Mandat widerrufen bei kritischen Fehlern - update verbandsmitgliedschaften
      if (mandatId && ['AC01', 'AC04', 'AC06', 'MD01', 'MD07'].includes(ret.rueckgabe_code)) {
        await db.promise().query(`
          UPDATE verbandsmitgliedschaften
          SET zahlungsart = 'rechnung'
          WHERE id = ?
        `, [mandatId]);
        logger.info(`⚠️ Mandat ${mandatId} widerrufen wegen Fehlercode ${ret.rueckgabe_code}`);
      }
    }

    res.json({ success: true, message: `${inserted} Rücklastschrift(en) importiert`, count: inserted });
  } catch (error) {
    logger.error('Fehler beim Import:', error);
    res.status(500).json({ error: 'Fehler beim Importieren: ' + error.message });
  }
});

// PUT /sepa/ruecklastschriften/:id
router.put('/sepa/ruecklastschriften/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status, notizen } = req.body;
    await db.promise().query('UPDATE sepa_ruecklastschriften SET status = ?, notizen = ?, bearbeitet_am = NOW() WHERE id = ?', [status, notizen, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// GET /sepa/return-codes
router.get('/sepa/return-codes', requireSuperAdmin, (req, res) => {
  res.json({ success: true, codes: SEPA_RETURN_CODES });
});

// Parser-Funktionen
function parseCamt054(xmlContent) {
  const returns = [];
  const ntryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let match;

  while ((match = ntryRegex.exec(xmlContent)) !== null) {
    const entry = match[1];
    const amtMatch = entry.match(/<Amt[^>]*>([0-9.]+)<\/Amt>/);
    const e2eMatch = entry.match(/<EndToEndId>([^<]+)<\/EndToEndId>/);
    const mndtMatch = entry.match(/<MndtId>([^<]+)<\/MndtId>/);
    const rsnMatch = entry.match(/<Rsn><Cd>([^<]+)<\/Cd><\/Rsn>/);
    const dtMatch = entry.match(/<BookgDt><Dt>([^<]+)<\/Dt><\/BookgDt>/);

    if (e2eMatch || mndtMatch) {
      returns.push({
        end_to_end_id: e2eMatch ? e2eMatch[1] : null,
        mandats_referenz: mndtMatch ? mndtMatch[1] : null,
        betrag: amtMatch ? parseFloat(amtMatch[1]) : 0,
        rueckgabe_code: rsnMatch ? rsnMatch[1] : 'MS03',
        rueckgabe_datum: dtMatch ? dtMatch[1] : null
      });
    }
  }
  return returns;
}

function parseCsvReturns(csvContent) {
  const returns = [];
  const lines = csvContent.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length >= 4) {
      returns.push({
        end_to_end_id: parts[0] || null,
        mandats_referenz: parts[1] || null,
        betrag: parseFloat(parts[2]) || 0,
        rueckgabe_code: parts[3] || 'MS03',
        rueckgabe_datum: parts[4] || null
      });
    }
  }
  return returns;
}

// ============================================================================
// OFFENE ZAHLUNGEN MANAGEMENT
// ============================================================================

// GET /offene-zahlungen - Alle offenen Zahlungen
router.get('/offene-zahlungen', requireSuperAdmin, async (req, res) => {
  try {
    const { dojo_id, status = 'offen', typ } = req.query;

    let query = `
      SELECT oz.*, m.vorname, m.nachname, m.email, d.dojoname
      FROM offene_zahlungen oz
      LEFT JOIN mitglieder m ON oz.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON oz.dojo_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (dojo_id) {
      query += ' AND oz.dojo_id = ?';
      params.push(dojo_id);
    }

    if (status && status !== 'alle') {
      query += ' AND oz.status = ?';
      params.push(status);
    }

    if (typ) {
      query += ' AND oz.typ = ?';
      params.push(typ);
    }

    query += ' ORDER BY oz.erstellt_am DESC LIMIT 200';

    const [zahlungen] = await db.promise().query(query, params);

    // Statistiken berechnen
    const [stats] = await db.promise().query(`
      SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) as offen,
        SUM(CASE WHEN status = 'offen' THEN betrag ELSE 0 END) as summe_offen,
        SUM(CASE WHEN typ = 'ruecklastschrift' THEN 1 ELSE 0 END) as ruecklastschriften,
        SUM(CASE WHEN typ = 'chargeback' THEN 1 ELSE 0 END) as chargebacks
      FROM offene_zahlungen
      ${dojo_id ? 'WHERE dojo_id = ?' : ''}
    `, dojo_id ? [dojo_id] : []);

    res.json({
      success: true,
      zahlungen,
      stats: stats[0]
    });

  } catch (error) {
    logger.error('Fehler beim Laden offener Zahlungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// PUT /offene-zahlungen/:id - Offene Zahlung bearbeiten
router.put('/offene-zahlungen/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { status, notizen } = req.body;
    const userId = req.user?.id || null;

    await db.promise().query(`
      UPDATE offene_zahlungen
      SET status = ?, notizen = ?, bearbeitet_am = NOW(), bearbeitet_von = ?
      WHERE id = ?
    `, [status, notizen, userId, req.params.id]);

    // Wenn erledigt, Zahlungsproblem-Flag beim Mitglied prüfen
    if (status === 'erledigt') {
      const [rows] = await db.promise().query('SELECT mitglied_id FROM offene_zahlungen WHERE id = ?', [req.params.id]);
      if (rows.length > 0) {
        const mitgliedId = rows[0].mitglied_id;
        // Prüfe ob noch andere offene Zahlungen existieren
        const [offene] = await db.promise().query(
          "SELECT COUNT(*) as count FROM offene_zahlungen WHERE mitglied_id = ? AND status = 'offen' AND id != ?",
          [mitgliedId, req.params.id]
        );
        if (offene[0].count === 0) {
          // Keine weiteren offenen Zahlungen - Flag entfernen
          await db.promise().query(
            'UPDATE mitglieder SET zahlungsproblem = 0, zahlungsproblem_details = NULL WHERE mitglied_id = ?',
            [mitgliedId]
          ).catch(() => {});
        }
      }
    }

    res.json({ success: true });

  } catch (error) {
    logger.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// GET /mitglieder-mit-zahlungsproblemen - Mitglieder mit Zahlungsproblemen
router.get('/mitglieder-mit-zahlungsproblemen', requireSuperAdmin, async (req, res) => {
  try {
    const [mitglieder] = await db.promise().query(`
      SELECT m.mitglied_id, m.vorname, m.nachname, m.email,
             m.zahlungsproblem_details, m.zahlungsproblem_datum,
             d.dojoname,
             COUNT(oz.id) as offene_zahlungen,
             SUM(oz.betrag) as summe_offen
      FROM mitglieder m
      LEFT JOIN dojo d ON m.dojo_id = d.id
      LEFT JOIN offene_zahlungen oz ON m.mitglied_id = oz.mitglied_id AND oz.status = 'offen'
      WHERE m.zahlungsproblem = 1
      GROUP BY m.mitglied_id
      ORDER BY m.zahlungsproblem_datum DESC
    `);

    res.json({ success: true, mitglieder });

  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /offene-zahlungen/:id/mahnung - Mahnung senden
router.post('/offene-zahlungen/:id/mahnung', requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    // Lade Zahlungsdetails mit Mitgliederdaten
    const [payments] = await db.promise().query(`
      SELECT oz.*, m.vorname, m.nachname, m.email, m.dojo_id
      FROM offene_zahlungen oz
      LEFT JOIN mitglieder m ON oz.mitglied_id = m.mitglied_id
      WHERE oz.id = ?
    `, [id]);

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Zahlung nicht gefunden' });
    }

    const payment = payments[0];
    const reminderLevel = (payment.mahnungen_gesendet || 0) + 1;

    // Mahnung per Email senden
    let emailSent = false;
    if (payment.email) {
      try {
        await sendPaymentReminderEmail(payment.dojo_id, payment.email, {
          memberName: `${payment.vorname} ${payment.nachname}`,
          amount: payment.betrag || 0,
          dueDate: payment.faellig_am || payment.created_at,
          invoiceNumber: payment.rechnungsnummer || `SEPA-${id}`,
          reminderLevel: Math.min(reminderLevel, 3)
        });
        emailSent = true;
        logger.info(`Mahnung ${reminderLevel} gesendet an ${payment.email}`);
      } catch (emailErr) {
        logger.warn(`Mahnung Email fehlgeschlagen: ${emailErr.message}`);
      }
    }

    // Update in DB
    await db.promise().query(`
      UPDATE offene_zahlungen
      SET mahnungen_gesendet = mahnungen_gesendet + 1, letzte_mahnung = NOW()
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: emailSent ? `Mahnung ${reminderLevel} versendet` : 'Mahnung vermerkt (keine Email)',
      emailSent
    });

  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Senden' });
  }
});

// GET /stripe/disputes - Stripe Disputes anzeigen
router.get('/stripe/disputes', requireSuperAdmin, async (req, res) => {
  try {
    const [disputes] = await db.promise().query(`
      SELECT d.*, m.vorname, m.nachname
      FROM stripe_disputes d
      LEFT JOIN mitglieder m ON d.mitglied_id = m.mitglied_id
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    res.json({ success: true, disputes });

  } catch (error) {
    logger.error('Fehler beim Laden der Disputes:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

module.exports = router;
