const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================================================
// ARTIKELGRUPPEN ROUTES - KAMPFSPORT-SPEZIFISCH
// =====================================================================================

// ============================================
// ALLE ARTIKELGRUPPEN ABRUFEN (HIERARCHISCH)
// ============================================
router.get('/', async (req, res) => {
    try {
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        // Tenant check (Super-Admin darf ohne dojo_id)
        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        // Super-Admin ohne dojo_id - Standard-Dojo 3 verwenden
        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);

        const query = `
            SELECT
                ag.id,
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
                    ELSE CONCAT(pag.name, ' → ', ag.name)
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
            db.query(query, [dojoId], (error, results) => {
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
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);

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
            db.query(query, [dojoId, dojoId], (error, results) => {
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
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);
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
            db.query(query, [parentId, dojoId], (error, results) => {
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
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);
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
            db.query(query, [id, dojoId], (error, results) => {
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
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);

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

        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL AND dojo_id = ?',
                    [parent_id, dojoId],
                    (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    }
                );
            });

            if (parentCheck.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ungültige Hauptkategorie'
                });
            }
        }

        const query = `
            INSERT INTO artikelgruppen (name, beschreibung, parent_id, sortierung, icon, farbe, dojo_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await new Promise((resolve, reject) => {
            db.query(query, [
                name.trim(),
                beschreibung?.trim() || null,
                parent_id || null,
                sortierung,
                icon || null,
                farbe || null,
                dojoId
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
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);
        const { id } = req.params;
        const { name, beschreibung, parent_id, sortierung, icon, farbe, aktiv } = req.body;

        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, dojoId], (error, results) => {
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
                    [parent_id, dojoId],
                    (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    }
                );
            });

            if (parentCheck.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ungültige Hauptkategorie'
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
                dojoId
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
// ARTIKELGRUPPE LÖSCHEN (SOFT DELETE)
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        // Super-Admin Check
        const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
        const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

        if (!isSuperAdmin && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 3 : null);
        const { id } = req.params;

        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, dojoId], (error, results) => {
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

        const artikelCheck = await new Promise((resolve, reject) => {
            db.query('SELECT COUNT(*) as count FROM artikel WHERE artikelgruppe_id = ? AND dojo_id = ?', [id, dojoId], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        if (artikelCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Kann nicht gelöscht werden. ${artikelCheck[0].count} Artikel sind noch in dieser Gruppe.`
            });
        }

        const unterkategorienCheck = await new Promise((resolve, reject) => {
            db.query(
                'SELECT COUNT(*) as count FROM artikelgruppen WHERE parent_id = ? AND aktiv = TRUE AND dojo_id = ?',
                [id, dojoId],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });

        if (unterkategorienCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Kann nicht gelöscht werden. ${unterkategorienCheck[0].count} Unterkategorien sind noch vorhanden.`
            });
        }

        await new Promise((resolve, reject) => {
            db.query('UPDATE artikelgruppen SET aktiv = FALSE WHERE id = ? AND dojo_id = ?', [id, dojoId], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        res.json({
            success: true,
            message: 'Artikelgruppe erfolgreich gelöscht'
        });

    } catch (error) {
        console.error('Fehler beim Löschen der Artikelgruppe:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen der Artikelgruppe',
            error: error.message
        });
    }
});

module.exports = router;
