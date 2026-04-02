const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { generateMitgliedDetailPDF } = require("../services/mitgliedDetailPdfGenerator");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { validateUploadedImage } = require("../utils/fileUploadSecurity");

// Multer-Konfiguration für Foto-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/mitglieder');
    // Erstelle Upload-Verzeichnis falls es nicht existiert
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generiere eindeutigen Dateinamen: mitglied_[id]_[timestamp].[ext]
    const mitgliedId = req.params.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `mitglied_${mitgliedId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  },
  fileFilter: function (req, file, cb) {
    // Erlaube nur Bilddateien
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype && file.mimetype.startsWith('image/');
    
    logger.debug('📸 Foto-Upload:', { originalname: file.originalname, mimetype: file.mimetype, extname, mimetypeOK: mimetype });
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien (JPEG, PNG, GIF, WebP) sind erlaubt!'));
    }
  }
});

// API: Einzelnes Mitglied abrufen
router.get("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const dojoId = req.dojo_id;

  // SECURITY: Multi-Tenancy Check - nur Mitglieder des eigenen Dojos
  // Super-Admin (dojo_id = null): Kann Mitglieder aller zentral verwalteten Dojos sehen
  let whereClause = 'WHERE m.mitglied_id = ?';
  let queryParams = [id];

  if (dojoId === null || dojoId === undefined) {
    // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
    whereClause += ` AND m.dojo_id NOT IN (
      SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
    )`;
  } else {
    // Normaler Admin/User: Nur eigenes Dojo
    whereClause += ' AND m.dojo_id = ?';
    queryParams.push(dojoId);
  }

  const query = `
    SELECT
      m.*,
      m.mitglied_id AS id,
      m.trainingsstunden,
      m.foto_pfad,
      -- Aktuelle Graduierung aus mitglied_stil_data
      GROUP_CONCAT(
        DISTINCT CONCAT(
          s.name, ':',
          COALESCE(g.name, m.gurtfarbe)
        ) SEPARATOR '; '
      ) AS aktuelle_graduierungen
    FROM mitglieder m
    LEFT JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
    LEFT JOIN stile s ON msd.stil_id = s.stil_id
    LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
    ${whereClause}
    GROUP BY m.mitglied_id
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Mitglieds', {
        error: err.message,
        mitgliedId: id,
        dojoId,
      });
      return res.status(500).json({ error: "Fehler beim Laden des Mitglieds" });
    }
    if (results.length === 0) {
      logger.warn('Mitglied nicht gefunden oder Zugriff verweigert', {
        mitgliedId: id,
        dojoId,
        userId: req.user?.id,
      });
      return res.status(404).json({ message: "Mitglied nicht gefunden." });
    }

    res.json(results[0]);
  });
});

