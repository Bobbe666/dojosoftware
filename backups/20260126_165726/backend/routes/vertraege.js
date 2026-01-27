// Backend/routes/vertraege.js - Vereinfachte Verträge API
const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateVertragPDF } = require('../utils/vertragPdfGenerator');
const { generateCompleteVertragPDF } = require('../services/vertragPdfGeneratorExtended');
const { generatePDFWithDefaultTemplate } = require('../services/templatePdfGenerator');
const { sendVertragEmail } = require('../services/emailService');
const SepaPdfGenerator = require('../utils/sepaPdfGenerator');
const fs = require('fs').promises;
const path = require('path');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// =============================================
// FAMILIEN-KÜNDIGUNGS-HILFSFUNKTIONEN
// =============================================

// Hilfsfunktion: Berechnet Familien-Positionen neu nach Kündigung
async function recalculateFamilyPositions(familienId) {
  if (!familienId) return;

  // Alle aktiven Familienmitglieder nach Geburtsdatum sortieren (älteste zuerst)
  const members = await queryAsync(`
    SELECT m.mitglied_id, m.geburtsdatum
    FROM mitglieder m
    JOIN vertraege v ON m.mitglied_id = v.mitglied_id
    WHERE m.familien_id = ? AND v.status = 'aktiv'
    ORDER BY m.geburtsdatum ASC
  `, [familienId]);

  // Positionen neu zuweisen
  for (let i = 0; i < members.length; i++) {
    await queryAsync(`
      UPDATE mitglieder
      SET familie_position = ?, ist_hauptmitglied = ?
      WHERE mitglied_id = ?
    `, [i + 1, i === 0, members[i].mitglied_id]);
  }

  console.log(`Familien-Positionen neu berechnet für Familie ${familienId}: ${members.length} aktive Mitglieder`);
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
    // Alten Familien-Rabatt deaktivieren
    await queryAsync(`
      UPDATE mitglied_rabatte mr
      JOIN rabatte r ON mr.rabatt_id = r.id
      SET mr.aktiv = FALSE, mr.entfernt_am = NOW(),
          mr.entfernt_grund = 'Familien-Neuberechnung nach Kündigung'
      WHERE mr.mitglied_id = ? AND r.ist_familien_rabatt = TRUE AND mr.aktiv = TRUE
    `, [member.mitglied_id]);

    // Position 1 = Hauptmitglied = kein Familien-Rabatt
    if (member.familie_position === 1) continue;

    // Passenden Familien-Rabatt finden
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
      // Neuen Rabatt zuweisen
      await queryAsync(`
        INSERT INTO mitglied_rabatte (mitglied_id, rabatt_id, aktiv)
        VALUES (?, ?, TRUE)
        ON DUPLICATE KEY UPDATE aktiv = TRUE, angewendet_am = NOW(), entfernt_am = NULL, entfernt_grund = NULL
      `, [member.mitglied_id, rabatt[0].id]);
    }
  }

  console.log(`Familien-Rabatte neu berechnet für Familie ${familienId}`);
}

