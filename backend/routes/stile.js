const express = require("express");
const db = require("../db");
const router = express.Router();

// Alle Stile abrufen
router.get("/", (req, res) => {
  const query = "SELECT stil_id, name FROM stile ORDER BY name";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Fehler beim Abrufen der Stile:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Stile" });
    }
    res.json(results);
  });
});

// Einzelnen Stil abrufen
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT stil_id, name FROM stile WHERE stil_id = ?";
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Fehler beim Abrufen des Stils:", err);
      return res.status(500).json({ error: "Fehler beim Laden des Stils" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Stil nicht gefunden" });
    }
    res.json(results[0]);
  });
});

// Neuen Stil hinzufügen
router.post("/", (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Stilname darf nicht leer sein" });
  }

  const query = "INSERT INTO stile (name) VALUES (?)";
  db.query(query, [name.trim()], (err, result) => {
    if (err) {
      console.error("Fehler beim Hinzufügen des Stils:", err);
      return res.status(500).json({ error: "Stil konnte nicht hinzugefügt werden" });
    }
    res.status(201).json({ stil_id: result.insertId, name });
  });
});

// Stil aktualisieren
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Stilname darf nicht leer sein" });
  }

  const query = "UPDATE stile SET name = ? WHERE stil_id = ?";
  db.query(query, [name.trim(), id], (err, result) => {
    if (err) {
      console.error("Fehler beim Aktualisieren des Stils:", err);
      return res.status(500).json({ error: "Stil konnte nicht aktualisiert werden" });
    }
    res.json({ stil_id: parseInt(id, 10), name });
  });
});

// Stil löschen
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM stile WHERE stil_id = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Fehler beim Löschen des Stils:", err);
      return res.status(500).json({ error: "Stil konnte nicht gelöscht werden" });
    }
    res.json({ message: "Stil gelöscht" });
  });
});

module.exports = router;