// API: Mitglied aktualisieren
router.put("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const dojoId = req.dojo_id;

  // Kopiere die Daten, damit wir sie manipulieren können
  let data = { ...req.body };

  // Entferne den Schlüssel "id", da er in der Tabelle nicht existiert
  if ("id" in data) {
    delete data.id;
  }

  logger.debug("Mitglied-Update", {
    mitgliedId: id,
    dojoId: dojoId || 'super_admin',
    fields: Object.keys(data),
  });

  // Entferne undefined/null Werte die Probleme verursachen könnten
  Object.keys(data).forEach(key => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });

  // Erlaubte Felder für Update (alle Spalten der mitglieder-Tabelle)
  // Dies verhindert SQL-Injection und Fehler durch nicht-existierende Spalten
  const allowedFields = [
    'vorname', 'nachname', 'geburtsdatum', 'geschlecht', 'gewicht', 'gurtfarbe', 'dojo_id',
    'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer', 'plz', 'ort',
    'iban', 'bic', 'bankname', 'kontoinhaber', 'zahlungsmethode', 'zahllaufgruppe',
    'eintrittsdatum', 'gekuendigt_am', 'aktiv', 'vertragsfrei', 'vertragsfrei_grund',
    'allergien', 'medizinische_hinweise', 'notfallkontakt_name', 'notfallkontakt_telefon', 'notfallkontakt_verhaeltnis',
    'notfallkontakt2_name', 'notfallkontakt2_telefon', 'notfallkontakt2_verhaeltnis',
    'notfallkontakt3_name', 'notfallkontakt3_telefon', 'notfallkontakt3_verhaeltnis',
    'naechste_pruefung_datum', 'pruefungsgebuehr_bezahlt', 'trainer_empfehlung',
    'hausordnung_akzeptiert', 'datenschutz_akzeptiert', 'foto_einverstaendnis', 'vereinsordnung_datum',
    'familien_id', 'rabatt_prozent', 'rabatt_grund',
    'vertreter1_typ', 'vertreter1_name', 'vertreter1_telefon', 'vertreter1_email',
    'vertreter2_typ', 'vertreter2_name', 'vertreter2_telefon', 'vertreter2_email',
    'notizen', 'newsletter_abo', 'marketing_quelle', 'bevorzugte_trainingszeiten',
    'online_portal_aktiv', 'kontostand', 'geworben_von_mitglied_id'
  ];

  // Filtere nur erlaubte Felder
  const filteredData = {};
  Object.keys(data).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredData[key] = data[key];
    } else {
      logger.warn('Feld wird ignoriert (nicht erlaubt)', { field: key });
    }
  });

  // SECURITY: Multi-Tenancy Check im UPDATE
  // Super-Admin (dojo_id = null): Kann Mitglieder aller zentral verwalteten Dojos bearbeiten
  let updateWhereClause = 'WHERE mitglied_id = ?';
  let updateParams = [filteredData, id];

  if (dojoId === null || dojoId === undefined) {
    // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
    updateWhereClause += ` AND dojo_id NOT IN (
      SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
    )`;
  } else {
    // Normaler Admin/User: Nur eigenes Dojo
    updateWhereClause += ' AND dojo_id = ?';
    updateParams.push(dojoId);
  }

  const updateQuery = `UPDATE mitglieder SET ? ${updateWhereClause}`;
  db.query(updateQuery, updateParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren des Mitglieds', {
        error: err.message,
        mitgliedId: id,
        dojoId: dojoId || 'super_admin',
      });
      return res.status(500).json({
        error: "Fehler beim Aktualisieren des Mitglieds",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    // Prüfe ob Datensatz überhaupt betroffen war (Tenant Check)
    if (result.affectedRows === 0) {
      logger.warn('Mitglied nicht gefunden oder Zugriff verweigert (UPDATE)', {
        mitgliedId: id,
        dojoId: dojoId || 'super_admin',
        userId: req.user?.id,
      });
      return res.status(404).json({ error: "Mitglied nicht gefunden oder Zugriff verweigert" });
    }

    // Nach dem Update: Den aktualisierten Datensatz abfragen und zurücksenden
    let selectWhereClause = 'WHERE m.mitglied_id = ?';
    let selectParams = [id];

    if (dojoId === null || dojoId === undefined) {
      // Super-Admin: Nur zentral verwaltete Dojos
      selectWhereClause += ` AND m.dojo_id NOT IN (
        SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
      )`;
    } else {
      // Normaler Admin/User: Nur eigenes Dojo
      selectWhereClause += ' AND m.dojo_id = ?';
      selectParams.push(dojoId);
    }

    const selectQuery = `
      SELECT
        m.*,
        m.mitglied_id AS id,
        m.foto_pfad,
        -- Aktuelle Graduierung aus mitglied_stil_data
        GROUP_CONCAT(
          DISTINCT CONCAT(
            s.name, ':',
            COALESCE(g.name, m.gurtfarbe)
          ) SEPARATOR '; '
        ) AS aktuelle_graduierungen
      FROM mitglieder m
      LEFT JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
      LEFT JOIN stile s ON msd.stil_id = s.stil_id
      LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
      ${selectWhereClause}
      GROUP BY m.mitglied_id
    `;

    db.query(selectQuery, selectParams, (err, results) => {
      if (err) {
        logger.error('Fehler beim Abrufen des aktualisierten Mitglieds', {
          error: err.message,
          mitgliedId: id,
          dojoId,
        });
        return res.status(500).json({ error: "Fehler beim Abrufen des aktualisierten Mitglieds" });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "Mitglied nicht gefunden." });
      }

      res.json(results[0]);
    });
  });
});

// API: Foto-Upload für Mitglied
router.post("/:id/foto", upload.single('foto'), (req, res) => {
  const { id } = req.params;

  if (!req.file) {

    return res.status(400).json({ error: "Keine Datei hochgeladen" });
  }

  // Speichere den relativen Pfad in der Datenbank
  const fotoPfad = `uploads/mitglieder/${req.file.filename}`;
  
  const updateQuery = "UPDATE mitglieder SET foto_pfad = ? WHERE mitglied_id = ?";

  db.query(updateQuery, [fotoPfad, id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Speichern des Foto-Pfads für Mitglied ${id}:', { error: err });
      // Lösche die hochgeladene Datei bei DB-Fehler
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) logger.error('Fehler beim Löschen der Datei:', { error: unlinkErr });
      });
      return res.status(500).json({ error: "Fehler beim Speichern des Fotos" });
    }

    if (result.affectedRows === 0) {

      // Lösche die hochgeladene Datei wenn Mitglied nicht gefunden
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) logger.error('Fehler beim Löschen der Datei:', { error: unlinkErr });
      });
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    res.json({ 
      success: true, 
      message: "Foto erfolgreich hochgeladen",
      fotoPfad: fotoPfad
    });
  });
});

