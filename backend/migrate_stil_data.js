/**
 * Migration Script: mitglied_stile -> mitglied_stil_data
 *
 * Dieses Script migriert bestehende Einträge aus mitglied_stile
 * nach mitglied_stil_data, sodass die Statistiken korrekt funktionieren.
 */

const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dojoUser',
    password: process.env.DB_PASSWORD || 'DojoServer2025!',
    database: process.env.DB_NAME || 'dojo'
});

// Mapping von ENUM-Werten zu Stil-IDs
const stilMapping = {
    'ShieldX': 2,
    'BJJ': 3,
    'Kickboxen': 4,
    'Karate': 5,
    'Taekwon-Do': 7
};

async function migrate() {
    console.log('🔄 Starte Migration von mitglied_stile nach mitglied_stil_data...\n');

    try {
        // 1. Hole alle Einträge aus mitglied_stile
        const [stileRows] = await db.promise().query(`
            SELECT mitglied_id, stil
            FROM mitglied_stile
        `);

        console.log(`📊 Gefunden: ${stileRows.length} Einträge in mitglied_stile`);

        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        // 2. Für jeden Eintrag prüfen und ggf. in mitglied_stil_data einfügen
        for (const row of stileRows) {
            const mitglied_id = row.mitglied_id;
            const stil_enum = row.stil;
            const stil_id = stilMapping[stil_enum];

            if (!stil_id) {
                console.warn(`⚠️  Unbekannter Stil "${stil_enum}" für Mitglied ${mitglied_id} - übersprungen`);
                skipped++;
                continue;
            }

            try {
                // Prüfe ob bereits vorhanden
                const [existing] = await db.promise().query(`
                    SELECT id FROM mitglied_stil_data
                    WHERE mitglied_id = ? AND stil_id = ?
                `, [mitglied_id, stil_id]);

                if (existing.length > 0) {
                    console.log(`  ↪️  Mitglied ${mitglied_id} + Stil ${stil_enum} bereits vorhanden`);
                    skipped++;
                    continue;
                }

                // Neu erstellen
                await db.promise().query(`
                    INSERT INTO mitglied_stil_data
                    (mitglied_id, stil_id, current_graduierung_id, erstellt_am)
                    VALUES (?, ?, NULL, CURRENT_TIMESTAMP)
                `, [mitglied_id, stil_id]);

                console.log(`  ✅ Migriert: Mitglied ${mitglied_id} → ${stil_enum} (ID ${stil_id})`);
                migrated++;

            } catch (err) {
                console.error(`  ❌ Fehler bei Mitglied ${mitglied_id}:`, err.message);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Migrationsergebnis:');
        console.log('  ✅ Migriert:', migrated);
        console.log('  ↪️  Übersprungen (bereits vorhanden):', skipped);
        console.log('  ❌ Fehler:', errors);
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ Migration fehlgeschlagen:', err);
        process.exit(1);
    } finally {
        await db.promise().end();
    }
}

// Migration ausführen
migrate();
