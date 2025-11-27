const express = require("express");
const db = require("../db");
const router = express.Router();

// Alle Trainer abrufen (inkl. Mehrfachzuordnung der Stile)
router.get("/", (req, res) => {

    const query = `
        SELECT t.trainer_id, t.vorname, t.nachname, t.email, t.telefon,
               COALESCE(GROUP_CONCAT(DISTINCT ts.stil ORDER BY ts.stil SEPARATOR ', '), '') AS stile
        FROM trainer t
        LEFT JOIN trainer_stile ts ON t.trainer_id = ts.trainer_id
        GROUP BY t.trainer_id, t.vorname, t.nachname, t.email, t.telefon
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Trainer:", err);
            return res.status(500).json({ error: "Fehler beim Laden der Trainer", details: err.sqlMessage });
        }

        res.json(results.map((trainer) => ({
            trainer_id: trainer.trainer_id,
            vorname: trainer.vorname,
            nachname: trainer.nachname,
            email: trainer.email,
            telefon: trainer.telefon,
            stile: trainer.stile ? trainer.stile.split(", ") : [],
        })));
    });
});

// Neuen Trainer hinzufügen (mit Transaktion)
router.post("/", (req, res) => {
    const { vorname, nachname, email, telefon, stile } = req.body;

    if (!vorname || !nachname) {
        return res.status(400).json({ error: "Vorname und Nachname erforderlich." });
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Datenbankverbindungsfehler:", err);
            return res.status(500).json({ error: "Fehler bei der Datenbankverbindung", details: err.sqlMessage });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                console.error("Fehler beim Starten der Transaktion:", err);
                return res.status(500).json({ error: "Fehler beim Hinzufügen des Trainers", details: err.sqlMessage });
            }

            // Trainer einfügen (ohne Stile)
            connection.query(
                "INSERT INTO trainer (vorname, nachname, email, telefon) VALUES (?, ?, ?, ?)",
                [vorname, nachname, email || '', telefon || ''],
                (err, result) => {
                    if (err) {
                        connection.rollback(() => connection.release());
                        console.error("Fehler beim Speichern des Trainers:", err);
                        return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                    }

                    const trainerId = result.insertId;
                    
                    // Wenn Stile vorhanden sind, diese auch einfügen
                    if (stile && Array.isArray(stile) && stile.length > 0) {
                        const stilInsert = stile.map((stil) => [trainerId, stil]);
                        
                        connection.query(
                            "INSERT INTO trainer_stile (trainer_id, stil) VALUES ?",
                            [stilInsert],
                            (err) => {
                                if (err) {

                                    // Aber Trainer trotzdem erfolgreich erstellen
                                }
                                
                                // Transaktion abschließen
                                connection.commit((err) => {
                                    if (err) {
                                        connection.rollback(() => connection.release());
                                        console.error("Fehler beim Abschließen der Transaktion:", err);
                                        return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                                    }

                                    connection.release();
                                    res.status(201).json({ trainer_id: trainerId, vorname, nachname, email, telefon, stile: stile || [] });
                                });
                            }
                        );
                    } else {
                        // Kein Stil - direkt abschließen
                        connection.commit((err) => {
                            if (err) {
                                connection.rollback(() => connection.release());
                                console.error("Fehler beim Abschließen der Transaktion:", err);
                                return res.status(500).json({ error: "Fehler beim Speichern des Trainers", details: err.sqlMessage });
                            }

                            connection.release();
                            res.status(201).json({ trainer_id: trainerId, vorname, nachname, email, telefon, stile: [] });
                        });
                    }
                }
            );
        });
    });
});

// Trainer löschen (inklusive verbundene Stile)
router.delete("/:id", (req, res) => {
    const trainerId = req.params.id;

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Fehler bei der Datenbankverbindung:", err);
            return res.status(500).json({ error: "Fehler bei der Datenbankverbindung", details: err.sqlMessage });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                console.error("Fehler beim Starten der Transaktion:", err);
                return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
            }

            // Schritt 1: Trainer-Stile löschen
            connection.query("DELETE FROM trainer_stile WHERE trainer_id = ?", [trainerId], (err) => {
                if (err) {
                    connection.rollback(() => connection.release());
                    console.error("Fehler beim Löschen der Stile:", err);
                    return res.status(500).json({ error: "Fehler beim Löschen der Stile", details: err.sqlMessage });
                }

                // Schritt 2: Trainer löschen
                connection.query("DELETE FROM trainer WHERE trainer_id = ?", [trainerId], (err, result) => {
                    if (err) {
                        connection.rollback(() => connection.release());
                        console.error("Fehler beim Löschen des Trainers:", err);
                        return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
                    }

                    connection.commit((err) => {
                        if (err) {
                            connection.rollback(() => connection.release());
                            console.error("Fehler beim Abschließen der Transaktion:", err);
                            return res.status(500).json({ error: "Fehler beim Löschen des Trainers", details: err.sqlMessage });
                        }

                        connection.release();
                        res.json({ success: true, message: "Trainer erfolgreich gelöscht" });
                    });
                });
            });
        });
    });
});

// ===================================================================
// NOTIFICATION RECIPIENTS (TEMP)
// ===================================================================

router.get('/notification-recipients', async (req, res) => {
  try {

    const db = require('../db');
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];

    // Hole Mitglieder mit Email
    try {
      memberEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'mitglied' as type
          FROM mitglieder 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      memberEmails = [];
    }

    // Hole Trainer mit Email
    try {
      trainerEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'trainer' as type
          FROM trainer 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      trainerEmails = [];
    }

    // Hole Personal mit Email
    try {
      personalEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'personal' as type
          FROM personal 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      personalEmails = [];
    }

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
      }
    });
  } catch (error) {
    console.error('Notification recipients error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Empfänger' });
  }
});

module.exports = router;