// API: Foto löschen
router.delete("/:id/foto", (req, res) => {
  const { id } = req.params;

  // Hole den aktuellen Foto-Pfad
  const selectQuery = "SELECT foto_pfad FROM mitglieder WHERE mitglied_id = ?";
  db.query(selectQuery, [id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Foto-Pfads für Mitglied ${id}:', { error: err });
      return res.status(500).json({ error: "Fehler beim Abrufen des Fotos" });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }
    
    const fotoPfad = results[0].foto_pfad;
    
    if (!fotoPfad) {
      return res.status(404).json({ error: "Kein Foto vorhanden" });
    }
    
    // Lösche die Datei vom Server
    const fullPath = path.join(__dirname, '..', fotoPfad);
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        logger.error('Fehler beim Löschen der Datei:', { error: unlinkErr });
        // Fortfahren auch wenn Datei nicht gelöscht werden konnte
      }
    });
    
    // Entferne den Pfad aus der Datenbank
    const updateQuery = "UPDATE mitglieder SET foto_pfad = NULL WHERE mitglied_id = ?";
    db.query(updateQuery, [id], (err, result) => {
      if (err) {
        logger.error('Fehler beim Entfernen des Foto-Pfads für Mitglied ${id}:', { error: err });
        return res.status(500).json({ error: "Fehler beim Entfernen des Fotos" });
      }

      res.json({
        success: true,
        message: "Foto erfolgreich gelöscht"
      });
    });
  });
});

