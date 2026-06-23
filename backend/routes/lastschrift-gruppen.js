/**
 * Lastschrift-Gruppen API
 * Pro-Dojo definierbare Lastschrift-Gruppen mit festem Einzugstag.
 * Mitglieder werden ueber mitglieder.zahllaufgruppe = gruppe_key zugeordnet.
 */
const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const { getSecureDojoId, isSuperAdmin } = require("../middleware/tenantSecurity");
const router = express.Router();

function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// Slug aus Name erzeugen (a-z0-9_), Fallback "gruppe"
function makeKey(name) {
    const base = String(name || "")
        .toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .normalize("NFD").replace(/[̀-ͯ]/g, "") // restliche Diakritika entfernen
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
    return base || "gruppe";
}

/**
 * GET /api/lastschrift-gruppen  -> Gruppen des Dojos
 */
router.get("/", async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) return res.status(400).json({ error: "Dojo ID erforderlich" });

        const gruppen = await queryAsync(
            `SELECT g.*,
                    (SELECT COUNT(*) FROM mitglieder m
                      WHERE m.dojo_id = g.dojo_id
                        AND COALESCE(NULLIF(m.zahllaufgruppe,''),'monatsanfang') = g.gruppe_key) AS anzahl_mitglieder
               FROM lastschrift_gruppen g
              WHERE g.dojo_id = ?
              ORDER BY g.reihenfolge ASC, g.einzugstag ASC`,
            [dojoId]
        );

        res.json({ success: true, count: gruppen.length, gruppen });
    } catch (error) {
        logger.error("Fehler beim Laden der Lastschrift-Gruppen:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * POST /api/lastschrift-gruppen  -> Gruppe anlegen
 */
router.post("/", async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) return res.status(400).json({ error: "Dojo ID erforderlich" });

        const { name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, reihenfolge } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ error: "Name ist erforderlich" });
        const tag = parseInt(einzugstag, 10);
        if (!tag || tag < 1 || tag > 28) return res.status(400).json({ error: "Einzugstag muss zwischen 1 und 28 liegen" });

        // Eindeutigen gruppe_key erzeugen
        let key = makeKey(name);
        const existing = await queryAsync(
            "SELECT gruppe_key FROM lastschrift_gruppen WHERE dojo_id = ? AND gruppe_key LIKE ?",
            [dojoId, key + "%"]
        );
        if (existing.some(r => r.gruppe_key === key)) {
            let i = 2;
            while (existing.some(r => r.gruppe_key === `${key}_${i}`)) i++;
            key = `${key}_${i}`;
        }

        const result = await queryAsync(
            `INSERT INTO lastschrift_gruppen
                (dojo_id, gruppe_key, name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, reihenfolge)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                dojoId, key, name.trim(), tag,
                fenster_von || null, fenster_bis || null,
                typ === "extra" ? "extra" : "periodisch",
                ist_standard ? 1 : 0,
                Number.isInteger(reihenfolge) ? reihenfolge : 99
            ]
        );

        // Genau ein Standard pro Dojo
        if (ist_standard) {
            await queryAsync(
                "UPDATE lastschrift_gruppen SET ist_standard = 0 WHERE dojo_id = ? AND id <> ?",
                [dojoId, result.insertId]
            );
        }

        logger.info(`Lastschrift-Gruppe erstellt: ${name} (${key}) fuer Dojo ${dojoId}`);
        res.json({ success: true, id: result.insertId, gruppe_key: key });
    } catch (error) {
        logger.error("Fehler beim Erstellen der Lastschrift-Gruppe:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * PUT /api/lastschrift-gruppen/:id  -> Gruppe aktualisieren
 */
router.put("/:id", async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) return res.status(400).json({ error: "Dojo ID erforderlich" });
        const { id } = req.params;

        const rows = await queryAsync(
            "SELECT id, dojo_id, ist_standard FROM lastschrift_gruppen WHERE id = ? AND dojo_id = ?",
            [id, dojoId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Gruppe nicht gefunden" });

        const { name, einzugstag, fenster_von, fenster_bis, typ, ist_standard, aktiv, reihenfolge } = req.body;

        if (einzugstag !== undefined) {
            const tag = parseInt(einzugstag, 10);
            if (!tag || tag < 1 || tag > 28) return res.status(400).json({ error: "Einzugstag muss zwischen 1 und 28 liegen" });
        }

        await queryAsync(
            `UPDATE lastschrift_gruppen SET
                name = COALESCE(?, name),
                einzugstag = COALESCE(?, einzugstag),
                fenster_von = ?,
                fenster_bis = ?,
                typ = COALESCE(?, typ),
                ist_standard = COALESCE(?, ist_standard),
                aktiv = COALESCE(?, aktiv),
                reihenfolge = COALESCE(?, reihenfolge)
             WHERE id = ? AND dojo_id = ?`,
            [
                name !== undefined ? name : null,
                einzugstag !== undefined ? parseInt(einzugstag, 10) : null,
                fenster_von !== undefined ? (fenster_von || null) : null,
                fenster_bis !== undefined ? (fenster_bis || null) : null,
                typ !== undefined ? (typ === "extra" ? "extra" : "periodisch") : null,
                ist_standard !== undefined ? (ist_standard ? 1 : 0) : null,
                aktiv !== undefined ? (aktiv ? 1 : 0) : null,
                Number.isInteger(reihenfolge) ? reihenfolge : null,
                id, dojoId
            ]
        );

        // Wenn als Standard gesetzt: alle anderen zuruecksetzen + Zielgruppe auf 1
        if (ist_standard) {
            await queryAsync("UPDATE lastschrift_gruppen SET ist_standard = 0 WHERE dojo_id = ? AND id <> ?", [dojoId, id]);
            await queryAsync("UPDATE lastschrift_gruppen SET ist_standard = 1 WHERE dojo_id = ? AND id = ?", [dojoId, id]);
        }

        // Einzugstag der Gruppe auf zugehoerige automatische Zeitplaene durchziehen
        if (einzugstag !== undefined) {
            const [grp] = await queryAsync("SELECT gruppe_key FROM lastschrift_gruppen WHERE id = ?", [id]);
            if (grp) {
                await queryAsync(
                    "UPDATE lastschrift_zeitplaene SET ausfuehrungstag = ? WHERE dojo_id = ? AND gruppe_key = ?",
                    [parseInt(einzugstag, 10), dojoId, grp.gruppe_key]
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        logger.error("Fehler beim Aktualisieren der Lastschrift-Gruppe:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * DELETE /api/lastschrift-gruppen/:id
 * Standard-Gruppe kann nicht geloescht werden. Zugeordnete Mitglieder werden
 * vorher auf die Standard-Gruppe zurueckgesetzt.
 */
router.delete("/:id", async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) return res.status(400).json({ error: "Dojo ID erforderlich" });
        const { id } = req.params;

        const rows = await queryAsync(
            "SELECT id, gruppe_key, ist_standard FROM lastschrift_gruppen WHERE id = ? AND dojo_id = ?",
            [id, dojoId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Gruppe nicht gefunden" });
        if (rows[0].ist_standard) return res.status(400).json({ error: "Die Standard-Gruppe kann nicht geloescht werden" });

        const [std] = await queryAsync(
            "SELECT gruppe_key FROM lastschrift_gruppen WHERE dojo_id = ? AND ist_standard = 1 LIMIT 1",
            [dojoId]
        );
        const stdKey = std ? std.gruppe_key : "monatsanfang";

        // Zugeordnete Mitglieder auf Standard zuruecksetzen
        await queryAsync(
            "UPDATE mitglieder SET zahllaufgruppe = ? WHERE dojo_id = ? AND zahllaufgruppe = ?",
            [stdKey, dojoId, rows[0].gruppe_key]
        );
        // Gruppenspezifische Zeitplaene entkoppeln (auf "alle Gruppen" stellen)
        await queryAsync(
            "UPDATE lastschrift_zeitplaene SET gruppe_key = NULL WHERE dojo_id = ? AND gruppe_key = ?",
            [dojoId, rows[0].gruppe_key]
        );
        await queryAsync("DELETE FROM lastschrift_gruppen WHERE id = ? AND dojo_id = ?", [id, dojoId]);

        logger.info(`Lastschrift-Gruppe geloescht: ${rows[0].gruppe_key} (Dojo ${dojoId}), Mitglieder -> ${stdKey}`);
        res.json({ success: true, mitglieder_umgezogen_auf: stdKey });
    } catch (error) {
        logger.error("Fehler beim Loeschen der Lastschrift-Gruppe:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

module.exports = router;
