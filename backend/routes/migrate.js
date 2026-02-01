// Temporärer Migrations-Endpoint - NACH AUSFÜHRUNG LÖSCHEN!
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// GET /api/migrate/add-ist-archiviert - Migration ausführen
router.get('/add-ist-archiviert', async (req, res) => {
    try {
        logger.debug('🗄️ Starte Migration: add_ist_archiviert_to_tarife');

        // Prüfe ob Spalte bereits existiert
        const checkColumn = await queryAsync(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'tarife'
            AND COLUMN_NAME = 'ist_archiviert'
        `);

        if (checkColumn.length > 0) {
            return res.json({
                success: true,
                message: 'Migration bereits ausgeführt - Spalte ist_archiviert existiert bereits'
            });
        }

        // Führe Migration aus
        await queryAsync(`
            ALTER TABLE tarife
            ADD COLUMN ist_archiviert BOOLEAN DEFAULT FALSE NOT NULL
            COMMENT 'TRUE = Alter Tarif, nicht mehr für neue Mitglieder verfügbar'
        `);

        await queryAsync(`
            CREATE INDEX idx_tarife_archiviert ON tarife(ist_archiviert)
        `);

        await queryAsync(`
            UPDATE tarife SET ist_archiviert = FALSE WHERE ist_archiviert IS NULL
        `);

        logger.info('Migration erfolgreich ausgeführt!');

        res.json({
            success: true,
            message: 'Migration erfolgreich ausgeführt! Spalte ist_archiviert wurde hinzugefügt.'
        });

    } catch (err) {
        logger.error('Fehler bei Migration:', err);
        res.status(500).json({
            success: false,
            error: 'Fehler bei der Migration',
            details: err.message
        });
    }
});

// GET /api/migrate/create-ehemalige - Erstelle ehemalige Tabelle
router.get('/create-ehemalige', async (req, res) => {
    try {
        logger.debug('🗄️ Starte Migration: create_ehemalige_table');

        // Prüfe ob Tabelle bereits existiert
        const checkTable = await queryAsync(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'ehemalige'
        `);

        if (checkTable.length > 0) {
            return res.json({
                success: true,
                message: 'Migration bereits ausgeführt - Tabelle ehemalige existiert bereits'
            });
        }

        // Führe Migration aus - Erstelle Tabelle
        await queryAsync(`
            CREATE TABLE ehemalige (
                id INT AUTO_INCREMENT PRIMARY KEY,
                urspruengliches_mitglied_id INT NULL COMMENT 'Referenz zum ursprünglichen Mitglied in mitglieder-Tabelle',
                dojo_id INT NOT NULL COMMENT 'Dojo-Zuordnung (Tax Compliance)',
                vorname VARCHAR(100) NOT NULL,
                nachname VARCHAR(100) NOT NULL,
                geburtsdatum DATE NULL,
                geschlecht ENUM('m', 'w', 'd') NULL,
                email VARCHAR(255) NULL,
                telefon VARCHAR(50) NULL,
                telefon_mobil VARCHAR(50) NULL,
                strasse VARCHAR(255) NULL,
                hausnummer VARCHAR(20) NULL,
                plz VARCHAR(10) NULL,
                ort VARCHAR(100) NULL,
                urspruengliches_eintrittsdatum DATE NULL COMMENT 'Datum des ursprünglichen Eintritts',
                austrittsdatum DATE NULL COMMENT 'Datum des Austritts',
                austrittsgrund TEXT NULL COMMENT 'Grund für den Austritt',
                letzter_tarif VARCHAR(255) NULL COMMENT 'Letzter gebuchter Tarif',
                letzter_guertel VARCHAR(100) NULL COMMENT 'Letzter erreichter Gürtel/Graduierung',
                letzter_stil VARCHAR(100) NULL COMMENT 'Letzter trainierter Stil',
                notizen TEXT NULL COMMENT 'Interne Notizen zum ehemaligen Mitglied',
                wiederaufnahme_moeglich BOOLEAN DEFAULT TRUE COMMENT 'Kann das Mitglied wieder aufgenommen werden?',
                wiederaufnahme_gesperrt_bis DATE NULL COMMENT 'Gesperrt bis zu diesem Datum',
                archiviert BOOLEAN DEFAULT FALSE COMMENT 'Komplett archiviert (nicht mehr in Listen anzeigen)',
                erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ehemalige_dojo (dojo_id),
                INDEX idx_ehemalige_name (nachname, vorname),
                INDEX idx_ehemalige_austrittsdatum (austrittsdatum),
                INDEX idx_ehemalige_archiviert (archiviert),
                INDEX idx_ehemalige_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Ehemalige Mitglieder mit vollständiger Historie'
        `);

        logger.info('Migration erfolgreich ausgeführt!');

        res.json({
            success: true,
            message: 'Migration erfolgreich ausgeführt! Tabelle ehemalige wurde erstellt.'
        });

    } catch (err) {
        logger.error('Fehler bei Migration:', err);
        res.status(500).json({
            success: false,
            error: 'Fehler bei der Migration',
            details: err.message
        });
    }
});

