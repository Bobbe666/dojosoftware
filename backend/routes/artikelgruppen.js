const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================================================
// ARTIKELGRUPPEN ROUTES - KAMPFSPORT-SPEZIFISCH
// Multi-Tenancy: Jede Anfrage muss dojo_id haben
// =====================================================================================

// Helper: Hole dojo_id aus verschiedenen Quellen
const getDojoId = (req) => {
    return req.tenant?.dojo_id || req.user?.dojo_id || req.query.dojo_id || null;
};

// Helper: Hole alle Dojos eines Users aus admin_user_dojos
const getUserDojos = async (userId) => {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT dojo_id FROM admin_user_dojos WHERE admin_user_id = ?',
            [userId],
            (error, results) => {
                if (error) reject(error);
                else resolve(results.map(r => r.dojo_id));
            }
        );
    });
};

// Helper: Prüfe ob Zugriff erlaubt (mit Multi-Dojo-Support)
const checkAccess = async (req, res) => {
    // 1. Versuche dojo_id aus Token oder Query zu holen
    let dojo_id = getDojoId(req);

    // 2. Falls keine dojo_id, prüfe ob User mehrere Dojos hat
    if (!dojo_id && req.user?.id) {
        const userDojos = await getUserDojos(req.user.id);

        if (userDojos.length === 0) {
            res.status(403).json({
                error: 'Kein Zugriff - keine Dojo-Zuordnung',
                message: 'Sie sind keinem Dojo zugeordnet.'
            });
            return null;
        }

        // Wenn Query-Parameter dojo_id vorhanden, validieren
        if (req.query.dojo_id) {
            const requestedDojo = parseInt(req.query.dojo_id);
            if (!userDojos.includes(requestedDojo)) {
                res.status(403).json({
                    error: 'Kein Zugriff auf dieses Dojo',
                    message: 'Sie haben keinen Zugriff auf das angeforderte Dojo.'
                });
                return null;
            }
            dojo_id = requestedDojo;
        } else {
            // Kein dojo_id angegeben - nimm das erste zugeordnete Dojo
            dojo_id = userDojos[0];
        }
    }

    if (!dojo_id) {
        res.status(403).json({
            error: 'Kein Zugriff - dojo_id erforderlich',
            message: 'Sie müssen eingeloggt sein und einem Dojo zugeordnet sein.'
        });
        return null;
    }

    return dojo_id;
};

