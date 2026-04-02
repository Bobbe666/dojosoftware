/**
 * Vertraege Shared Functions
 * Gemeinsame Hilfsfunktionen für Vertrags-Module
 */
const logger = require('../../utils/logger');
const db = require('../../db');
const fs = require('fs').promises;
const path = require('path');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Hilfsfunktion: Berechnet Familien-Positionen neu nach Kündigung
async function recalculateFamilyPositions(familienId) {
  if (!familienId) return;

  const members = await queryAsync(`
    SELECT m.mitglied_id, m.geburtsdatum
    FROM mitglieder m
    JOIN vertraege v ON m.mitglied_id = v.mitglied_id
    WHERE m.familien_id = ? AND v.status = 'aktiv'
    ORDER BY m.geburtsdatum ASC
  `, [familienId]);

  for (let i = 0; i < members.length; i++) {
    await queryAsync(`
      UPDATE mitglieder
      SET familie_position = ?, ist_hauptmitglied = ?
      WHERE mitglied_id = ?
    `, [i + 1, i === 0, members[i].mitglied_id]);
  }

  return members;
}

// Hilfsfunktion: Berechnet Familien-Rabatte neu
async function recalculateFamilyDiscounts(familienId) {
  if (!familienId) return;

  const members = await queryAsync(`
    SELECT m.mitglied_id, m.familie_position, m.dojo_id
    FROM mitglieder m
    WHERE m.familien_id = ?
  `, [familienId]);

  for (const member of members) {
    await queryAsync(`
      UPDATE mitglied_rabatte mr
      JOIN rabatte r ON mr.rabatt_id = r.id
      SET mr.aktiv = FALSE, mr.entfernt_am = NOW(),
          mr.entfernt_grund = 'Familien-Neuberechnung nach Kündigung'
      WHERE mr.mitglied_id = ? AND r.ist_familien_rabatt = TRUE AND mr.aktiv = TRUE
    `, [member.mitglied_id]);

    if (member.familie_position === 1) continue;

    const rabatt = await queryAsync(`
      SELECT id FROM rabatte
      WHERE ist_familien_rabatt = TRUE
        AND aktiv = TRUE
        AND (dojo_id = ? OR dojo_id IS NULL)
        AND familie_position_min <= ?
        AND (familie_position_max IS NULL OR familie_position_max >= ?)
      ORDER BY dojo_id DESC, familie_position_min DESC
      LIMIT 1
    `, [member.dojo_id, member.familie_position, member.familie_position]);

    if (rabatt.length > 0) {
      await queryAsync(`
        INSERT INTO mitglied_rabatte (mitglied_id, rabatt_id, aktiv)
        VALUES (?, ?, TRUE)
        ON DUPLICATE KEY UPDATE aktiv = TRUE, angewendet_am = NOW(), entfernt_am = NULL, entfernt_grund = NULL
      `, [member.mitglied_id, rabatt[0].id]);
    }
  }
}

// Hilfsfunktion: Prüft und verarbeitet Familien-Kündigung
async function handleFamilyCancellation(mitgliedId) {
  const mitglied = await queryAsync(`
    SELECT mitglied_id, familien_id, ist_hauptmitglied, familie_position
    FROM mitglieder
    WHERE mitglied_id = ?
  `, [mitgliedId]);

  if (mitglied.length === 0 || !mitglied[0].familien_id) {
    return { isFamilyMember: false };
  }

  const member = mitglied[0];
  const familienId = member.familien_id;

  if (member.ist_hauptmitglied) {
    const remainingMembers = await recalculateFamilyPositions(familienId);
    await recalculateFamilyDiscounts(familienId);

    return {
      isFamilyMember: true,
      wasHauptmitglied: true,
      familienId,
      remainingMembers: remainingMembers.length,
      newHauptmitgliedId: remainingMembers.length > 0 ? remainingMembers[0].mitglied_id : null
    };
  } else {
    await recalculateFamilyPositions(familienId);
    await recalculateFamilyDiscounts(familienId);

    return {
      isFamilyMember: true,
      wasHauptmitglied: false,
      familienId
    };
  }
}

