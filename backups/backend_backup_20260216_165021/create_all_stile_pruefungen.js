const db = require('./db.js');

async function createAllStilePruefungen() {
    try {
        console.log('🎯 Erstelle Prüfungsdaten für ALLE Stile für Tom Tester (ID 58)...');
        
        // Verbindung zur Datenbank
        const connection = await db.promise().getConnection();
        
        // 1. Lösche bestehende Prüfungen für ID 58
        console.log('🗑️ Lösche bestehende Prüfungen für ID 58...');
        await connection.execute('DELETE FROM pruefungen WHERE mitglied_id = 58');
        
        // 2. Hole alle verfügbaren Stile mit ihren Graduierungen
        const [stile] = await connection.execute(`
            SELECT s.stil_id, s.name as stil_name, s.beschreibung,
                   g.graduierung_id, g.name as graduierung_name, g.reihenfolge, 
                   g.trainingsstunden_min, g.farbe_hex
            FROM stile s
            LEFT JOIN graduierungen g ON s.stil_id = g.stil_id AND g.aktiv = 1
            WHERE s.aktiv = 1 AND s.stil_id IN (2, 3, 4, 5, 7, 8)
            ORDER BY s.stil_id, g.reihenfolge
        `);
        
        console.log('📋 Verfügbare Stile mit Graduierungen:');
        const stileMap = {};
        stile.forEach(row => {
            if (!stileMap[row.stil_id]) {
                stileMap[row.stil_id] = {
                    stil_id: row.stil_id,
                    stil_name: row.stil_name,
                    beschreibung: row.beschreibung,
                    graduierungen: []
                };
            }
            if (row.graduierung_id) {
                stileMap[row.stil_id].graduierungen.push({
                    graduierung_id: row.graduierung_id,
                    name: row.graduierung_name,
                    reihenfolge: row.reihenfolge,
                    trainingsstunden_min: row.trainingsstunden_min,
                    farbe_hex: row.farbe_hex
                });
            }
        });
        
        Object.values(stileMap).forEach(stil => {
            console.log(`  - ${stil.stil_id}: ${stil.stil_name} (${stil.graduierungen.length} Graduierungen)`);
        });
        
        // 3. Erstelle Prüfungen für jeden Stil
        let pruefungCounter = 0;
        const baseDate = new Date('2023-01-01');
        
        for (const stil of Object.values(stileMap)) {
            if (stil.graduierungen.length === 0) {
                console.log(`⚠️ Skipping ${stil.stil_name} - keine Graduierungen`);
                continue;
            }
            
            console.log(`\n🎓 Erstelle Prüfungen für ${stil.stil_name}...`);
            
            // Sortiere Graduierungen nach Reihenfolge
            const sortedGraduierungen = stil.graduierungen.sort((a, b) => a.reihenfolge - b.reihenfolge);
            
            // Erstelle Prüfungen für die ersten 3-4 Graduierungen
            const maxPruefungen = Math.min(4, sortedGraduierungen.length);
            
            for (let i = 0; i < maxPruefungen; i++) {
                const graduierung = sortedGraduierungen[i];
                const vorherigeGraduierung = i > 0 ? sortedGraduierungen[i-1] : null;
                
                // Berechne Prüfungsdatum (alle 3-4 Monate)
                const pruefungsdatum = new Date(baseDate);
                pruefungsdatum.setMonth(baseDate.getMonth() + (pruefungCounter * 3));
                
                // Generiere Urkunden-Nummer
                const stilKurz = stil.stil_name.replace(/[^A-Z]/g, '').substring(0, 3);
                const urkundeNr = `${stilKurz}-202${Math.floor(pruefungCounter/2) + 3}-${String(pruefungCounter + 1).padStart(3, '0')}`;
                
                // Berechne Punktzahl (80-95)
                const punktzahl = (80 + Math.random() * 15).toFixed(1);
                
                // Berechne Prüfungsgebühr (25-50€)
                const pruefungsgebuehr = (25 + Math.random() * 25).toFixed(2);
                
                const insertQuery = `
                    INSERT INTO pruefungen (
                        mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id,
                        pruefungsdatum, pruefungsort, bestanden, punktzahl, max_punktzahl,
                        prueferkommentar, pruefungsgebuehr, gebuehr_bezahlt, bezahldatum,
                        urkunde_ausgestellt, urkunde_nr, status, anmerkungen,
                        erstellt_am, aktualisiert_am, pruefungszeit
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const values = [
                    58, // mitglied_id
                    stil.stil_id, // stil_id
                    2, // dojo_id
                    vorherigeGraduierung?.graduierung_id || null, // graduierung_vorher_id
                    graduierung.graduierung_id, // graduierung_nachher_id
                    pruefungsdatum.toISOString().split('T')[0], // pruefungsdatum
                    'Hauptdojo', // pruefungsort
                    1, // bestanden
                    punktzahl, // punktzahl
                    '100.00', // max_punktzahl
                    `Sehr gute Prüfung in ${stil.stil_name}. Technische Präzision und Kampfgeist ausgezeichnet.`, // prueferkommentar
                    pruefungsgebuehr, // pruefungsgebuehr
                    1, // gebuehr_bezahlt
                    new Date(pruefungsdatum.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // bezahldatum
                    1, // urkunde_ausgestellt
                    urkundeNr, // urkunde_nr
                    'bestanden', // status
                    `Tom zeigt große Fortschritte in ${stil.stil_name}. Seine Disziplin und Hingabe sind beeindruckend.`, // anmerkungen
                    new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0], // erstellt_am
                    new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0], // aktualisiert_am
                    '10:00:00' // pruefungszeit
                ];
                
                await connection.execute(insertQuery, values);
                console.log(`✅ Prüfung ${pruefungCounter + 1}: ${vorherigeGraduierung?.name || 'Anfänger'} → ${graduierung.name} (${punktzahl} Punkte)`);
                
                pruefungCounter++;
            }
        }
        
        // 4. Prüfe das Ergebnis
        const [neuePruefungen] = await connection.execute(`
            SELECT COUNT(*) as anzahl FROM pruefungen WHERE mitglied_id = 58
        `);
        
        console.log(`\n🎉 Erfolgreich erstellt: ${neuePruefungen[0].anzahl} Prüfungen für ID 58`);
        
        // 5. Zeige Statistiken nach Stilen
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
        console.error('❌ Fehler beim Erstellen der Prüfungsdaten:', error);
    } finally {
        db.end();
    }
}

createAllStilePruefungen();
