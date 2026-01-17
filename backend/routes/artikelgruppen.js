const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================================================
// MOCK-DATEN für Development Mode
// =====================================================================================
const MOCK_ARTIKELGRUPPEN = [
    // Hauptkategorien
    {
        id: 1,
        name: 'Bekleidung',
        beschreibung: 'Kampfsportbekleidung und Trainingsequipment',
        parent_id: null,
        sortierung: 1,
        aktiv: true,
        icon: '👕',
        farbe: '#3b82f6',
        typ: 'Hauptkategorie',
        vollstaendiger_name: 'Bekleidung',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 2,
        name: 'Ausrüstung',
        beschreibung: 'Trainings- und Wettkampfausrüstung',
        parent_id: null,
        sortierung: 2,
        aktiv: true,
        icon: '🥊',
        farbe: '#ef4444',
        typ: 'Hauptkategorie',
        vollstaendiger_name: 'Ausrüstung',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 3,
        name: 'Prüfungsmaterial',
        beschreibung: 'Material für Gürtelprüfungen',
        parent_id: null,
        sortierung: 3,
        aktiv: true,
        icon: '🥋',
        farbe: '#10b981',
        typ: 'Hauptkategorie',
        vollstaendiger_name: 'Prüfungsmaterial',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 4,
        name: 'Merchandise',
        beschreibung: 'Dojo Merchandise und Accessoires',
        parent_id: null,
        sortierung: 4,
        aktiv: true,
        icon: '🎁',
        farbe: '#f59e0b',
        typ: 'Hauptkategorie',
        vollstaendiger_name: 'Merchandise',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    // Unterkategorien - Bekleidung
    {
        id: 5,
        name: 'Gi/Anzüge',
        beschreibung: 'Karate-Gi und andere Kampfsportanzüge',
        parent_id: 1,
        sortierung: 1,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Bekleidung → Gi/Anzüge',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 6,
        name: 'Gürtel',
        beschreibung: 'Kampfsportgürtel in allen Farben',
        parent_id: 1,
        sortierung: 2,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Bekleidung → Gürtel',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 7,
        name: 'T-Shirts',
        beschreibung: 'Trainings-T-Shirts und Tops',
        parent_id: 1,
        sortierung: 3,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Bekleidung → T-Shirts',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    // Unterkategorien - Ausrüstung
    {
        id: 8,
        name: 'Schutzausrüstung',
        beschreibung: 'Protektoren, Kopfschutz, Zahnschutz',
        parent_id: 2,
        sortierung: 1,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Ausrüstung → Schutzausrüstung',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 9,
        name: 'Trainingsgeräte',
        beschreibung: 'Schlagpolster, Pratzen, Matten',
        parent_id: 2,
        sortierung: 2,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Ausrüstung → Trainingsgeräte',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    },
    {
        id: 10,
        name: 'Waffen',
        beschreibung: 'Trainingswaffen (Bo, Nunchaku, etc.)',
        parent_id: 2,
        sortierung: 3,
        aktiv: true,
        icon: null,
        farbe: null,
        typ: 'Unterkategorie',
        vollstaendiger_name: 'Ausrüstung → Waffen',
        artikel_anzahl: 0,
        erstellt_am: new Date(),
        aktualisiert_am: new Date()
    }
];

// =====================================================================================
// DEVELOPMENT MODE CHECK
// =====================================================================================
const isDevelopment = process.env.NODE_ENV !== 'production';

// =====================================================================================
// ARTIKELGRUPPEN ROUTES - KAMPFSPORT-SPEZIFISCH
// =====================================================================================

// ============================================
// ALLE ARTIKELGRUPPEN ABRUFEN (HIERARCHISCH)
// ============================================
router.get('/', async (req, res) => {
    try {
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
        if (isDevelopment) {
            console.log('🔧 Development Mode: Verwende Mock-Artikelgruppen');

            const hauptkategorien = MOCK_ARTIKELGRUPPEN.filter(g => g.parent_id === null);
            const unterkategorien = MOCK_ARTIKELGRUPPEN.filter(g => g.parent_id !== null);

            const strukturierteGruppen = hauptkategorien.map(haupt => ({
                ...haupt,
                unterkategorien: unterkategorien
                    .filter(unter => unter.parent_id === haupt.id)
                    .sort((a, b) => a.sortierung - b.sortierung)
            }));

            return res.json({
                success: true,
                data: strukturierteGruppen,
                statistik: {
                    hauptkategorien: hauptkategorien.length,
                    unterkategorien: unterkategorien.length,
                    gesamt: MOCK_ARTIKELGRUPPEN.length
                },
                _dev: true
            });
        }

        // PRODUCTION MODE: Datenbank verwenden
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
            db.query(query, [req.tenant.dojo_id], (error, results) => {
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            const hauptkategorien = MOCK_ARTIKELGRUPPEN
                .filter(g => g.parent_id === null)
                .map(g => ({
                    ...g,
                    unterkategorien_anzahl: MOCK_ARTIKELGRUPPEN.filter(u => u.parent_id === g.id).length
                }));

            return res.json({
                success: true,
                data: hauptkategorien,
                _dev: true
            });
        }

        // PRODUCTION MODE
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
            db.query(query, [req.tenant.dojo_id, req.tenant.dojo_id], (error, results) => {
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { parentId } = req.params;

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            const unterkategorien = MOCK_ARTIKELGRUPPEN
                .filter(g => g.parent_id === parseInt(parentId))
                .sort((a, b) => a.sortierung - b.sortierung);

            return res.json({
                success: true,
                data: unterkategorien,
                _dev: true
            });
        }

        // PRODUCTION MODE
        const query = `
            SELECT
                ag.*,
                0 AS artikel_anzahl
            FROM artikelgruppen ag
            WHERE ag.parent_id = ? AND ag.aktiv = TRUE AND ag.dojo_id = ?
            ORDER BY ag.sortierung, ag.name
        `;

        const unterkategorien = await new Promise((resolve, reject) => {
            db.query(query, [parentId, req.tenant.dojo_id], (error, results) => {
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            const gruppe = MOCK_ARTIKELGRUPPEN.find(g => g.id === parseInt(id));

            if (!gruppe) {
                return res.status(404).json({
                    success: false,
                    message: 'Artikelgruppe nicht gefunden'
                });
            }

            const parent = gruppe.parent_id
                ? MOCK_ARTIKELGRUPPEN.find(g => g.id === gruppe.parent_id)
                : null;

            return res.json({
                success: true,
                data: {
                    ...gruppe,
                    parent_name: parent?.name || null
                },
                _dev: true
            });
        }

        // PRODUCTION MODE
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
            db.query(query, [id, req.tenant.dojo_id], (error, results) => {
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

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

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            console.log('🔧 Development Mode: Neue Artikelgruppe erstellt (Mock)');
            const newId = Math.max(...MOCK_ARTIKELGRUPPEN.map(g => g.id)) + 1;

            return res.status(201).json({
                success: true,
                message: 'Artikelgruppe erfolgreich erstellt',
                data: {
                    id: newId,
                    name: name.trim(),
                    parent_id: parent_id || null
                },
                _dev: true
            });
        }

        // PRODUCTION MODE
        if (parent_id) {
            const parentCheck = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT id FROM artikelgruppen WHERE id = ? AND parent_id IS NULL AND dojo_id = ?',
                    [parent_id, req.tenant.dojo_id],
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
                req.tenant.dojo_id
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;
        const { name, beschreibung, parent_id, sortierung, icon, farbe, aktiv } = req.body;

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            console.log('🔧 Development Mode: Artikelgruppe aktualisiert (Mock)');
            return res.json({
                success: true,
                message: 'Artikelgruppe erfolgreich aktualisiert',
                _dev: true
            });
        }

        // PRODUCTION MODE
        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, req.tenant.dojo_id], (error, results) => {
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
                    [parent_id, req.tenant.dojo_id],
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
                req.tenant.dojo_id
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
        // Tenant check (skip in dev mode)
        if (!isDevelopment && !req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;

        // 🔧 DEVELOPMENT MODE
        if (isDevelopment) {
            console.log('🔧 Development Mode: Artikelgruppe gelöscht (Mock)');
            return res.json({
                success: true,
                message: 'Artikelgruppe erfolgreich gelöscht',
                _dev: true
            });
        }

        // PRODUCTION MODE
        const existingGroup = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM artikelgruppen WHERE id = ? AND dojo_id = ?', [id, req.tenant.dojo_id], (error, results) => {
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
            db.query('SELECT COUNT(*) as count FROM artikel WHERE artikelgruppe_id = ? AND dojo_id = ?', [id, req.tenant.dojo_id], (error, results) => {
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
                [id, req.tenant.dojo_id],
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
            db.query('UPDATE artikelgruppen SET aktiv = FALSE WHERE id = ? AND dojo_id = ?', [id, req.tenant.dojo_id], (error, results) => {
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
