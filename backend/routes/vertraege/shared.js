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
 * Generiert Beiträge für die GESAMTE Vertragslaufzeit
 * - Anteiliger erster Monat (ab Vertragsbeginn)
 * - Alle Monate bis Vertragsende (oder mindestlaufzeit_monate wenn kein Ende)
 * - Aufnahmegebühr (falls vorhanden)
 *
 * @param {number} mitgliedId - Mitglieds-ID
 * @param {number} dojoId - Dojo-ID
 * @param {string} vertragsbeginn - Startdatum (YYYY-MM-DD)
 * @param {number} monatsbeitrag - Monatlicher Beitrag in Euro
 * @param {number} aufnahmegebuehrCents - Aufnahmegebühr in Cents (optional)
 * @param {string|null} vertragsende - Enddatum (YYYY-MM-DD) oder null
 * @param {number} mindestlaufzeitMonate - Mindestlaufzeit in Monaten (default 12)
 */
async function generateInitialBeitraege(mitgliedId, dojoId, vertragsbeginn, monatsbeitrag, aufnahmegebuehrCents = 0, vertragsende = null, mindestlaufzeitMonate = 12) {
  try {
    const startDate = new Date(vertragsbeginn);
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth(); // 0-indexed
    const startYear = startDate.getFullYear();

    // Berechne Enddatum: vertragsende oder mindestlaufzeit_monate ab Start
    let endDate;
    if (vertragsende) {
      endDate = new Date(vertragsende);
    } else {
      // Kein Vertragsende: Generiere für mindestlaufzeit_monate
      endDate = new Date(startYear, startMonth + mindestlaufzeitMonate, 0); // Letzter Tag des Endmonats
    }

    // Tage im Startmonat
    const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();

    // Verbleibende Tage im Startmonat (inkl. Starttag)
    const remainingDays = daysInStartMonth - startDay + 1;

    // Anteiliger Beitrag für ersten Monat
    const proratedAmount = Math.round((monatsbeitrag / daysInStartMonth * remainingDays) * 100) / 100;

    const beitraegeToInsert = [];

    // 1. Erster Monat (anteilig oder voll)
    const startMonthStr = String(startMonth + 1).padStart(2, '0');
    const startDayStr = String(startDay).padStart(2, '0');

    if (startDay > 1) {
      beitraegeToInsert.push({
        betrag: proratedAmount,
        zahlungsdatum: vertragsbeginn,
        beschreibung: `Beitrag ${startMonthStr}/${startYear} (anteilig ab ${startDayStr}.${startMonthStr}.)`
      });
    } else {
      beitraegeToInsert.push({
        betrag: monatsbeitrag,
        zahlungsdatum: vertragsbeginn,
        beschreibung: `Beitrag ${startMonthStr}/${startYear}`
      });
    }

    // 2. Alle weiteren Monate bis Enddatum
    let currentMonth = startMonth + 1;
    let currentYear = startYear;

    // Wenn im Dezember gestartet, nächster Monat ist Januar des nächsten Jahres
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }

    while (true) {
      const currentDate = new Date(currentYear, currentMonth, 1);

      // Prüfe ob wir das Enddatum überschritten haben
      if (currentDate > endDate) {
        break;
      }

      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const zahlungsdatum = `${currentYear}-${monthStr}-01`;

      beitraegeToInsert.push({
        betrag: monatsbeitrag,
        zahlungsdatum: zahlungsdatum,
        beschreibung: `Beitrag ${monthStr}/${currentYear}`
      });

      // Nächster Monat
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }

      // Sicherheit: Maximal 120 Monate (10 Jahre) generieren
      if (beitraegeToInsert.length > 120) {
        logger.warn('Beitrags-Generierung bei 120 Monaten gestoppt', { mitglied_id: mitgliedId });
        break;
      }
    }

    // 3. Aufnahmegebühr (falls vorhanden)
    if (aufnahmegebuehrCents && aufnahmegebuehrCents > 0) {
      const aufnahmegebuehr = aufnahmegebuehrCents / 100;
      beitraegeToInsert.push({
        betrag: aufnahmegebuehr,
        zahlungsdatum: vertragsbeginn,
        beschreibung: 'Aufnahmegebühr'
      });
    }

    // In Datenbank einfügen (mit Duplikat-Prüfung)
    const insertedIds = [];
    let skippedCount = 0;

    for (const beitrag of beitraegeToInsert) {
      // Prüfe ob bereits ein Beitrag für diesen Monat existiert
      const existing = await queryAsync(`
        SELECT beitrag_id FROM beitraege
        WHERE mitglied_id = ?
          AND DATE_FORMAT(zahlungsdatum, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')
          AND (magicline_description LIKE 'Beitrag%' OR magicline_description LIKE 'Aufnahme%' OR magicline_description IS NULL)
        LIMIT 1
      `, [mitgliedId, beitrag.zahlungsdatum]);

      if (existing.length === 0) {
        const result = await queryAsync(`
          INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
          VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?)
        `, [mitgliedId, beitrag.betrag, beitrag.zahlungsdatum, dojoId, beitrag.beschreibung]);
        insertedIds.push(result.insertId);
      } else {
        skippedCount++;
      }
    }

    logger.info('Beiträge für Vertragslaufzeit erstellt:', {
      mitglied_id: mitgliedId,
      gesamt: beitraegeToInsert.length,
      eingefuegt: insertedIds.length,
      uebersprungen: skippedCount,
      zeitraum: `${vertragsbeginn} bis ${endDate.toISOString().split('T')[0]}`
    });

    return {
      success: true,
      beitraege: beitraegeToInsert,
      insertedIds,
      skippedCount
    };
  } catch (error) {
    logger.error('Fehler beim Generieren der Beiträge:', error);
    throw error;
  }
}

/**
 * Generiert fehlende Beiträge für einen bestehenden Vertrag
 * Nützlich für Nachgenerierung bei bestehenden Verträgen
 */
async function generateMissingBeitraege(vertragId) {
  try {
    // Hole Vertragsdaten
    const vertraege = await queryAsync(`
      SELECT v.*, m.dojo_id, t.price_cents, t.aufnahmegebuehr_cents
      FROM vertraege v
      JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE v.id = ? AND v.status = 'aktiv'
    `, [vertragId]);

    if (vertraege.length === 0) {
      return { success: false, error: 'Vertrag nicht gefunden oder nicht aktiv' };
    }

    const vertrag = vertraege[0];
    const monatsbeitrag = vertrag.monatsbeitrag || (vertrag.price_cents ? vertrag.price_cents / 100 : 0);

    if (monatsbeitrag <= 0) {
      return { success: false, error: 'Kein Monatsbeitrag definiert' };
    }

    // Generiere fehlende Beiträge (ohne Aufnahmegebühr, die sollte schon existieren)
    const result = await generateInitialBeitraege(
      vertrag.mitglied_id,
      vertrag.dojo_id,
      vertrag.vertragsbeginn,
      monatsbeitrag,
      0, // Keine Aufnahmegebühr bei Nachgenerierung
      vertrag.vertragsende,
      vertrag.mindestlaufzeit_monate || 12
    );

    return result;
  } catch (error) {
    logger.error('Fehler beim Generieren fehlender Beiträge:', error);
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
  generateInitialBeitraege,
  generateMissingBeitraege
};