// API: PDF-Export für Mitglied
router.post("/:id/pdf", async (req, res) => {
  const { id } = req.params;
  const { save_to_db = false } = req.body;

  try {
    logger.debug('📄 Starte PDF-Generierung für Mitglied ${id}...');

    // PDF generieren
    const pdfBuffer = await generateMitgliedDetailPDF(id, { save_to_db });

    // Response Headers setzen
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Mitglied_${id}_Details.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // PDF als Buffer zurücksenden
    res.send(pdfBuffer);

    logger.info('PDF erfolgreich gesendet für Mitglied ${id} (${pdfBuffer.length} bytes)');

  } catch (error) {
    logger.error('Fehler bei PDF-Generierung für Mitglied ${id}:', error);
    res.status(500).json({
      error: "PDF-Generierung fehlgeschlagen",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API: Allergie archivieren (soft delete)
router.put("/:id/archive-allergie", (req, res) => {
  const { id } = req.params;
  const { allergieId } = req.body;

  logger.debug('Archive-Allergie Request:', { id, allergieId, body: req.body });

  if (!allergieId && allergieId !== 0) {
    logger.error('Allergie-ID fehlt oder ist undefined');
    return res.status(400).json({ error: "Allergie-ID fehlt" });
  }

  // Hole aktuelles Mitglied mit allergien und allergien_archiv
  const selectQuery = "SELECT allergien, allergien_archiv FROM mitglieder WHERE mitglied_id = ?";

  db.query(selectQuery, [id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Mitglieds ${id}:', { error: err });
      return res.status(500).json({ error: "Fehler beim Abrufen des Mitglieds" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    const mitglied = results[0];

    // Parse aktuelle Allergien (als Semikolon-getrennte Strings gespeichert)
    let allergien = [];
    if (mitglied.allergien) {
      // Allergien sind als "Allergie1; Allergie2; Allergie3" gespeichert
      const allergienArray = mitglied.allergien.split(';').filter(a => a.trim());
      allergien = allergienArray.map((allergie, index) => ({
        id: index,
        value: allergie.trim()
      }));
    }

    // Finde die zu archivierende Allergie
    // Konvertiere allergieId zu Number für korrekten Vergleich
    const allergieIdNum = parseInt(allergieId);
    const allergieIndex = allergien.findIndex(a => a.id === allergieIdNum);
    if (allergieIndex === -1) {
      return res.status(404).json({ error: "Allergie nicht gefunden" });
    }

    const allergieToArchive = allergien[allergieIndex];

    // Entferne aus aktuellen Allergien
    allergien.splice(allergieIndex, 1);

    // Parse Archiv
    let archiv = [];
    try {
      archiv = mitglied.allergien_archiv ? JSON.parse(mitglied.allergien_archiv) : [];
    } catch (e) {
      logger.error('Fehler beim Parsen von allergien_archiv:', { error: e });
      archiv = [];
    }

    // Füge gelöschte Allergie mit Zeitstempel zum Archiv hinzu
    archiv.push({
      ...allergieToArchive,
      geloescht_am: new Date().toISOString(),
      geloescht_am_readable: new Date().toLocaleString('de-DE')
    });

    // Update Datenbank
    // Allergien als Semikolon-getrennte Strings speichern
    const allergienString = allergien.length > 0
      ? allergien.map(a => a.value).join('; ')
      : '';

    const updateQuery = "UPDATE mitglieder SET allergien = ?, allergien_archiv = ? WHERE mitglied_id = ?";

    db.query(updateQuery, [allergienString, JSON.stringify(archiv), id], (err, result) => {
      if (err) {
        logger.error('Fehler beim Archivieren der Allergie für Mitglied ${id}:', { error: err });
        return res.status(500).json({ error: "Fehler beim Archivieren der Allergie" });
      }

      logger.info('Allergie archiviert', { allergie: allergieToArchive.value, mitglied_id: id });

      res.json({
        success: true,
        message: "Allergie erfolgreich archiviert",
        allergien: allergien,
        allergien_archiv: archiv
      });
    });
  });
});

// ===================================================================
// 👨‍👩‍👧 FAMILIENMITGLIEDER ABRUFEN
// ===================================================================
router.get("/:id/familie", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const dojoId = req.dojo_id;

  logger.info('👨‍👩‍👧 Familie-API aufgerufen', { mitglied_id: id, dojo_id: dojoId });

  try {
    // 1. Hole familien_id des Mitglieds
    let familienQuery = 'SELECT familien_id FROM mitglieder WHERE mitglied_id = ?';
    const queryParams = [id];

    if (dojoId) {
      familienQuery += ' AND dojo_id = ?';
      queryParams.push(dojoId);
    }

    db.query(familienQuery, queryParams, (err, results) => {
      if (err) {
        logger.error('Fehler beim Abrufen der familien_id:', err);
        return res.status(500).json({ error: "Fehler beim Abrufen der Familiendaten" });
      }

      logger.info('👨‍👩‍👧 Query Result:', { results_length: results.length, first_result: results[0] });

      if (results.length === 0) {
        logger.warn('👨‍👩‍👧 Mitglied nicht gefunden', { mitglied_id: id });
        return res.status(404).json({ error: "Mitglied nicht gefunden" });
      }

      const familienId = results[0].familien_id;
      logger.info('👨‍👩‍👧 familien_id gefunden:', { familienId });

      if (!familienId) {
        logger.info('👨‍👩‍👧 Keine familien_id, return empty');
        return res.json({
          familien_id: null,
          familienmitglieder: []
        });
      }

      // 2. Hole alle Familienmitglieder mit gleicher familien_id
      let membersQuery = `
        SELECT
          m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.email, m.telefon,
          m.familien_id, m.rabatt_prozent, m.rabatt_grund,
          m.vertreter1_typ, m.vertreter1_name, m.vertreter1_email, m.vertreter1_telefon,
          TIMESTAMPDIFF(YEAR, m.geburtsdatum, CURDATE()) AS alter_jahre,
          v.status AS vertrag_status,
          t.name AS tarif_name
        FROM mitglieder m
        LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
        LEFT JOIN tarife t ON v.tarif_id = t.id
        WHERE m.familien_id = ?
      `;
      const membersParams = [familienId];

      if (dojoId) {
        membersQuery += ' AND m.dojo_id = ?';
        membersParams.push(dojoId);
      }

      membersQuery += ' ORDER BY m.mitglied_id ASC';

      db.query(membersQuery, membersParams, (err2, members) => {
        if (err2) {
          logger.error('Fehler beim Abrufen der Familienmitglieder:', err2);
          return res.status(500).json({ error: "Fehler beim Abrufen der Familienmitglieder" });
        }

        logger.info(`👨‍👩‍👧 ${members.length} Familienmitglieder gefunden für familien_id ${familienId}`);

        res.json({
          familien_id: familienId,
          familienmitglieder: members.map(m => ({
            ...m,
            ist_minderjaehrig: m.alter_jahre !== null && m.alter_jahre < 18
          }))
        });
      });
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Familienmitglieder:', error);
    res.status(500).json({ error: "Fehler beim Abrufen der Familienmitglieder" });
  }
});

module.exports = router;
