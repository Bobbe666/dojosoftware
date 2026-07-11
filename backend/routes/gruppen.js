const express = require("express");
const db = require("../db");
const logger = require('../utils/logger');
const router = express.Router();
const { cacheGet } = require('../utils/simpleCache');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// 🔒 SICHERHEIT: Dieser Router war per Auto-Mount UNAUTHENTIFIZIERT erreichbar und
// las/schrieb Gruppen dojo-übergreifend (dojo_id wurde ignoriert). Ab jetzt: Login-Pflicht
// + Dojo-Scoping. Legacy-Gruppen (dojo_id=1, alter Default) bleiben sichtbar, bis zugeordnet.
router.use(authenticateToken);

// Alle Gruppen abrufen (eigene + Legacy dojo_id=1)
router.get("/", cacheGet(120000), (req, res) => {
  const dojoId = getSecureDojoId(req);
  const query = dojoId
    ? "SELECT gruppen_id, name, reihenfolge FROM gruppen WHERE dojo_id = ? OR dojo_id = 1 ORDER BY reihenfolge ASC, name ASC"
    : "SELECT gruppen_id, name, reihenfolge FROM gruppen ORDER BY reihenfolge ASC, name ASC";
  db.query(query, dojoId ? [dojoId] : [], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Gruppen:', { error: err });
      return res.status(500).json({ error: "Fehler beim Laden der Gruppen" });
    }
    res.json(results);
  });
});

// Neue Gruppe erstellen (im eigenen Dojo)
router.post("/", (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Gruppenname darf nicht leer sein" });
  }
  const dojoId = getSecureDojoId(req);
  const query = "INSERT INTO gruppen (name, dojo_id) VALUES (?, ?)";
  db.query(query, [name.trim(), dojoId || null], (err, result) => {
    if (err) {
      logger.error('Fehler beim Hinzufügen der Gruppe:', { error: err });
      return res.status(500).json({ error: "Gruppe konnte nicht hinzugefügt werden" });
    }
    res.status(201).json({ gruppen_id: result.insertId, name });
  });
});

// Gruppe bearbeiten (nur eigene oder Legacy)
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, reihenfolge } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Gruppenname darf nicht leer sein" });
  }
  const dojoId = getSecureDojoId(req);
  const query = dojoId
    ? "UPDATE gruppen SET name = ?, reihenfolge = ? WHERE gruppen_id = ? AND (dojo_id = ? OR dojo_id = 1)"
    : "UPDATE gruppen SET name = ?, reihenfolge = ? WHERE gruppen_id = ?";
  const params = dojoId ? [name.trim(), reihenfolge, id, dojoId] : [name.trim(), reihenfolge, id];
  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren der Gruppe:', { error: err });
      return res.status(500).json({ error: "Fehler beim Aktualisieren der Gruppe" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: "Gruppe nicht gefunden" });
    res.json({ gruppen_id: parseInt(id, 10), name });
  });
});

// Gruppe löschen (nur eigene oder Legacy)
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const dojoId = getSecureDojoId(req);
  const query = dojoId
    ? "DELETE FROM gruppen WHERE gruppen_id = ? AND (dojo_id = ? OR dojo_id = 1)"
    : "DELETE FROM gruppen WHERE gruppen_id = ?";
  const params = dojoId ? [id, dojoId] : [id];
  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen der Gruppe:', { error: err });
      return res.status(500).json({ error: "Gruppe konnte nicht gelöscht werden" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: "Gruppe nicht gefunden" });
    res.json({ message: "Gruppe gelöscht" });
  });
});

module.exports = router;