// Hilfsfunktion: Prüft und verarbeitet Familien-Kündigung
async function handleFamilyCancellation(mitgliedId) {
  // Prüfe ob das Mitglied ein Hauptmitglied ist
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

  // Wenn es das Hauptmitglied war, müssen wir einen neuen Hauptmitglied bestimmen
  if (member.ist_hauptmitglied) {
    console.log(`Hauptmitglied ${mitgliedId} kündigt - suche neues Hauptmitglied für Familie ${familienId}`);

    // Berechne Positionen neu (das wird automatisch ein neues Hauptmitglied setzen)
    const remainingMembers = await recalculateFamilyPositions(familienId);

    // Berechne Rabatte neu
    await recalculateFamilyDiscounts(familienId);

    return {
      isFamilyMember: true,
      wasHauptmitglied: true,
      familienId,
      remainingMembers: remainingMembers.length,
      newHauptmitgliedId: remainingMembers.length > 0 ? remainingMembers[0].mitglied_id : null
    };
  } else {
    // Normales Familienmitglied kündigt - nur Positionen und Rabatte neu berechnen
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
  const docsDir = path.join(__dirname, '..', 'generated_documents');
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
    // Erstelle Verzeichnis
    const docsDir = await ensureDocumentsDir();

    // Generiere Dateinamen
    const timestamp = Date.now();
    const filename = `Vertrag_${vertragsnummer}_${timestamp}.pdf`;
    const filepath = path.join(docsDir, filename);
    const relativePath = `generated_documents/${filename}`;

    // Speichere PDF-Datei
    await fs.writeFile(filepath, pdfBuffer);

    // Speichere Eintrag in Datenbank
    const dokumentname = `Mitgliedsvertrag ${vertragsnummer}`;

    const insertQuery = `
      INSERT INTO mitglied_dokumente
      (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const result = await queryAsync(insertQuery, [
      mitgliedId,
      dojoId,
      vorlageId,
      dokumentname,
      relativePath
    ]);

    return {
      success: true,
      dokumentId: result.insertId,
      filename: filename,
      filepath: relativePath
    };
  } catch (error) {
    console.error('Fehler beim Speichern des PDFs:', error);
    throw error;
  }
}

// Helper: Erstelle SEPA-Mandat in Datenbank und speichere PDF
async function createSepaMandate(mitgliedData, dojoData, dojoId) {
  try {
    const { mitglied_id, iban, bic, bankname, kontoinhaber, vorname, nachname } = mitgliedData;

    // Prüfe ob SEPA-Daten vorhanden sind
    if (!iban || !kontoinhaber) {
      console.log('⏭️ Keine SEPA-Daten vorhanden, überspringe SEPA-Mandat-Erstellung');
      return { success: false, reason: 'no_sepa_data' };
    }

    // 1. Generiere Mandatsreferenz
    const timestamp = Date.now();
    const mandatsreferenz = `SEPA-${mitglied_id}-${timestamp}`;

    // 2. Hole Gläubiger-ID aus Dojo-Daten
    const glaeubigerId = dojoData.glaeubiger_id || 'DE98ZZZ09999999999';

    // 3. SEPA-Mandat in Datenbank erstellen
    const insertMandateQuery = `
      INSERT INTO sepa_mandate
      (mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz, glaeubiger_id, status, erstellungsdatum, provider, mandat_typ)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'aktiv', NOW(), 'manual', 'CORE')
    `;

    const mandateResult = await queryAsync(insertMandateQuery, [
      mitglied_id,
      iban,
      bic || null,
      bankname || null,
      kontoinhaber,
      mandatsreferenz,
      glaeubigerId
    ]);

    const mandatId = mandateResult.insertId;
    console.log(`✅ SEPA-Mandat erstellt: ID ${mandatId}, Referenz: ${mandatsreferenz}`);

    // 4. Generiere SEPA-Mandat-PDF
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

    // 5. Speichere SEPA-PDF als Mitglieder-Dokument
    const docsDir = await ensureDocumentsDir();
    const sepaTimestamp = Date.now();
    const sepaFilename = `SEPA_Mandat_${mandatsreferenz}_${sepaTimestamp}.pdf`;
    const sepaFilepath = path.join(docsDir, sepaFilename);
    const sepaRelativePath = `generated_documents/${sepaFilename}`;

    await fs.writeFile(sepaFilepath, sepaPdfBuffer);

    // 6. Speichere SEPA-PDF in mitglied_dokumente
    const dokumentname = `SEPA-Lastschriftmandat ${mandatsreferenz}`;
    const insertDokumentQuery = `
      INSERT INTO mitglied_dokumente
      (mitglied_id, dojo_id, vorlage_id, dokumentname, dateipfad, erstellt_am)
      VALUES (?, ?, NULL, ?, ?, NOW())
    `;

    const dokumentResult = await queryAsync(insertDokumentQuery, [
      mitglied_id,
      dojoId,
      dokumentname,
      sepaRelativePath
    ]);

    console.log(`✅ SEPA-Mandat-PDF gespeichert: ${sepaFilename} (Dokument-ID: ${dokumentResult.insertId})`);

    return {
      success: true,
      mandatId: mandatId,
      mandatsreferenz: mandatsreferenz,
      dokumentId: dokumentResult.insertId,
      filename: sepaFilename,
      filepath: sepaRelativePath
    };

  } catch (error) {
    console.error('❌ Fehler beim Erstellen des SEPA-Mandats:', error);
    throw error;
  }
}

// GET /api/vertraege - Alle Verträge abrufen (inkl. gelöschte)
router.get('/', async (req, res) => {
    try {
        const { dojo_id, mitglied_id } = req.query;
        // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause für Tax Compliance!
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

        // Aktive Verträge
        const vertraege = await queryAsync(`
            SELECT
                v.*,
                m.vorname,
                m.nachname,
                m.email,
                t.name as tarif_name,
                t.price_cents,
                COALESCE(v.monatsbeitrag, t.price_cents / 100) as monatsbeitrag,
                FALSE as geloescht
            FROM vertraege v
            LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            ${whereClause}
        `, queryParams);

        // Gelöschte Verträge (nur für mitglied_id)
        let geloeschteVertraege = [];
        if (mitglied_id) {
            const whereConditionsArchive = ['vg.mitglied_id = ?'];
            const queryParamsArchive = [parseInt(mitglied_id)];

            if (dojo_id && dojo_id !== 'all') {
                whereConditionsArchive.push('vg.dojo_id = ?');
                queryParamsArchive.push(parseInt(dojo_id));
            }

            geloeschteVertraege = await queryAsync(`
                SELECT
                    vg.*,
                    m.vorname,
                    m.nachname,
                    m.email,
                    t.name as tarif_name,
                    t.price_cents,
                    COALESCE(vg.monatsbeitrag, t.price_cents / 100) as monatsbeitrag,
                    TRUE as geloescht
                FROM vertraege_geloescht vg
                LEFT JOIN mitglieder m ON vg.mitglied_id = m.mitglied_id
                LEFT JOIN tarife t ON vg.tarif_id = t.id
                WHERE ${whereConditionsArchive.join(' AND ')}
            `, queryParamsArchive);
        }

        // Kombiniere aktive und gelöschte Verträge
        const alleVertraege = [...vertraege, ...geloeschteVertraege].sort((a, b) => b.id - a.id);

        res.json({ success: true, data: alleVertraege });
    } catch (err) {
        console.error('Fehler beim Abrufen der Verträge:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// GET /api/vertraege/stats - Statistiken für Beitragsverwaltung
router.get('/stats', async (req, res) => {
    try {
        const { dojo_id } = req.query;
        // 🔒 KRITISCHER DOJO-FILTER: Statistiken müssen per Dojo getrennt sein!
        let whereConditions = ['status = ?'];
        let queryParams = ['aktiv'];

        if (dojo_id && dojo_id !== 'all') {
            whereConditions.push('dojo_id = ?');
            queryParams.push(parseInt(dojo_id));
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const aktiveVertraege = await queryAsync(`
            SELECT COUNT(*) as count
            FROM vertraege
            ${whereClause}
        `, queryParams);

        const stats = {
            aktiveVertraege: aktiveVertraege[0].count,
            gesamteinnahmen: 0,  // Placeholder - Tabelle hat keine Preis-Informationen
            monatlicheEinnahmen: 0  // Placeholder - Tabelle hat keine Preis-Informationen
        };
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('Fehler beim Berechnen der Vertrags-Statistiken:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/vertraege - Neuen Vertrag erstellen (mit rechtssicheren Feldern)
router.post('/', async (req, res) => {
    try {
        const {
            mitglied_id,
            status,
            dojo_id,
            // Vertragsdaten - Basisdaten
            tarif_id,
            vertragsbeginn,
            vertragsende,
            billing_cycle,
            payment_method,
            monatsbeitrag,
            aufnahmegebuehr_cents,
            vertragsnummer,
            kuendigungsfrist_monate,
            mindestlaufzeit_monate,
            automatische_verlaengerung,
            verlaengerung_monate,
            faelligkeit_tag,
            rabatt_prozent,
            rabatt_grund,
            sepa_mandat_id,
            // Rechtliche Akzeptanzen
            agb_version,
            agb_akzeptiert_am,
            datenschutz_version,
            datenschutz_akzeptiert_am,
            widerruf_akzeptiert_am,
            hausordnung_akzeptiert_am,
            gesundheitserklaerung,
            gesundheitserklaerung_datum,
            haftungsausschluss_akzeptiert,
            haftungsausschluss_datum,
            foto_einverstaendnis,
            foto_einverstaendnis_datum,
            // Unterschrift
            unterschrift_datum,
            unterschrift_digital,
            unterschrift_ip,
            vertragstext_pdf_path,
            created_by
        } = req.body;
        if (!mitglied_id) {
            return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
        }

        // 🔒 KRITISCH: dojo_id ist PFLICHTFELD für Tax Compliance!
        if (!dojo_id) {
            console.error("KRITISCHER FEHLER: Neuer Vertrag ohne dojo_id!");
            return res.status(400).json({
                error: "dojo_id ist erforderlich - jeder Vertrag MUSS einem Dojo zugeordnet sein (Tax Compliance!)",
                required: ['mitglied_id', 'dojo_id']
            });
        }

        // 🔒 SICHERHEITSCHECK: Prüfe ob Mitglied zum richtigen Dojo gehört
        const memberCheck = await queryAsync(`
            SELECT mitglied_id, dojo_id FROM mitglieder WHERE mitglied_id = ?
        `, [mitglied_id]);

        if (memberCheck.length === 0) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        if (memberCheck[0].dojo_id !== parseInt(dojo_id)) {
            console.error(`SICHERHEITSVERLETZUNG: Versuch Vertrag für Mitglied ${mitglied_id} (Dojo ${memberCheck[0].dojo_id}) mit falschem dojo_id ${dojo_id} zu erstellen!`);
            return res.status(403).json({
                error: 'Keine Berechtigung - Mitglied gehört zu anderem Dojo',
                member_dojo: memberCheck[0].dojo_id,
                requested_dojo: dojo_id
            });
        }

        // Dynamische Query-Generierung: Nur Felder einfügen, die übergeben wurden
        const fields = ['mitglied_id', 'status', 'dojo_id'];
        const values = [mitglied_id, status || 'aktiv', parseInt(dojo_id)];

        // Wichtige Basisdaten (sollten immer gesetzt sein)
        if (tarif_id !== undefined && tarif_id !== null && tarif_id !== '') { fields.push('tarif_id'); values.push(parseInt(tarif_id)); }
        if (vertragsbeginn) { fields.push('vertragsbeginn'); values.push(vertragsbeginn); }
        if (vertragsende) { fields.push('vertragsende'); values.push(vertragsende); }
        if (billing_cycle) { fields.push('billing_cycle'); values.push(billing_cycle); }
        if (payment_method) { fields.push('payment_method'); values.push(payment_method); }
        if (monatsbeitrag !== undefined) { fields.push('monatsbeitrag'); values.push(monatsbeitrag); }

        // AUTO: Aufnahmegebühr vom Tarif holen wenn nicht explizit gesetzt
        let autoAufnahmegebuehr = aufnahmegebuehr_cents;
        if (autoAufnahmegebuehr === undefined && tarif_id) {
            try {
                const tarifResult = await queryAsync("SELECT aufnahmegebuehr_cents FROM tarife WHERE id = ?", [parseInt(tarif_id)]);
                if (tarifResult.length > 0 && tarifResult[0].aufnahmegebuehr_cents) {
                    autoAufnahmegebuehr = tarifResult[0].aufnahmegebuehr_cents;
                    console.log("[Vertrag] Aufnahmegebühr automatisch vom Tarif übernommen:", autoAufnahmegebuehr, "Cent");
                }
            } catch (tarifErr) {
                console.error("Fehler beim Laden der Tarif-Aufnahmegebühr:", tarifErr);
            }
        }
        if (autoAufnahmegebuehr !== undefined) { fields.push('aufnahmegebuehr_cents'); values.push(autoAufnahmegebuehr); }

        // Optional: Weitere Vertragsdaten
        if (vertragsnummer) { fields.push('vertragsnummer'); values.push(vertragsnummer); }
        if (kuendigungsfrist_monate !== undefined) { fields.push('kuendigungsfrist_monate'); values.push(kuendigungsfrist_monate); }
        if (mindestlaufzeit_monate !== undefined) { fields.push('mindestlaufzeit_monate'); values.push(mindestlaufzeit_monate); }
        if (automatische_verlaengerung !== undefined) { fields.push('automatische_verlaengerung'); values.push(automatische_verlaengerung); }
        if (verlaengerung_monate !== undefined) { fields.push('verlaengerung_monate'); values.push(verlaengerung_monate); }
        if (faelligkeit_tag !== undefined) { fields.push('faelligkeit_tag'); values.push(faelligkeit_tag); }
        if (rabatt_prozent !== undefined) { fields.push('rabatt_prozent'); values.push(rabatt_prozent); }
        if (rabatt_grund) { fields.push('rabatt_grund'); values.push(rabatt_grund); }
        if (sepa_mandat_id) { fields.push('sepa_mandat_id'); values.push(sepa_mandat_id); }

        // Optional: Rechtliche Akzeptanzen
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

        // Optional: Unterschrift (WICHTIG: mit Zeitstempel!)
        if (unterschrift_datum) { fields.push('unterschrift_datum'); values.push(unterschrift_datum); }
        if (unterschrift_digital) { fields.push('unterschrift_digital'); values.push(unterschrift_digital); }
        if (unterschrift_ip) { fields.push('unterschrift_ip'); values.push(unterschrift_ip); }
        if (vertragstext_pdf_path) { fields.push('vertragstext_pdf_path'); values.push(vertragstext_pdf_path); }
        if (created_by) { fields.push('created_by'); values.push(created_by); }

        const placeholders = fields.map(() => '?').join(', ');
        const query = `INSERT INTO vertraege (${fields.join(', ')}) VALUES (${placeholders})`;
        const result = await queryAsync(query, values);
        // Automatische Generierung der Vertragsnummer (falls nicht vorhanden)
        let generatedVertragsnummer = null;
        if (result.insertId && !vertragsnummer) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const vertragId = String(result.insertId).padStart(5, '0');
            const mitgliedIdFormatted = String(mitglied_id).padStart(4, '0');

            generatedVertragsnummer = `VTR-${year}${month}-M${mitgliedIdFormatted}-${vertragId}`;

            await queryAsync(`
                UPDATE vertraege
                SET vertragsnummer = ?
                WHERE id = ?
            `, [generatedVertragsnummer, result.insertId]);
        }

        // Historie-Eintrag erstellen
        if (result.insertId) {
            try {
                await queryAsync(`
                    INSERT INTO vertragshistorie (vertrag_id, aenderung_typ, aenderung_beschreibung, geaendert_von, ip_adresse)
                    VALUES (?, 'erstellt', 'Vertrag wurde erstellt', ?, ?)
                `, [result.insertId, created_by || null, unterschrift_ip || null]);
            } catch (histErr) {
                console.warn('Fehler beim Erstellen des Historie-Eintrags (nicht kritisch):', histErr.message);
            }
        }

        // ========================================
        // PDF-GENERIERUNG UND E-MAIL-VERSAND
        // ========================================
        let pdfGenerated = false;
        let emailSent = false;

        if (result.insertId) {
            try {
                // 1. Lade vollständige Mitgliedsdaten
                const mitgliedResults = await queryAsync(`
                    SELECT * FROM mitglieder WHERE mitglied_id = ?
                `, [mitglied_id]);

                if (mitgliedResults.length === 0) {
                    throw new Error('Mitgliedsdaten nicht gefunden');
                }

                const mitgliedData = mitgliedResults[0];

                // 2. Lade Dojo-Daten
                const dojoResults = await queryAsync(`
                    SELECT * FROM dojo WHERE id = ?
                `, [dojo_id]);

                if (dojoResults.length === 0) {
                    throw new Error('Dojo-Daten nicht gefunden');
                }

                const dojoData = dojoResults[0];

                // 3. Erstelle Vertragsdaten-Objekt
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

                // 4. Generiere PDF mit allen Vertragsdokumenten
                const pdfBuffer = await generateCompleteVertragPDF(
                    dojo_id,
                    mitgliedData,
                    vertragData
                );

                pdfGenerated = true;

                // 5. Speichere PDF im Mitglieder-Account
                let pdfSaved = false;
                let dokumentId = null;
                try {
                    const saveResult = await savePdfToMitgliedDokumente(
                        pdfBuffer,
                        mitglied_id,
                        dojo_id,
                        vertragData.vertragsnummer,
                        null // vorlage_id - könnte optional aus DB geladen werden
                    );
                    pdfSaved = saveResult.success;
                    dokumentId = saveResult.dokumentId;
                    console.log(`✅ Vertragsdokument gespeichert: ${saveResult.filename} (ID: ${dokumentId})`);
                } catch (saveError) {
                    console.error('⚠️ Fehler beim Speichern des Vertragsdokuments:', saveError.message);
                    // Fahre fort, auch wenn Speichern fehlschlägt
                }

                // 6. Versende E-Mail mit PDF-Anhang
                if (mitgliedData.email) {
                    const emailResult = await sendVertragEmail({
                        email: mitgliedData.email,
                        vorname: mitgliedData.vorname || '',
                        nachname: mitgliedData.nachname || '',
                        vertragsnummer: vertragData.vertragsnummer,
                        pdfBuffer: pdfBuffer,
                        dojoname: dojoData.name || 'Dojo'
                    });

                    if (emailResult.success) {
                        emailSent = true;
                    } else {
                    }
                } else {
                }

                // 7. SEPA-Mandat automatisch erstellen (wenn SEPA-Daten vorhanden)
                let sepaMandatCreated = false;
                let sepaMandatId = null;
                let sepaMandatsreferenz = null;
                try {
                    const sepaResult = await createSepaMandate(mitgliedData, dojoData, dojo_id);
                    if (sepaResult.success) {
                        sepaMandatCreated = true;
                        sepaMandatId = sepaResult.mandatId;
                        sepaMandatsreferenz = sepaResult.mandatsreferenz;

                        // Verknüpfe SEPA-Mandat mit Vertrag
                        await queryAsync(`
                            UPDATE vertraege
                            SET sepa_mandat_id = ?
                            WHERE id = ?
                        `, [sepaMandatId, result.insertId]);

                        console.log(`✅ SEPA-Mandat ${sepaMandatsreferenz} mit Vertrag ${result.insertId} verknüpft`);
                    } else {
                        console.log(`⏭️ SEPA-Mandat-Erstellung übersprungen: ${sepaResult.reason}`);
                    }
                } catch (sepaError) {
                    console.error('⚠️ Fehler beim Erstellen des SEPA-Mandats:', sepaError.message);
                    // Fahre fort, auch wenn SEPA-Mandat-Erstellung fehlschlägt
                }

            } catch (pdfError) {
                console.error('Fehler bei PDF-Generierung oder E-Mail-Versand:', pdfError);
                console.error('   Der Vertrag wurde trotzdem erfolgreich erstellt.');
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
                pdf_saved: pdfSaved || false,
                dokument_id: dokumentId,
                email_sent: emailSent,
                sepa_mandat_created: sepaMandatCreated || false,
                sepa_mandat_id: sepaMandatId,
                sepa_mandatsreferenz: sepaMandatsreferenz
            }
        });
    } catch (err) {
        console.error('Fehler beim Erstellen des Vertrags:', err);
        console.error('SQL Error Code:', err.code);
        console.error('SQL Error Message:', err.sqlMessage);
        console.error('SQL State:', err.sqlState);
        res.status(500).json({
            error: 'Datenbankfehler',
            details: err.message,
            sqlError: err.sqlMessage,
            code: err.code
        });
    }
});

// PUT /api/vertraege/:id - Vertrag aktualisieren
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            dojo_id,
            kuendigung_eingegangen,
            kuendigungsgrund,
            kuendigungsdatum,
            ruhepause_von,
            ruhepause_bis,
            ruhepause_dauer_monate
        } = req.body;

        // Build dynamic UPDATE clause based on provided fields
        let updateFields = [];
        let queryParams = [];

        if (status !== undefined) {
            updateFields.push('status = ?');
            queryParams.push(status);
        }
        if (kuendigung_eingegangen !== undefined) {
            updateFields.push('kuendigung_eingegangen = ?');
            queryParams.push(kuendigung_eingegangen);
        }
        if (kuendigungsgrund !== undefined) {
            updateFields.push('kuendigungsgrund = ?');
            queryParams.push(kuendigungsgrund);
        }
        if (kuendigungsdatum !== undefined) {
            updateFields.push('kuendigungsdatum = ?');
            queryParams.push(kuendigungsdatum);
        }
        if (ruhepause_von !== undefined) {
            updateFields.push('ruhepause_von = ?');
            queryParams.push(ruhepause_von);
        }
        if (ruhepause_bis !== undefined) {
            updateFields.push('ruhepause_bis = ?');
            queryParams.push(ruhepause_bis);
        }
        if (ruhepause_dauer_monate !== undefined) {
            updateFields.push('ruhepause_dauer_monate = ?');
            queryParams.push(ruhepause_dauer_monate);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });
        }

        // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
        let whereConditions = ['id = ?'];
        queryParams.push(id);

        if (dojo_id && dojo_id !== 'all') {
            whereConditions.push('dojo_id = ?');
            queryParams.push(parseInt(dojo_id));
        }

        const result = await queryAsync(`
            UPDATE vertraege
            SET ${updateFields.join(', ')}
            WHERE ${whereConditions.join(' AND ')}
        `, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vertrag nicht gefunden oder keine Berechtigung' });
        }

        // =============================================
        // FAMILIEN-LOGIK BEI KÜNDIGUNG
        // =============================================
        let familyResult = null;
        if (status === 'gekuendigt' || status === 'inaktiv' || status === 'beendet') {
            try {
                // Hole mitglied_id vom Vertrag
                const vertrag = await queryAsync('SELECT mitglied_id FROM vertraege WHERE id = ?', [id]);
                if (vertrag.length > 0) {
                    familyResult = await handleFamilyCancellation(vertrag[0].mitglied_id);
                    if (familyResult.isFamilyMember) {
                        console.log(`Familien-Kündigung verarbeitet:`, familyResult);
                    }
                }
            } catch (familyErr) {
                console.error('Fehler bei Familien-Kündigungs-Verarbeitung (nicht kritisch):', familyErr);
                // Fahre fort auch wenn Familien-Logik fehlschlägt
            }
        }

        res.json({
            success: true,
            message: 'Vertrag erfolgreich aktualisiert',
            familyUpdate: familyResult
        });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Vertrags:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/vertraege/:id - Vertrag archivieren (nicht wirklich löschen)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { dojo_id, geloescht_von, geloescht_grund } = req.body;

        // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
        let whereConditions = ['id = ?'];
        let queryParams = [id];

        if (dojo_id && dojo_id !== 'all') {
            whereConditions.push('dojo_id = ?');
            queryParams.push(parseInt(dojo_id));
        }

        // 1. Lade den Vertrag
        const vertrag = await queryAsync(`
            SELECT * FROM vertraege
            WHERE ${whereConditions.join(' AND ')}
        `, queryParams);

        if (vertrag.length === 0) {
            return res.status(404).json({ error: 'Vertrag nicht gefunden oder keine Berechtigung' });
        }

        const vertragData = vertrag[0];

        // 2. Kopiere in Archiv-Tabelle
        await queryAsync(`
            INSERT INTO vertraege_geloescht (
                id, mitglied_id, dojo_id, tarif_id, status,
                vertragsbeginn, vertragsende, billing_cycle, payment_method,
                monatsbeitrag, kuendigung_eingegangen, kuendigungsgrund, kuendigungsdatum,
                ruhepause_von, ruhepause_bis, ruhepause_dauer_monate,
                agb_akzeptiert_am, datenschutz_akzeptiert_am, hausordnung_akzeptiert_am,
                unterschrift_datum, unterschrift_ip,
                created_at, updated_at,
                geloescht_von, geloescht_grund
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            vertragData.id,
            vertragData.mitglied_id,
            vertragData.dojo_id,
            vertragData.tarif_id,
            vertragData.status,
            vertragData.vertragsbeginn,
            vertragData.vertragsende,
            vertragData.billing_cycle,
            vertragData.payment_method,
            vertragData.monatsbeitrag,
            vertragData.kuendigung_eingegangen,
            vertragData.kuendigungsgrund,
            vertragData.kuendigungsdatum,
            vertragData.ruhepause_von,
            vertragData.ruhepause_bis,
            vertragData.ruhepause_dauer_monate,
            vertragData.agb_akzeptiert_am,
            vertragData.datenschutz_akzeptiert_am,
            vertragData.hausordnung_akzeptiert_am,
            vertragData.unterschrift_datum,
            vertragData.unterschrift_ip,
            vertragData.created_at,
            vertragData.updated_at,
            geloescht_von || 'Admin',
            geloescht_grund || 'Kein Grund angegeben'
        ]);

        // 3. Lösche aus Haupt-Tabelle
        await queryAsync(`
            DELETE FROM vertraege
            WHERE ${whereConditions.join(' AND ')}
        `, queryParams);

        // 4. Familien-Logik: Positionen und Rabatte neu berechnen
        let familyResult = null;
        try {
            familyResult = await handleFamilyCancellation(vertragData.mitglied_id);
            if (familyResult.isFamilyMember) {
                console.log(`Familien-Archivierung verarbeitet:`, familyResult);
            }
        } catch (familyErr) {
            console.error('Fehler bei Familien-Archivierungs-Verarbeitung (nicht kritisch):', familyErr);
        }

        res.json({
            success: true,
            message: 'Vertrag erfolgreich archiviert',
            familyUpdate: familyResult
        });
    } catch (err) {
        console.error('Fehler beim Archivieren des Vertrags:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// GET /api/vertraege/:id/pdf - Vertrag als PDF herunterladen
router.get('/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Lade Vertragsdaten (mit allen Feldern für vollständiges PDF)
        const vertragResults = await queryAsync(`
            SELECT v.*,
                   m.vorname, m.nachname, m.email, m.geburtsdatum,
                   m.strasse, m.hausnummer, m.plz, m.ort, m.telefon,
                   m.anrede, m.mitgliedsnummer,
                   m.iban, m.bic, m.bank,
                   t.name as tarif_name
            FROM vertraege v
            LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            WHERE v.id = ?
        `, [id]);

        if (vertragResults.length === 0) {
            return res.status(404).json({ error: 'Vertrag nicht gefunden' });
        }

        const vertrag = vertragResults[0];

        // 2. Lade Dojo-Daten
        const dojoResults = await queryAsync(`
            SELECT * FROM dojo WHERE id = ?
        `, [vertrag.dojo_id]);

        if (dojoResults.length === 0) {
            return res.status(404).json({ error: 'Dojo nicht gefunden' });
        }

        const dojo = dojoResults[0];

        // 3. Erstelle Mitgliedsdaten-Objekt (erweitert für vollständiges PDF)
        const mitgliedData = {
            vorname: vertrag.vorname,
            nachname: vertrag.nachname,
            email: vertrag.email,
            geburtsdatum: vertrag.geburtsdatum,
            strasse: vertrag.strasse,
            hausnummer: vertrag.hausnummer,
            plz: vertrag.plz,
            ort: vertrag.ort,
            telefon: vertrag.telefon,
            anrede: vertrag.anrede,
            mitgliedsnummer: vertrag.mitgliedsnummer,
            iban: vertrag.iban,
            bic: vertrag.bic,
            bank: vertrag.bank
        };

        // 4. Erstelle Vertragsdaten-Objekt (erweitert für vollständiges PDF)
        const vertragData = {
            vertragsnummer: vertrag.vertragsnummer,
            vertragsbeginn: vertrag.vertragsbeginn,
            vertragsende: vertrag.vertragsende,
            monatsbeitrag: vertrag.monatsbeitrag,
            billing_cycle: vertrag.billing_cycle,
            payment_method: vertrag.payment_method,
            mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate,
            kuendigungsfrist_monate: vertrag.kuendigungsfrist_monate,
            automatische_verlaengerung: vertrag.automatische_verlaengerung,
            verlaengerung_monate: vertrag.verlaengerung_monate,
            tarifname: vertrag.tarif_name,
            aufnahmegebuehr: vertrag.aufnahmegebuehr || 0
        };

        // 5. Generiere PDF - Versuche zuerst mit Template, sonst Fallback
        let pdfBuffer;

        try {
            // Versuche mit Template-System
            pdfBuffer = await generatePDFWithDefaultTemplate(
                vertrag.dojo_id,
                'vertrag',
                mitgliedData,
                vertragData
            );
        } catch (templateError) {
            // Fallback auf alte Generierung
            pdfBuffer = await generateCompleteVertragPDF(
                vertrag.dojo_id,
                mitgliedData,
                vertragData
            );
        }

        // 6. Sende PDF als Download
        const filename = `Vertrag_${vertrag.vertragsnummer || vertrag.id}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Fehler beim Generieren des PDFs:', err);
        res.status(500).json({ error: 'Fehler beim Generieren des PDFs', details: err.message });
    }
});

// GET /api/vertraege/dokumente/:dojo_id - AGB und Datenschutz für ein Dojo abrufen (ALLE Versionen)
router.get('/dokumente/:dojo_id', async (req, res) => {
    try {
        const { dojo_id } = req.params;
        const { aktiv_nur } = req.query;

        let whereClause = '';
        let queryParams = [];

        // Wenn "all" ausgewählt ist, zeige alle Dokumente von allen Dojos
        if (dojo_id === 'all') {
            whereClause = aktiv_nur === 'true' ? 'WHERE aktiv = TRUE' : '';
        } else {
            whereClause = 'WHERE dojo_id = ?';
            queryParams.push(parseInt(dojo_id));
            if (aktiv_nur === 'true') {
                whereClause += ' AND aktiv = TRUE';
            }
        }

        const dokumente = await queryAsync(`
            SELECT
                vd.id,
                vd.dojo_id,
                vd.dokumenttyp,
                vd.version,
                vd.titel,
                vd.inhalt,
                vd.gueltig_ab,
                vd.gueltig_bis,
                vd.aktiv,
                vd.erstellt_am,
                vd.aktualisiert_am,
                d.dojoname
            FROM vertragsdokumente vd
            LEFT JOIN dojo d ON vd.dojo_id = d.id
            ${whereClause}
            ORDER BY vd.dokumenttyp, vd.version DESC
        `, queryParams);
        res.json({ success: true, data: dokumente });
    } catch (err) {
        console.error('Fehler beim Abrufen der Dokumente:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/vertraege/dokumente - Neues Dokument/Version erstellen
router.post('/dokumente', async (req, res) => {
    try {
        const {
            dojo_id,
            dokumenttyp,
            version,
            titel,
            inhalt,
            gueltig_ab,
            gueltig_bis,
            aktiv,
            erstellt_von
        } = req.body;
        if (!dojo_id || !dokumenttyp || !version || !titel || !inhalt || !gueltig_ab) {
            return res.status(400).json({
                error: 'Fehlende Pflichtfelder',
                required: ['dojo_id', 'dokumenttyp', 'version', 'titel', 'inhalt', 'gueltig_ab']
            });
        }

        // Prüfe ob diese Version bereits existiert
        const existing = await queryAsync(`
            SELECT id FROM vertragsdokumente
            WHERE dojo_id = ? AND dokumenttyp = ? AND version = ?
        `, [dojo_id, dokumenttyp, version]);

        if (existing.length > 0) {
            return res.status(400).json({
                error: `Version ${version} für ${dokumenttyp} existiert bereits. Bitte wählen Sie eine andere Versionsnummer.`
            });
        }

        const result = await queryAsync(`
            INSERT INTO vertragsdokumente (
                dojo_id,
                dokumenttyp,
                version,
                titel,
                inhalt,
                gueltig_ab,
                gueltig_bis,
                aktiv,
                erstellt_von
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            parseInt(dojo_id),
            dokumenttyp,
            version,
            titel,
            inhalt,
            gueltig_ab,
            gueltig_bis || null,
            aktiv !== undefined ? aktiv : true,
            erstellt_von || null
        ]);
        res.json({
            success: true,
            data: {
                id: result.insertId,
                dojo_id,
                dokumenttyp,
                version,
                titel
            }
        });
    } catch (err) {
        console.error('Fehler beim Erstellen der Dokumentversion:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/vertraege/dokumente/:id - Dokumentversion aktualisieren
router.put('/dokumente/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titel,
            inhalt,
            gueltig_ab,
            gueltig_bis,
            aktiv,
            dojo_id
        } = req.body;
        // 🔒 SICHERHEITSCHECK: Prüfe ob Dokument zum richtigen Dojo gehört
        if (dojo_id) {
            const dokCheck = await queryAsync(`
                SELECT id, dojo_id FROM vertragsdokumente WHERE id = ?
            `, [id]);

            if (dokCheck.length === 0) {
                return res.status(404).json({ error: 'Dokument nicht gefunden' });
            }

            if (dokCheck[0].dojo_id !== parseInt(dojo_id)) {
                console.error(`SICHERHEITSVERLETZUNG: Versuch Dokument ${id} (Dojo ${dokCheck[0].dojo_id}) mit falschem dojo_id ${dojo_id} zu bearbeiten!`);
                return res.status(403).json({ error: 'Keine Berechtigung' });
            }
        }

        const updates = [];
        const values = [];

        if (titel !== undefined) { updates.push('titel = ?'); values.push(titel); }
        if (inhalt !== undefined) { updates.push('inhalt = ?'); values.push(inhalt); }
        if (gueltig_ab !== undefined) { updates.push('gueltig_ab = ?'); values.push(gueltig_ab); }
        if (gueltig_bis !== undefined) { updates.push('gueltig_bis = ?'); values.push(gueltig_bis || null); }
        if (aktiv !== undefined) { updates.push('aktiv = ?'); values.push(aktiv); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });
        }

        values.push(id);

        const result = await queryAsync(`
            UPDATE vertragsdokumente
            SET ${updates.join(', ')}
            WHERE id = ?
        `, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Dokument nicht gefunden' });
        }
        res.json({ success: true, message: 'Dokument erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Dokumentversion:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// GET /api/vertraege/:id/historie - Historie eines Vertrags abrufen
router.get('/:id/historie', async (req, res) => {
    try {
        const { id } = req.params;
        const { dojo_id } = req.query;
        // 🔒 SICHERHEITSCHECK: Prüfe ob Vertrag zum richtigen Dojo gehört
        if (dojo_id && dojo_id !== 'all') {
            const vertragCheck = await queryAsync(`
                SELECT id, dojo_id FROM vertraege WHERE id = ?
            `, [id]);

            if (vertragCheck.length === 0) {
                return res.status(404).json({ error: 'Vertrag nicht gefunden' });
            }

            if (vertragCheck[0].dojo_id !== parseInt(dojo_id)) {
                console.error(`SICHERHEITSVERLETZUNG: Versuch Historie von Vertrag ${id} (Dojo ${vertragCheck[0].dojo_id}) mit falschem dojo_id ${dojo_id} abzurufen!`);
                return res.status(403).json({ error: 'Keine Berechtigung' });
            }
        }

        const historie = await queryAsync(`
            SELECT
                id,
                aenderung_typ,
                aenderung_beschreibung,
                aenderung_details,
                geaendert_von,
                geaendert_am,
                ip_adresse
            FROM vertragshistorie
            WHERE vertrag_id = ?
            ORDER BY geaendert_am DESC
        `, [id]);
        res.json({ success: true, data: historie });
    } catch (err) {
        console.error('Fehler beim Abrufen der Historie:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/vertraege/:id/historie - Historie-Eintrag hinzufügen
router.post('/:id/historie', async (req, res) => {
    try {
        const { id } = req.params;
        const { aenderung_typ, aenderung_beschreibung, aenderung_details, geaendert_von, ip_adresse, dojo_id } = req.body;
        // 🔒 SICHERHEITSCHECK: Prüfe ob Vertrag zum richtigen Dojo gehört
        if (dojo_id && dojo_id !== 'all') {
            const vertragCheck = await queryAsync(`
                SELECT id, dojo_id FROM vertraege WHERE id = ?
            `, [id]);

            if (vertragCheck.length === 0) {
                return res.status(404).json({ error: 'Vertrag nicht gefunden' });
            }

            if (vertragCheck[0].dojo_id !== parseInt(dojo_id)) {
                console.error(`SICHERHEITSVERLETZUNG: Versuch Historie für Vertrag ${id} (Dojo ${vertragCheck[0].dojo_id}) mit falschem dojo_id ${dojo_id} zu erstellen!`);
                return res.status(403).json({ error: 'Keine Berechtigung' });
            }
        }

        const result = await queryAsync(`
            INSERT INTO vertragshistorie (vertrag_id, aenderung_typ, aenderung_beschreibung, aenderung_details, geaendert_von, ip_adresse)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, aenderung_typ, aenderung_beschreibung, aenderung_details ? JSON.stringify(aenderung_details) : null, geaendert_von || null, ip_adresse || null]);
        res.json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        console.error('Fehler beim Erstellen des Historie-Eintrags:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/vertraege/dokumente/:id/copy - Copy document to another dojo
router.post('/dokumente/:id/copy', async (req, res) => {
    try {
        const { id } = req.params;
        const { target_dojo_id } = req.body;

        if (!target_dojo_id) {
            return res.status(400).json({ error: 'target_dojo_id ist erforderlich' });
        }

        // Get the original document
        const original = await queryAsync(`
            SELECT * FROM vertragsdokumente WHERE id = ?
        `, [id]);

        if (original.length === 0) {
            return res.status(404).json({ error: 'Dokument nicht gefunden' });
        }

        const doc = original[0];

        // Check if document with same type and version already exists in target dojo
        const existing = await queryAsync(`
            SELECT id FROM vertragsdokumente
            WHERE dojo_id = ? AND dokumenttyp = ? AND version = ?
        `, [target_dojo_id, doc.dokumenttyp, doc.version]);

        if (existing.length > 0) {
            return res.status(400).json({
                error: `Dokument "${doc.titel}" (Version ${doc.version}) existiert bereits im Ziel-Dojo`
            });
        }

        // Copy the document
        const result = await queryAsync(`
            INSERT INTO vertragsdokumente (
                dojo_id,
                dokumenttyp,
                version,
                titel,
                inhalt,
                gueltig_ab,
                gueltig_bis,
                aktiv
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            target_dojo_id,
            doc.dokumenttyp,
            doc.version,
            doc.titel,
            doc.inhalt,
            doc.gueltig_ab,
            doc.gueltig_bis,
            doc.aktiv
        ]);

        res.json({
            success: true,
            message: `Dokument "${doc.titel}" erfolgreich kopiert`,
            data: { id: result.insertId }
        });
    } catch (err) {
        console.error('Fehler beim Kopieren des Dokuments:', err);
        res.status(500).json({ error: 'Fehler beim Kopieren', details: err.message });
    }
});

// POST /api/vertraege/dokumente/import-from-dojos - Import documents from dojo table
router.post('/dokumente/import-from-dojos', async (req, res) => {
    try {
        // Get all dojos with their document texts
        const dojos = await queryAsync(`
            SELECT
                id,
                dojoname,
                agb_text,
                dsgvo_text,
                dojo_regeln_text,
                hausordnung_text,
                haftungsausschluss_text,
                widerrufsbelehrung_text,
                impressum_text,
                vertragsbedingungen_text
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
                if (!dok.text || dok.text.trim() === '') {
                    continue; // Skip empty documents
                }

                // Check if document already exists
                const existing = await queryAsync(`
                    SELECT id FROM vertragsdokumente
                    WHERE dojo_id = ? AND dokumenttyp = ? AND version = '1.0'
                `, [dojo.id, dok.typ]);

                if (existing.length > 0) {
                    skipped++;
                    continue;
                }

                // Insert document
                await queryAsync(`
                    INSERT INTO vertragsdokumente (
                        dojo_id,
                        dokumenttyp,
                        version,
                        titel,
                        inhalt,
                        gueltig_ab,
                        aktiv
                    ) VALUES (?, ?, ?, ?, ?, CURDATE(), TRUE)
                `, [dojo.id, dok.typ, '1.0', dok.titel, dok.text]);

                imported++;
            }
        }

        res.json({
            success: true,
            message: `${imported} Dokumente importiert, ${skipped} übersprungen (bereits vorhanden)`,
            imported,
            skipped
        });
    } catch (err) {
        console.error('Fehler beim Import der Dokumente:', err);
        res.status(500).json({ error: 'Fehler beim Import', details: err.message });
    }
});

module.exports = router;
