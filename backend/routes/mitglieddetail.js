const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// Development mode check
const isDevelopment = process.env.NODE_ENV !== 'production';

// Mock data - shared from mitglieder.js
const MOCK_MITGLIEDER_DETAIL = {
  1: {
    mitglied_id: 1, id: 1,
    vorname: 'Max', nachname: 'Mustermann',
    geburtsdatum: '1990-05-15', geschlecht: 'männlich', gewicht: 75,
    gurtfarbe: 'Braun', dojo_id: 1, trainingsstunden: 150,
    email: 'max.mustermann@example.com', telefon: '0176 12345678', telefon_mobil: '0176 12345678',
    strasse: 'Musterstraße 1', plz: '12345', ort: 'Musterstadt', land: 'Deutschland',
    aktiv: 1, eintrittsdatum: '2020-01-15',
    allergien: null, notfallkontakt_name: 'Maria Mustermann', notfallkontakt_telefon: '0176 87654321',
    naechste_pruefung_datum: null, pruefungsgebuehr_bezahlt: 0,
    hausordnung_akzeptiert: 1, datenschutz_akzeptiert: 1, foto_einverstaendnis: 1,
    familien_id: null, rabatt_prozent: 0, foto_pfad: null,
    vertragsfrei: 0, vertragsfrei_grund: null
  },
  2: {
    mitglied_id: 2, id: 2,
    vorname: 'Lisa', nachname: 'Schmidt',
    geburtsdatum: '1995-08-22', geschlecht: 'weiblich', gewicht: 60,
    gurtfarbe: 'Schwarz', dojo_id: 1, trainingsstunden: 320,
    email: 'lisa.schmidt@example.com', telefon: '0151 23456789', telefon_mobil: '0151 23456789',
    strasse: 'Beispielweg 5', plz: '54321', ort: 'Beispielstadt', land: 'Deutschland',
    aktiv: 1, eintrittsdatum: '2018-03-10',
    allergien: null, notfallkontakt_name: 'Thomas Schmidt', notfallkontakt_telefon: '0151 98765432',
    naechste_pruefung_datum: null, pruefungsgebuehr_bezahlt: 0,
    hausordnung_akzeptiert: 1, datenschutz_akzeptiert: 1, foto_einverstaendnis: 1,
    familien_id: null, rabatt_prozent: 0, foto_pfad: null,
    vertragsfrei: 1, vertragsfrei_grund: 'Ehrenmitglied - langjährige Verdienste um den Verein'
  },
  3: {
    mitglied_id: 3, id: 3,
    vorname: 'Anna', nachname: 'Müller',
    geburtsdatum: '2005-12-03', geschlecht: 'weiblich', gewicht: 50,
    gurtfarbe: 'Grün', dojo_id: 1, trainingsstunden: 85,
    email: 'anna.mueller@example.com', telefon: '0162 34567890', telefon_mobil: '0162 34567890',
    strasse: 'Teststraße 10', plz: '67890', ort: 'Testdorf', land: 'Deutschland',
    aktiv: 1, eintrittsdatum: '2022-09-01',
    allergien: null, notfallkontakt_name: 'Peter Müller', notfallkontakt_telefon: '0162 09876543',
    naechste_pruefung_datum: '2025-12-15', pruefungsgebuehr_bezahlt: 1,
    hausordnung_akzeptiert: 1, datenschutz_akzeptiert: 1, foto_einverstaendnis: 1,
    familien_id: 1, rabatt_prozent: 10, foto_pfad: null,
    vertragsfrei: 0, vertragsfrei_grund: null
  },
  4: {
    mitglied_id: 4, id: 4,
    vorname: 'Tom', nachname: 'Weber',
    geburtsdatum: '1988-03-18', geschlecht: 'männlich', gewicht: 80,
    gurtfarbe: 'Blau', dojo_id: 1, trainingsstunden: 120,
    email: 'tom.weber@example.com', telefon: '0173 45678901', telefon_mobil: '0173 45678901',
    strasse: 'Demoallee 20', plz: '11111', ort: 'Democity', land: 'Deutschland',
    aktiv: 1, eintrittsdatum: '2021-06-20',
    allergien: 'Nussallergie', notfallkontakt_name: 'Sarah Weber', notfallkontakt_telefon: '0173 10987654',
    naechste_pruefung_datum: null, pruefungsgebuehr_bezahlt: 0,
    hausordnung_akzeptiert: 1, datenschutz_akzeptiert: 1, foto_einverstaendnis: 0,
    familien_id: null, rabatt_prozent: 0, foto_pfad: null,
    vertragsfrei: 0, vertragsfrei_grund: null
  }
};

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
    const mimetype = allowedTypes.test(file.mimetype);
    
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

  // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
  if (isDevelopment) {
    console.log(`🔧 Development Mode: Verwende Mock-Mitglied-Detail für ID ${id}`);
    const mockMitglied = MOCK_MITGLIEDER_DETAIL[id];
    if (mockMitglied) {
      return res.json(mockMitglied);
    } else {
      return res.status(404).json({ message: "Mitglied nicht gefunden." });
    }
  }

  // PRODUCTION MODE: Datenbank verwenden
  const query = "SELECT *, mitglied_id AS id, trainingsstunden, foto_pfad FROM mitglieder WHERE mitglied_id = ?";
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

  // 🔧 DEVELOPMENT MODE: Mock-Daten aktualisieren
  if (isDevelopment) {
    console.log(`🔧 Development Mode: Aktualisiere Mock-Mitglied ${id}`);
    const mockMitglied = MOCK_MITGLIEDER_DETAIL[id];
    if (!mockMitglied) {
      return res.status(404).json({ message: "Mitglied nicht gefunden." });
    }

    // Aktualisiere Mock-Daten im Speicher
    Object.assign(MOCK_MITGLIEDER_DETAIL[id], data);

    // Gebe die aktualisierten Daten zurück
    return res.json(MOCK_MITGLIEDER_DETAIL[id]);
  }

  // PRODUCTION MODE: Datenbank verwenden
  const updateQuery = "UPDATE mitglieder SET ? WHERE mitglied_id = ?";
  db.query(updateQuery, [data, id], (err, result) => {
    if (err) {
      console.error(`Fehler beim Aktualisieren des Mitglieds ${id}:`, err);
      return res.status(500).json({ error: "Fehler beim Aktualisieren des Mitglieds" });
    }

    // Nach dem Update: Den aktualisierten Datensatz abfragen und zurücksenden
    const selectQuery = "SELECT *, mitglied_id AS id, foto_pfad FROM mitglieder WHERE mitglied_id = ?";
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

module.exports = router;