// GET /api/migrate/create-interessenten - Erstelle interessenten Tabelle
router.get('/create-interessenten', async (req, res) => {
    try {
        logger.debug('🗄️ Starte Migration: create_interessenten_table');

        // Prüfe ob Tabelle bereits existiert
        const checkTable = await queryAsync(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'interessenten'
        `);

        if (checkTable.length > 0) {
            return res.json({
                success: true,
                message: 'Migration bereits ausgeführt - Tabelle interessenten existiert bereits'
            });
        }

        // Führe Migration aus - Erstelle Tabelle
        await queryAsync(`
            CREATE TABLE interessenten (
                id INT AUTO_INCREMENT PRIMARY KEY,
                dojo_id INT NOT NULL COMMENT 'Interessiert an diesem Dojo',
                vorname VARCHAR(100) NOT NULL,
                nachname VARCHAR(100) NOT NULL,
                geburtsdatum DATE NULL,
                \`alter\` INT NULL COMMENT 'Alter des Interessenten',
                email VARCHAR(255) NULL,
                telefon VARCHAR(50) NULL,
                telefon_mobil VARCHAR(50) NULL,
                strasse VARCHAR(255) NULL,
                hausnummer VARCHAR(20) NULL,
                plz VARCHAR(10) NULL,
                ort VARCHAR(100) NULL,
                interessiert_an TEXT NULL COMMENT 'Welche Kampfkunst/Programm interessiert den Prospect?',
                erfahrung VARCHAR(255) NULL COMMENT 'Vorherige Kampfkunst-Erfahrung',
                gewuenschter_tarif VARCHAR(255) NULL COMMENT 'Gewünschter Tarif (falls angegeben)',
                erstkontakt_datum DATE NULL COMMENT 'Datum des ersten Kontakts',
                erstkontakt_quelle VARCHAR(100) NULL COMMENT 'Quelle: Website, Empfehlung, Facebook, etc.',
                letzter_kontakt_datum DATE NULL COMMENT 'Datum des letzten Kontakts',
                naechster_kontakt_datum DATE NULL COMMENT 'Geplanter nächster Kontakt',
                status ENUM('neu', 'kontaktiert', 'probetraining_vereinbart', 'probetraining_absolviert', 'angebot_gesendet', 'interessiert', 'nicht_interessiert', 'konvertiert') DEFAULT 'neu',
                konvertiert_zu_mitglied_id INT NULL COMMENT 'Referenz zum Mitglied (falls konvertiert)',
                konvertiert_am DATE NULL COMMENT 'Datum der Konvertierung zum Mitglied',
                probetraining_datum DATE NULL COMMENT 'Datum des vereinbarten Probetrainings',
                probetraining_absolviert BOOLEAN DEFAULT FALSE,
                probetraining_feedback TEXT NULL COMMENT 'Feedback nach Probetraining',
                notizen TEXT NULL COMMENT 'Interne Notizen zum Interessenten',
                newsletter_angemeldet BOOLEAN DEFAULT FALSE,
                datenschutz_akzeptiert BOOLEAN DEFAULT FALSE,
                datenschutz_akzeptiert_am TIMESTAMP NULL,
                prioritaet ENUM('niedrig', 'mittel', 'hoch') DEFAULT 'mittel',
                zustaendig_user_id INT NULL COMMENT 'Zuständiger Mitarbeiter für Follow-up',
                archiviert BOOLEAN DEFAULT FALSE COMMENT 'Nicht mehr aktiv verfolgen',
                archiviert_grund VARCHAR(255) NULL COMMENT 'Grund für Archivierung',
                erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_interessenten_dojo (dojo_id),
                INDEX idx_interessenten_name (nachname, vorname),
                INDEX idx_interessenten_status (status),
                INDEX idx_interessenten_email (email),
                INDEX idx_interessenten_erstkontakt (erstkontakt_datum),
                INDEX idx_interessenten_naechster_kontakt (naechster_kontakt_datum),
                INDEX idx_interessenten_archiviert (archiviert),
                INDEX idx_interessenten_prioritaet (prioritaet)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Interessenten und potenzielle Mitglieder'
        `);

        logger.info('Migration erfolgreich ausgeführt!');

        res.json({
            success: true,
            message: 'Migration erfolgreich ausgeführt! Tabelle interessenten wurde erstellt.'
        });

    } catch (err) {
        logger.error('Fehler bei Migration:', err);
        res.status(500).json({
            success: false,
            error: 'Fehler bei der Migration',
            details: err.message
        });
    }
});

// GET /api/migrate/move-archived-to-ehemalige - Verschiebe archivierte Mitglieder zu Ehemalige
router.get('/move-archived-to-ehemalige', async (req, res) => {
    try {
        logger.debug('🔄 Starte Migration: move_archived_to_ehemalige');

        // Prüfe ob ehemalige Tabelle existiert
        const checkTable = await queryAsync(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'ehemalige'
        `);

        if (checkTable.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tabelle ehemalige existiert noch nicht. Bitte zuerst /api/migrate/create-ehemalige ausführen.'
            });
        }

        // Finde alle archivierten Mitglieder
        const archivierteMitglieder = await queryAsync(`
            SELECT * FROM mitglieder WHERE aktiv = 0 OR aktiv = FALSE
        `);

        if (archivierteMitglieder.length === 0) {
            return res.json({
                success: true,
                message: 'Keine archivierten Mitglieder gefunden.',
                moved: 0
            });
        }

        logger.debug('📊 Gefunden: ${archivierteMitglieder.length} archivierte Mitglieder');

        let movedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Verschiebe jedes archivierte Mitglied
        for (const mitglied of archivierteMitglieder) {
            try {
                // Prüfe ob bereits in ehemalige vorhanden (anhand urspruengliches_mitglied_id)
                const existing = await queryAsync(`
                    SELECT id FROM ehemalige WHERE urspruengliches_mitglied_id = ?
                `, [mitglied.mitglied_id]);

                if (existing.length > 0) {
                    logger.debug('⏭️ Überspringe Mitglied ${mitglied.mitglied_id} - bereits in ehemalige');
                    skippedCount++;
                    continue;
                }

                // Hole letzte Stil- und Gürtel-Info wenn vorhanden
                let letzterStil = null;
                let letzterGuertel = null;

                try {
                    const stile = await queryAsync(`
                        SELECT s.name
                        FROM mitglieder_stile ms
                        JOIN stile s ON ms.stil_id = s.id
                        WHERE ms.mitglied_id = ?
                        ORDER BY ms.created_at DESC
                        LIMIT 1
                    `, [mitglied.mitglied_id]);

                    if (stile.length > 0) {
                        letzterStil = stile[0].name;
                    }

                    const guertel = await queryAsync(`
                        SELECT graduierung
                        FROM mitglieder_stile
                        WHERE mitglied_id = ?
                        ORDER BY created_at DESC
                        LIMIT 1
                    `, [mitglied.mitglied_id]);

                    if (guertel.length > 0) {
                        letzterGuertel = guertel[0].graduierung;
                    }
                } catch (err) {
                    logger.debug('ℹ️ Keine Stil/Gürtel-Info gefunden für Mitglied', mitglied.mitglied_id);
                }

                // Hole letzten Vertrag/Tarif
                let letzterTarif = null;
                try {
                    const vertrag = await queryAsync(`
                        SELECT t.name
                        FROM vertraege v
                        JOIN tarife t ON v.tarif_id = t.id
                        WHERE v.mitglied_id = ?
                        ORDER BY v.created_at DESC
                        LIMIT 1
                    `, [mitglied.mitglied_id]);

                    if (vertrag.length > 0) {
                        letzterTarif = vertrag[0].name;
                    }
                } catch (err) {
                    logger.debug('ℹ️ Keine Vertrags-Info gefunden für Mitglied', mitglied.mitglied_id);
                }

                // Füge in ehemalige Tabelle ein
                await queryAsync(`
                    INSERT INTO ehemalige (
                        urspruengliches_mitglied_id,
                        dojo_id,
                        vorname,
                        nachname,
                        geburtsdatum,
                        geschlecht,
                        email,
                        telefon,
                        telefon_mobil,
                        strasse,
                        hausnummer,
                        plz,
                        ort,
                        urspruengliches_eintrittsdatum,
                        austrittsdatum,
                        austrittsgrund,
                        letzter_tarif,
                        letzter_guertel,
                        letzter_stil,
                        notizen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Automatisch migriert von archivierten Mitgliedern', ?, ?, ?, 'Automatisch migriert am ' || NOW())
                `, [
                    mitglied.mitglied_id,
                    mitglied.dojo_id,
                    mitglied.vorname,
                    mitglied.nachname,
                    mitglied.geburtsdatum,
                    mitglied.geschlecht,
                    mitglied.email,
                    mitglied.telefon,
                    mitglied.telefon_mobil,
                    mitglied.strasse,
                    mitglied.hausnummer,
                    mitglied.plz,
                    mitglied.ort,
                    mitglied.eintrittsdatum,
                    letzterTarif,
                    letzterGuertel,
                    letzterStil
                ]);

                logger.info('Verschoben: ${mitglied.vorname} ${mitglied.nachname} (ID: ${mitglied.mitglied_id})');
                movedCount++;

            } catch (err) {
                logger.error('Fehler bei Mitglied ${mitglied.mitglied_id}:', err);
                errors.push({
                    mitglied_id: mitglied.mitglied_id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    error: err.message
                });
            }
        }

        const summary = {
            success: true,
            message: `Migration abgeschlossen: ${movedCount} verschoben, ${skippedCount} übersprungen`,
            details: {
                total: archivierteMitglieder.length,
                moved: movedCount,
                skipped: skippedCount,
                errors: errors.length
            }
        };

        if (errors.length > 0) {
            summary.errors = errors;
        }

        logger.info('Migration erfolgreich abgeschlossen!');
        res.json(summary);

    } catch (err) {
        logger.error('Fehler bei Migration:', err);
        res.status(500).json({
            success: false,
            error: 'Fehler bei der Migration',
            details: err.message
        });
    }
});

module.exports = router;
