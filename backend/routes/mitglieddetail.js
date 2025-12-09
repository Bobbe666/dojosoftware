const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

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
          s.stil_name, ':',
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

  // Datenbank verwenden
  const updateQuery = "UPDATE mitglieder SET ? WHERE mitglied_id = ?";
  db.query(updateQuery, [data, id], (err, result) => {
    if (err) {
      console.error(`Fehler beim Aktualisieren des Mitglieds ${id}:`, err);
      return res.status(500).json({ error: "Fehler beim Aktualisieren des Mitglieds" });
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
            s.stil_name, ':',
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

module.exports = router;