// ============================================
// ALLE ARTIKELGRUPPEN ABRUFEN (HIERARCHISCH)
// ============================================
router.get('/', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const query = `
            SELECT
                ag.id,
                ag.dojo_id,
                ag.name,
                ag.beschreibung,
                ag.parent_id,
                ag.sortierung,
                ag.aktiv,
                ag.icon,
                ag.farbe,
                CASE
                    WHEN ag.parent_id IS NULL THEN 'Hauptkategorie'
                    ELSE 'Unterkategorie'
                END AS typ,
                CASE
                    WHEN ag.parent_id IS NULL THEN ag.name
                    ELSE CONCAT(pag.name, ' -> ', ag.name)
                END AS vollstaendiger_name,
                0 AS artikel_anzahl,
                ag.erstellt_am,
                ag.aktualisiert_am
            FROM artikelgruppen ag
            LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
            WHERE ag.aktiv = TRUE AND ag.dojo_id = ?
            ORDER BY
                COALESCE(ag.parent_id, ag.id),
                ag.sortierung,
                ag.name
        `;

        const gruppen = await new Promise((resolve, reject) => {
            db.query(query, [dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        const hauptkategorien = gruppen.filter(g => g.parent_id === null);
        const unterkategorien = gruppen.filter(g => g.parent_id !== null);

        const strukturierteGruppen = hauptkategorien.map(haupt => ({
            ...haupt,
            unterkategorien: unterkategorien
                .filter(unter => unter.parent_id === haupt.id)
                .sort((a, b) => a.sortierung - b.sortierung)
        }));

        res.json({
            success: true,
            data: strukturierteGruppen,
            statistik: {
                hauptkategorien: hauptkategorien.length,
                unterkategorien: unterkategorien.length,
                gesamt: gruppen.length
            }
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Artikelgruppen:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Artikelgruppen',
            error: error.message
        });
    }
});

// ============================================
// NUR HAUPTKATEGORIEN ABRUFEN
// ============================================
router.get('/hauptkategorien', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const query = `
            SELECT
                ag.*,
                0 AS artikel_anzahl,
                (SELECT COUNT(*) FROM artikelgruppen u WHERE u.parent_id = ag.id AND u.aktiv = TRUE AND u.dojo_id = ?) AS unterkategorien_anzahl
            FROM artikelgruppen ag
            WHERE ag.parent_id IS NULL AND ag.aktiv = TRUE AND ag.dojo_id = ?
            ORDER BY ag.sortierung, ag.name
        `;

        const hauptkategorien = await new Promise((resolve, reject) => {
            db.query(query, [dojo_id, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.json({
            success: true,
            data: hauptkategorien
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Hauptkategorien:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Hauptkategorien',
            error: error.message
        });
    }
});

// ============================================
// UNTERKATEGORIEN EINER HAUPTKATEGORIE ABRUFEN
// ============================================
router.get('/unterkategorien/:parentId', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const { parentId } = req.params;

        const query = `
            SELECT
                ag.*,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            WHERE ag.parent_id = ? AND ag.aktiv = TRUE AND ag.dojo_id = ?
            ORDER BY ag.sortierung, ag.name
        `;

        const unterkategorien = await new Promise((resolve, reject) => {
            db.query(query, [parentId, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.json({
            success: true,
            data: unterkategorien
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Unterkategorien:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Unterkategorien',
            error: error.message
        });
    }
});

// ============================================
// EINZELNE ARTIKELGRUPPE ABRUFEN
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const { id } = req.params;

        const query = `
            SELECT
                ag.*,
                pag.name AS parent_name,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
            WHERE ag.id = ? AND ag.dojo_id = ?
        `;

        const gruppen = await new Promise((resolve, reject) => {
            db.query(query, [id, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        if (gruppen.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artikelgruppe nicht gefunden'
            });
        }

        res.json({
            success: true,
            data: gruppen[0]
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Artikelgruppe:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Artikelgruppe',
            error: error.message
        });
    }
});

// ============================================
// NEUE ARTIKELGRUPPE ERSTELLEN
// ============================================
router.post('/', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const {
            name,
            beschreibung,
            parent_id,
            sortierung = 0,
            icon,
            farbe
        } = req.body;

        // Validierung
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Name ist erforderlich'
            });
        }

        // Falls parent_id angegeben, pruefen ob diese zum gleichen Dojo gehoert
        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL AND dojo_id = ?',
                    [parent_id, dojo_id],
                    (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    }
                );
            });

            if (parentCheck.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ungueltige Hauptkategorie'
                });
            }
        }

        const query = `
            INSERT INTO artikelgruppen (dojo_id, name, beschreibung, parent_id, sortierung, icon, farbe)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await new Promise((resolve, reject) => {
            db.query(query, [
                dojo_id,
                name.trim(),
                beschreibung?.trim() || null,
                parent_id || null,
                sortierung,
                icon || null,
                farbe || null
            ], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.status(201).json({
            success: true,
            message: 'Artikelgruppe erfolgreich erstellt',
            data: {
                id: result.insertId,
                dojo_id: dojo_id,
                name: name.trim(),
                parent_id: parent_id || null
            }
        });

    } catch (error) {
        console.error('Fehler beim Erstellen der Artikelgruppe:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Eine Artikelgruppe mit diesem Namen existiert bereits'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Fehler beim Erstellen der Artikelgruppe',
            error: error.message
        });
    }
});

// ============================================
// ARTIKELGRUPPE AKTUALISIEREN
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const { id } = req.params;
        const { name, beschreibung, parent_id, sortierung, icon, farbe, aktiv } = req.body;

        // Pruefen ob Artikelgruppe zum Dojo gehoert
        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        if (existingGroup.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artikelgruppe nicht gefunden'
            });
        }

        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL AND dojo_id = ?',
                    [parent_id, dojo_id],
                    (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    }
                );
            });

            if (parentCheck.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ungueltige Hauptkategorie'
                });
            }
        }

        const query = `
            UPDATE artikelgruppen
            SET name = ?, beschreibung = ?, parent_id = ?, sortierung = ?,
                icon = ?, farbe = ?, aktiv = ?
            WHERE id = ? AND dojo_id = ?
        `;

        await new Promise((resolve, reject) => {
            db.query(query, [
                name?.trim() || existingGroup[0].name,
                beschreibung?.trim() || existingGroup[0].beschreibung,
                parent_id !== undefined ? parent_id : existingGroup[0].parent_id,
                sortierung !== undefined ? sortierung : existingGroup[0].sortierung,
                icon || existingGroup[0].icon,
                farbe || existingGroup[0].farbe,
                aktiv !== undefined ? aktiv : existingGroup[0].aktiv,
                id,
                dojo_id
            ], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.json({
            success: true,
            message: 'Artikelgruppe erfolgreich aktualisiert'
        });

    } catch (error) {
        console.error('Fehler beim Aktualisieren der Artikelgruppe:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Eine Artikelgruppe mit diesem Namen existiert bereits'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Fehler beim Aktualisieren der Artikelgruppe',
            error: error.message
        });
    }
});

// ============================================
// ARTIKELGRUPPE LOESCHEN (SOFT DELETE)
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const dojo_id = await checkAccess(req, res);
        if (!dojo_id) return;

        const { id } = req.params;

        // Pruefen ob Artikelgruppe zum Dojo gehoert
        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        if (existingGroup.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artikelgruppe nicht gefunden'
            });
        }

        // Pruefen ob noch Artikel in dieser Gruppe sind (zum gleichen Dojo)
        try {
            const artikelCheck = await new Promise((resolve, reject) => {
                db.query('SELECT COUNT(*) as count FROM artikel WHERE artikelgruppe_id = ? AND dojo_id = ?', [id, dojo_id], (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                });
            });

            if (artikelCheck[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Kann nicht geloescht werden. ${artikelCheck[0].count} Artikel sind noch in dieser Gruppe.`
                });
            }
        } catch (err) {
            // artikel Tabelle existiert evtl nicht
            console.log('Artikel-Check uebersprungen:', err.message);
        }

        // Pruefen ob Unterkategorien existieren
        const unterkategorienCheck = await new Promise((resolve, reject) => {
            db.query(
                'SELECT COUNT(*) as count FROM artikelgruppen WHERE parent_id = ? AND aktiv = TRUE AND dojo_id = ?',
                [id, dojo_id],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });

        if (unterkategorienCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Kann nicht geloescht werden. ${unterkategorienCheck[0].count} Unterkategorien sind noch vorhanden.`
            });
        }

        // Soft Delete
        await new Promise((resolve, reject) => {
            db.query('UPDATE artikelgruppen SET aktiv = FALSE WHERE id = ? AND dojo_id = ?', [id, dojo_id], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.json({
            success: true,
            message: 'Artikelgruppe erfolgreich geloescht'
        });

    } catch (error) {
        console.error('Fehler beim Loeschen der Artikelgruppe:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Loeschen der Artikelgruppe',
            error: error.message
        });
    }
});

module.exports = router;
