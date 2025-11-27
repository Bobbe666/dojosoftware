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
            WHERE ag.aktiv = TRUE
            ORDER BY 
                COALESCE(ag.parent_id, ag.id),
                ag.sortierung,
                ag.name
        `;
        
        const gruppen = await new Promise((resolve, reject) => {
            db.query(query, (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });
        
        // Gruppiere in Hauptkategorien und Unterkategorien
        const hauptkategorien = gruppen.filter(g => g.parent_id === null);
        const unterkategorien = gruppen.filter(g => g.parent_id !== null);
        
        // Strukturiere hierarchisch
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
        const query = `
            SELECT 
                ag.*,
                0 AS artikel_anzahl,
                (SELECT COUNT(*) FROM artikelgruppen u WHERE u.parent_id = ag.id AND u.aktiv = TRUE) AS unterkategorien_anzahl
            FROM artikelgruppen ag
            WHERE ag.parent_id IS NULL AND ag.aktiv = TRUE
            ORDER BY ag.sortierung, ag.name
        `;
        
        const hauptkategorien = await new Promise((resolve, reject) => {
            db.query(query, (error, results) => {
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
        const { parentId } = req.params;
        
        const query = `
            SELECT 
                ag.*,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            WHERE ag.parent_id = ? AND ag.aktiv = TRUE
            ORDER BY ag.sortierung, ag.name
        `;
        
        const unterkategorien = await new Promise((resolve, reject) => {
            db.query(query, [parentId], (error, results) => {
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
        const { id } = req.params;
        
        const query = `
            SELECT 
                ag.*,
                pag.name AS parent_name,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
            WHERE ag.id = ?
        `;
        
        const gruppen = await new Promise((resolve, reject) => {
            db.query(query, [id], (error, results) => {
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
        
        // Prüfe ob Parent existiert (falls angegeben)
        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL',
                    [parent_id],
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
            INSERT INTO artikelgruppen (name, beschreibung, parent_id, sortierung, icon, farbe)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const result = await new Promise((resolve, reject) => {
            db.query(query, [
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
        const { id } = req.params;
        const {
            name,
            beschreibung,
            parent_id,
            sortierung,
            icon,
            farbe,
            aktiv
        } = req.body;
        
        // Prüfe ob Gruppe existiert
        const existingGroup = await new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM artikelgruppen WHERE id = ?',
                [id],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artikelgruppe nicht gefunden'
            });
        }
        
        // Prüfe ob Parent existiert (falls angegeben)
        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL',
                    [parent_id],
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
            WHERE id = ?
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
                id
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
        const { id } = req.params;
        
        // Prüfe ob Gruppe existiert
        const existingGroup = await new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM artikelgruppen WHERE id = ?',
                [id],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Artikelgruppe nicht gefunden'
            });
        }
        
        // Prüfe ob Artikel in dieser Gruppe existieren
        const artikelCheck = await new Promise((resolve, reject) => {
            db.query(
                'SELECT COUNT(*) as count FROM artikel WHERE 1=0',
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });
        
        if (artikelCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Kann nicht gelöscht werden. ${artikelCheck[0].count} Artikel sind noch in dieser Gruppe.`
            });
        }
        
        // Prüfe ob Unterkategorien existieren
        const unterkategorienCheck = await new Promise((resolve, reject) => {
            db.query(
                'SELECT COUNT(*) as count FROM artikelgruppen WHERE parent_id = ? AND aktiv = TRUE',
                [id],
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
        
        // Soft Delete
        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE artikelgruppen SET aktiv = FALSE WHERE id = ?',
                [id],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
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

// ============================================
// ARTIKELGRUPPEN STATISTIKEN
// ============================================
router.get('/stats/overview', async (req, res) => {
    try {
        const query = `
            SELECT 
                ag.id,
                ag.name,
                ag.parent_id,
                ag.icon,
                ag.farbe,
                COUNT(a.id) as artikel_anzahl,
                COALESCE(SUM(a.lagerbestand), 0) as gesamt_lagerbestand,
                COALESCE(AVG(a.verkaufspreis_cent), 0) as durchschnittspreis_cent
            FROM artikelgruppen ag
            LEFT JOIN artikel a ON 1=0
            WHERE ag.aktiv = TRUE
            GROUP BY ag.id, ag.name, ag.parent_id, ag.icon, ag.farbe
            ORDER BY 
                COALESCE(ag.parent_id, ag.id),
                ag.sortierung,
                ag.name
        `;
        
        const stats = await new Promise((resolve, reject) => {
            db.query(query, (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });
        
        // Gruppiere nach Hauptkategorien
        const hauptkategorienStats = stats.filter(s => s.parent_id === null);
        const unterkategorienStats = stats.filter(s => s.parent_id !== null);
        
        const strukturierteStats = hauptkategorienStats.map(haupt => ({
            ...haupt,
            unterkategorien: unterkategorienStats
                .filter(unter => unter.parent_id === haupt.id)
                .sort((a, b) => a.sortierung - b.sortierung)
        }));
        
        res.json({
            success: true,
            data: strukturierteStats,
            gesamtstatistik: {
                hauptkategorien: hauptkategorienStats.length,
                unterkategorien: unterkategorienStats.length,
                gesamt_artikel: stats.reduce((sum, s) => sum + s.artikel_anzahl, 0),
                gesamt_lagerbestand: stats.reduce((sum, s) => sum + s.gesamt_lagerbestand, 0)
            }
        });
        
    } catch (error) {
        console.error('Fehler beim Abrufen der Artikelgruppen-Statistiken:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Statistiken',
            error: error.message
        });
    }
});

// ============================================
// ARTIKELGRUPPEN SUCHEN
// ============================================
router.get('/search/:term', async (req, res) => {
    try {
        const { term } = req.params;
        const searchTerm = `%${term}%`;
        
        const query = `
            SELECT 
                ag.*,
                pag.name AS parent_name,
                CASE 
                    WHEN ag.parent_id IS NULL THEN ag.name
                    ELSE CONCAT(pag.name, ' → ', ag.name)
                END AS vollstaendiger_name,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
            WHERE ag.aktiv = TRUE 
            AND (ag.name LIKE ? OR ag.beschreibung LIKE ?)
            ORDER BY 
                COALESCE(ag.parent_id, ag.id),
                ag.sortierung,
                ag.name
        `;
        
        const gruppen = await new Promise((resolve, reject) => {
            db.query(query, [searchTerm, searchTerm], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });
        
        res.json({
            success: true,
            data: gruppen,
            suchbegriff: term
        });
        
    } catch (error) {
        console.error('Fehler bei der Artikelgruppen-Suche:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler bei der Suche',
            error: error.message
        });
    }
});

module.exports = router;