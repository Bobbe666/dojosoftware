const express = require("express");
const db = require("../db");
const router = express.Router();

// Alle Gruppen abrufen
router.get("/", (req, res) => {
  const query = "SELECT gruppen_id, name FROM gruppen ORDER BY name";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Fehler beim Abrufen der Gruppen:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Gruppen" });
    }
    res.json(results);
  });
});

// Neue Gruppe erstellen
router.post("/", (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Gruppenname darf nicht leer sein" });
  }

  const query = "INSERT INTO gruppen (name) VALUES (?)";
  db.query(query, [name.trim()], (err, result) => {
    if (err) {
      console.error("Fehler beim Hinzufügen der Gruppe:", err);
      return res.status(500).json({ error: "Gruppe konnte nicht hinzugefügt werden" });
    }
    res.status(201).json({ gruppen_id: result.insertId, name });
  });
});

// Gruppe bearbeiten
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Gruppenname darf nicht leer sein" });
  }

  const query = "UPDATE gruppen SET name = ? WHERE gruppen_id = ?";
  db.query(query, [name.trim(), id], (err, result) => {
    if (err) {
      console.error("Fehler beim Aktualisieren der Gruppe:", err);
      return res.status(500).json({ error: "Fehler beim Aktualisieren der Gruppe" });
    }
    res.json({ gruppen_id: parseInt(id, 10), name });
  });
});

// Gruppe löschen
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM gruppen WHERE gruppen_id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Fehler beim Löschen der Gruppe:", err);
      return res.status(500).json({ error: "Gruppe konnte nicht gelöscht werden" });
    }
    res.json({ message: "Gruppe gelöscht" });
  });
});

module.exports = router;