// Helper: Erstelle Dokumente-Verzeichnis falls es nicht existiert
async function ensureDocumentsDir() {
  const docsDir = path.join(__dirname, '..', '..', 'generated_documents');
  try {
    await fs.access(docsDir);
  } catch {
    await fs.mkdir(docsDir, { recursive: true });
  }
  return docsDir;
}

// Helper: Speichere PDF-Buffer als Datei und in Datenbank
async function savePdfToMitgliedDokumente(pdfBuffer, mitgliedId, dojoId, vertragsnummer, vorlageId = null) {
  try {
    const docsDir = await ensureDocumentsDir();
    const timestamp = Date.now();
    const filename = `Vertrag_${vertragsnummer}_${timestamp}.pdf`;
    const filepath = path.join(docsDir, filename);
    const relativePath = `generated_documents/${filename}`;

    await fs.writeFile(filepath, pdfBuffer);

    const dokumentname = `Mitgliedsvertrag ${vertragsnummer}`;
    const insertQuery = `
      INSERT INTO mitglied_dokumente
      (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const result = await queryAsync(insertQuery, [mitgliedId, dojoId, vorlageId, dokumentname, relativePath]);

    return {
      success: true,
      dokumentId: result.insertId,
      filename: filename,
      filepath: relativePath
    };
  } catch (error) {
    logger.error('Fehler beim Speichern des PDFs:', { error: error });
    throw error;
  }
}

// Helper: Erstelle SEPA-Mandat in Datenbank und speichere PDF
async function createSepaMandate(mitgliedData, dojoData, dojoId) {
  const SepaPdfGenerator = require('../../utils/sepaPdfGenerator');

  try {
    const { mitglied_id, iban, bic, bankname, kontoinhaber, vorname, nachname } = mitgliedData;

    if (!iban || !kontoinhaber) {
      return { success: false, reason: 'no_sepa_data' };
    }

    const timestamp = Date.now();
    const mandatsreferenz = `SEPA-${mitglied_id}-${timestamp}`;
    const glaeubigerId = dojoData.glaeubiger_id || 'DE98ZZZ09999999999';

    const insertMandateQuery = `
      INSERT INTO sepa_mandate
      (mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz, glaeubiger_id, status, erstellungsdatum, provider, mandat_typ)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'aktiv', NOW(), 'manual_sepa', 'CORE')
    `;

    const mandateResult = await queryAsync(insertMandateQuery, [
      mitglied_id, iban, bic || null, bankname || null, kontoinhaber, mandatsreferenz, glaeubigerId
    ]);

    const mandatId = mandateResult.insertId;

    const sepaPdfGenerator = new SepaPdfGenerator();
    const sepaPdfData = {
      vorname: vorname || '',
      nachname: nachname || '',
      strasse: mitgliedData.strasse || '',
      plz: mitgliedData.plz || '',
      ort: mitgliedData.ort || '',
      iban: iban,
      bic: bic || '',
      bankname: bankname || '',
      kontoinhaber: kontoinhaber,
      mandatsreferenz: mandatsreferenz,
      glaeubiger_id: glaeubigerId,
      glaeubiger_name: dojoData.name || 'Dojo',
      datum: new Date().toLocaleDateString('de-DE')
    };

    const sepaPdfBuffer = await sepaPdfGenerator.generateSepaMandatePDF(sepaPdfData);

    const docsDir = await ensureDocumentsDir();
    const sepaTimestamp = Date.now();
    const sepaFilename = `SEPA_Mandat_${mandatsreferenz}_${sepaTimestamp}.pdf`;
    const sepaFilepath = path.join(docsDir, sepaFilename);
    const sepaRelativePath = `generated_documents/${sepaFilename}`;

    await fs.writeFile(sepaFilepath, sepaPdfBuffer);

    const dokumentname = `SEPA-Lastschriftmandat ${mandatsreferenz}`;
    const insertDokumentQuery = `
      INSERT INTO mitglied_dokumente
      (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
      VALUES (?, ?, NULL, ?, ?, NOW())
    `;

    const dokumentResult = await queryAsync(insertDokumentQuery, [
      mitglied_id, dojoId, dokumentname, sepaRelativePath
    ]);

    return {
      success: true,
      mandatId: mandatId,
      mandatsreferenz: mandatsreferenz,
      dokumentId: dokumentResult.insertId,
      filename: sepaFilename,
      filepath: sepaRelativePath
    };
  } catch (error) {
    logger.error('Fehler beim Erstellen des SEPA-Mandats:', error);
    throw error;
  }
}

/**
 * Generiert initiale Beiträge bei Vertragsanlage
 * - Anteiliger erster Monat (ab Vertragsbeginn)
 * - Voller zweiter Monat
 * - Aufnahmegebühr (falls vorhanden)
 */
async function generateInitialBeitraege(mitgliedId, dojoId, vertragsbeginn, monatsbeitrag, aufnahmegebuehrCents = 0) {
  try {
    const startDate = new Date(vertragsbeginn);
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth(); // 0-indexed
    const startYear = startDate.getFullYear();

    // Tage im Startmonat
    const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();

    // Verbleibende Tage im Startmonat (inkl. Starttag)
    const remainingDays = daysInStartMonth - startDay + 1;

    // Anteiliger Beitrag für ersten Monat
    const proratedAmount = Math.round((monatsbeitrag / daysInStartMonth * remainingDays) * 100) / 100;

    // Formatierung für Beschreibung
    const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const startMonthStr = monthNames[startMonth];
    const startDayStr = String(startDay).padStart(2, '0');

    // Nächster Monat
    const nextMonth = (startMonth + 1) % 12;
    const nextMonthYear = startMonth === 11 ? startYear + 1 : startYear;
    const nextMonthStr = monthNames[nextMonth];

    const beitraegeToInsert = [];

    // 1. Anteiliger erster Monat (nur wenn nicht am 1. gestartet)
    if (startDay > 1) {
      beitraegeToInsert.push({
        betrag: proratedAmount,
        zahlungsdatum: vertragsbeginn,
        beschreibung: `Beitrag ${startMonthStr}/${startYear} (anteilig ab ${startDayStr}.${startMonthStr}.)`
      });
    } else {
      // Voller erster Monat wenn am 1. gestartet
      beitraegeToInsert.push({
        betrag: monatsbeitrag,
        zahlungsdatum: vertragsbeginn,
        beschreibung: `Beitrag ${startMonthStr}/${startYear}`
      });
    }

    // 2. Voller zweiter Monat
    const secondMonthDate = `${nextMonthYear}-${nextMonthStr}-01`;
    beitraegeToInsert.push({
      betrag: monatsbeitrag,
      zahlungsdatum: secondMonthDate,
      beschreibung: `Beitrag ${nextMonthStr}/${nextMonthYear}`
    });

    // 3. Aufnahmegebühr (falls vorhanden)
    if (aufnahmegebuehrCents && aufnahmegebuehrCents > 0) {
      const aufnahmegebuehr = aufnahmegebuehrCents / 100;
      beitraegeToInsert.push({
        betrag: aufnahmegebuehr,
        zahlungsdatum: vertragsbeginn,
        beschreibung: 'Aufnahmegebühr'
      });
    }

    // In Datenbank einfügen
    const insertedIds = [];
    for (const beitrag of beitraegeToInsert) {
      const result = await queryAsync(`
        INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
        VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?)
      `, [mitgliedId, beitrag.betrag, beitrag.zahlungsdatum, dojoId, beitrag.beschreibung]);
      insertedIds.push(result.insertId);
    }

    logger.info('Initiale Beiträge erstellt:', {
      mitglied_id: mitgliedId,
      anzahl: beitraegeToInsert.length,
      beitraege: beitraegeToInsert.map(b => ({ betrag: b.betrag, beschreibung: b.beschreibung }))
    });

    return {
      success: true,
      beitraege: beitraegeToInsert,
      insertedIds
    };
  } catch (error) {
    logger.error('Fehler beim Generieren der initialen Beiträge:', error);
    throw error;
  }
}

module.exports = {
  queryAsync,
  recalculateFamilyPositions,
  recalculateFamilyDiscounts,
  handleFamilyCancellation,
  ensureDocumentsDir,
  savePdfToMitgliedDokumente,
  createSepaMandate,
  generateInitialBeitraege
};
