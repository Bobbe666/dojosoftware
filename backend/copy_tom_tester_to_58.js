const db = require('./db.js');

async function copyTomTesterTo58() {
    try {
        console.log('🔄 Kopiere Tom Tester Daten von ID 3 zu ID 58...');
        
        // Verbindung zur Datenbank
        const connection = await db.promise().getConnection();
        
        // 1. Lösche bestehende Prüfungen für ID 58
        console.log('🗑️ Lösche bestehende Prüfungen für ID 58...');
        await connection.execute('DELETE FROM pruefungen WHERE mitglied_id = 58');
        
        // 2. Kopiere alle Prüfungen von ID 3 zu ID 58
        console.log('📋 Kopiere Prüfungen von ID 3 zu ID 58...');
        const [pruefungen] = await connection.execute(`
            SELECT * FROM pruefungen WHERE mitglied_id = 3
        `);
        
        console.log(`📊 Gefunden: ${pruefungen.length} Prüfungen zum Kopieren`);
        
        for (const pruefung of pruefungen) {
            const insertQuery = `
                INSERT INTO pruefungen (
                    mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id,
                    pruefungsdatum, pruefungsort, bestanden, punktzahl, max_punktzahl,
                    pruefer_id, prueferkommentar, pruefungsgebuehr, gebuehr_bezahlt,
                    bezahldatum, urkunde_ausgestellt, urkunde_nr, urkunde_pfad,
                    dokumente_pfad, pruefungsinhalte, einzelbewertungen, status,
                    anmerkungen, erstellt_am, aktualisiert_am, erstellt_von,
                    pruefungszeit, anmeldefrist, gurtlaenge, bemerkungen,
                    teilnahmebedingungen, teilnahme_bestaetigt, teilnahme_bestaetigt_am
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
                58, // neue mitglied_id
                pruefung.stil_id,
                pruefung.dojo_id,
                pruefung.graduierung_vorher_id,
                pruefung.graduierung_nachher_id,
                pruefung.pruefungsdatum,
                pruefung.pruefungsort,
                pruefung.bestanden,
                pruefung.punktzahl,
                pruefung.max_punktzahl,
                pruefung.pruefer_id,
                pruefung.prueferkommentar,
                pruefung.pruefungsgebuehr,
                pruefung.gebuehr_bezahlt,
                pruefung.bezahldatum,
                pruefung.urkunde_ausgestellt,
                pruefung.urkunde_nr,
                pruefung.urkunde_pfad,
                pruefung.dokumente_pfad,
                pruefung.pruefungsinhalte,
                pruefung.einzelbewertungen,
                pruefung.status,
                pruefung.anmerkungen,
                pruefung.erstellt_am,
                pruefung.aktualisiert_am,
                pruefung.erstellt_von,
                pruefung.pruefungszeit,
                pruefung.anmeldefrist,
                pruefung.gurtlaenge,
                pruefung.bemerkungen,
                pruefung.teilnahmebedingungen,
                pruefung.teilnahme_bestaetigt,
                pruefung.teilnahme_bestaetigt_am
            ];
            
            await connection.execute(insertQuery, values);
            console.log(`✅ Prüfung kopiert: ${pruefung.urkunde_nr} - ${pruefung.pruefungsdatum}`);
        }
        
        // 3. Prüfe das Ergebnis
        const [neuePruefungen] = await connection.execute(`
            SELECT COUNT(*) as anzahl FROM pruefungen WHERE mitglied_id = 58
        `);
        
        console.log(`🎉 Erfolgreich kopiert: ${neuePruefungen[0].anzahl} Prüfungen für ID 58`);
        
        // 4. Zeige Statistiken
        const [statistiken] = await connection.execute(`
            SELECT 
                s.name as stil_name,
                COUNT(*) as anzahl_pruefungen,
                SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) as bestanden,
                AVG(p.punktzahl) as durchschnittspunktzahl,
                SUM(p.pruefungsgebuehr) as gesamtgebuehren
            FROM pruefungen p
            JOIN stile s ON p.stil_id = s.stil_id
            WHERE p.mitglied_id = 58
            GROUP BY s.stil_id, s.name
            ORDER BY s.name
        `);
        
        console.log('\n📊 Prüfungsstatistiken für ID 58:');
        console.table(statistiken);
        
        connection.release();
        
    } catch (error) {
        console.error('❌ Fehler beim Kopieren der Daten:', error);
    } finally {
        db.end();
    }
}

copyTomTesterTo58();
