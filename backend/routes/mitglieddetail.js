const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { generateMitgliedDetailPDF } = require("../services/mitgliedDetailPdfGenerator");

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
    
    console.log('📸 Foto-Upload:', { originalname: file.originalname, mimetype: file.mimetype, extname, mimetypeOK: mimetype });
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien (JPEG, PNG, GIF, WebP) sind erlaubt!'));
    }
  }
});

// API: Einzelnes Mitglied abrufen
router.get("/:id", (req, res) => {
  const { id } = req.params;

  // Datenbank verwenden - hole Mitgliedsdaten UND aktuelle Graduierung
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
    WHERE m.mitglied_id = ?
    GROUP BY m.mitglied_id
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error(`Fehler beim Abrufen des Mitglieds ${id}:`, err);
      return res.status(500).json({ error: "Fehler beim Laden des Mitglieds" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Mitglied nicht gefunden." });
    }

    res.json(results[0]);
  });
});

// API: Mitglied aktualisieren
router.put("/:id", (req, res) => {
  const { id } = req.params;
  // Kopiere die Daten, damit wir sie manipulieren können
  let data = { ...req.body };

  // Entferne den Schlüssel "id", da er in der Tabelle nicht existiert
  if ("id" in data) {
    delete data.id;
  }

  console.log("Empfangene Felder:", Object.keys(data));
  console.log("Vertreter-Daten:", {
    vertreter1_typ: data.vertreter1_typ,
    vertreter2_typ: data.vertreter2_typ,
    vertreter1_name: data.vertreter1_name,
    vertreter2_name: data.vertreter2_name
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
      console.warn(`⚠️ Feld "${key}" wird ignoriert (nicht in erlaubten Feldern)`);
    }
  });

  console.log("Gefilterte Felder für Update:", Object.keys(filteredData));

  // Datenbank verwenden
  const updateQuery = "UPDATE mitglieder SET ? WHERE mitglied_id = ?";
  db.query(updateQuery, [filteredData, id], (err, result) => {
    if (err) {
      console.error(`Fehler beim Aktualisieren des Mitglieds ${id}:`, err);
      console.error(`Fehler-Details:`, err.message);
      console.error(`SQL State:`, err.sqlState);
      console.error(`SQL Message:`, err.sqlMessage);
      console.error(`Gesendete Daten:`, JSON.stringify(data, null, 2));
      return res.status(500).json({ 
        error: "Fehler beim Aktualisieren des Mitglieds",
        details: err.message,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage
      });
    }

    // Nach dem Update: Den aktualisierten Datensatz abfragen und zurücksenden
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
      WHERE m.mitglied_id = ?
      GROUP BY m.mitglied_id
    `;

    db.query(selectQuery, [id], (err, results) => {
      if (err) {
        console.error(`Fehler beim Abrufen des aktualisierten Mitglieds ${id}:`, err);
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
      console.error(`Fehler beim Speichern des Foto-Pfads für Mitglied ${id}:`, err);
      // Lösche die hochgeladene Datei bei DB-Fehler
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Fehler beim Löschen der Datei:', unlinkErr);
      });
      return res.status(500).json({ error: "Fehler beim Speichern des Fotos" });
    }

    if (result.affectedRows === 0) {

      // Lösche die hochgeladene Datei wenn Mitglied nicht gefunden
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Fehler beim Löschen der Datei:', unlinkErr);
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
      console.error(`Fehler beim Abrufen des Foto-Pfads für Mitglied ${id}:`, err);
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
        console.error('Fehler beim Löschen der Datei:', unlinkErr);
        // Fortfahren auch wenn Datei nicht gelöscht werden konnte
      }
    });
    
    // Entferne den Pfad aus der Datenbank
    const updateQuery = "UPDATE mitglieder SET foto_pfad = NULL WHERE mitglied_id = ?";
    db.query(updateQuery, [id], (err, result) => {
      if (err) {
        console.error(`Fehler beim Entfernen des Foto-Pfads für Mitglied ${id}:`, err);
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
    console.log(`📄 Starte PDF-Generierung für Mitglied ${id}...`);

    // PDF generieren
    const pdfBuffer = await generateMitgliedDetailPDF(id, { save_to_db });

    // Response Headers setzen
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Mitglied_${id}_Details.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // PDF als Buffer zurücksenden
    res.send(pdfBuffer);

    console.log(`✅ PDF erfolgreich gesendet für Mitglied ${id} (${pdfBuffer.length} bytes)`);

  } catch (error) {
    console.error(`❌ Fehler bei PDF-Generierung für Mitglied ${id}:`, error);
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

  console.log('🔍 Archive-Allergie Request:', { id, allergieId, body: req.body });

  if (!allergieId && allergieId !== 0) {
    console.error('❌ Allergie-ID fehlt oder ist undefined');
    return res.status(400).json({ error: "Allergie-ID fehlt" });
  }

  // Hole aktuelles Mitglied mit allergien und allergien_archiv
  const selectQuery = "SELECT allergien, allergien_archiv FROM mitglieder WHERE mitglied_id = ?";

  db.query(selectQuery, [id], (err, results) => {
    if (err) {
      console.error(`Fehler beim Abrufen des Mitglieds ${id}:`, err);
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
      console.error("Fehler beim Parsen von allergien_archiv:", e);
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
        console.error(`Fehler beim Archivieren der Allergie für Mitglied ${id}:`, err);
        return res.status(500).json({ error: "Fehler beim Archivieren der Allergie" });
      }

      console.log(`✅ Allergie "${allergieToArchive.value}" für Mitglied ${id} archiviert`);

      res.json({
        success: true,
        message: "Allergie erfolgreich archiviert",
        allergien: allergien,
        allergien_archiv: archiv
      });
    });
  });
});

module.exports = router;
