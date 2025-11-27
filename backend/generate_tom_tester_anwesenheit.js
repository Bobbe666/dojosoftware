const db = require('./db.js');

async function generateAnwesenheitForTomTester() {
    try {
        console.log('🔍 Generiere 300 Anwesenheitstage für Tom Tester...\n');
        
        // 1. Prüfe Tom Tester
        const [mitglieder] = await db.promise().query(`
            SELECT mitglied_id, vorname, nachname, dojo_id 
            FROM mitglieder 
            WHERE vorname = 'Tom' AND nachname = 'Tester'
        `);
        
        if (mitglieder.length === 0) {
            console.log('❌ Tom Tester nicht gefunden!');
            process.exit(1);
        }
        
        const tomTester = mitglieder[0];
        console.log(`✅ Tom Tester gefunden: ID ${tomTester.mitglied_id}, Dojo-ID ${tomTester.dojo_id}`);
        
        // 2. Lösche bestehende Anwesenheitsdaten für Tom Tester
        console.log('\n🗑️ Lösche bestehende Anwesenheitsdaten...');
        const [deleteResult] = await db.promise().query(`
            DELETE FROM anwesenheit 
            WHERE mitglied_id = ?
        `, [tomTester.mitglied_id]);
        console.log(`✅ ${deleteResult.affectedRows} bestehende Einträge gelöscht`);
        
        // 3. Generiere 300 realistische Anwesenheitstage
        console.log('\n📅 Generiere 300 Anwesenheitstage...');
        
        const anwesenheitDaten = [];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        // Generiere Daten für das Jahr 2024
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const datum = new Date(d);
            
            // Überspringe Wochenenden (Samstag = 6, Sonntag = 0)
            if (datum.getDay() === 0 || datum.getDay() === 6) {
                continue;
            }
            
            // Überspringe Feiertage (vereinfacht)
            const month = datum.getMonth() + 1;
            const day = datum.getDate();
            
            // Deutsche Feiertage 2024 (vereinfacht)
            if ((month === 1 && day === 1) ||    // Neujahr
                (month === 3 && day === 29) ||   // Karfreitag
                (month === 4 && day === 1) ||    // Ostermontag
                (month === 5 && day === 1) ||    // Tag der Arbeit
                (month === 5 && day === 9) ||    // Christi Himmelfahrt
                (month === 5 && day === 20) ||   // Pfingstmontag
                (month === 10 && day === 3) ||   // Tag der Deutschen Einheit
                (month === 12 && day === 25) ||  // Weihnachten
                (month === 12 && day === 26)) {  // 2. Weihnachtstag
                continue;
            }
            
            // Zufällige Abwesenheit (5% Wahrscheinlichkeit)
            const anwesend = Math.random() > 0.05 ? 1 : 0;
            
            anwesenheitDaten.push([
                tomTester.mitglied_id,
                datum.toISOString().split('T')[0], // YYYY-MM-DD Format
                anwesend,
                tomTester.dojo_id
            ]);
        }
        
        // Füge auch einige Daten für 2025 hinzu (bis heute)
        const heute2025 = new Date();
        const start2025 = new Date('2025-01-01');
        
        for (let d = new Date(start2025); d <= heute2025; d.setDate(d.getDate() + 1)) {
            const datum = new Date(d);
            
            // Überspringe Wochenenden
            if (datum.getDay() === 0 || datum.getDay() === 6) {
                continue;
            }
            
            // Zufällige Abwesenheit (5% Wahrscheinlichkeit)
            const anwesend = Math.random() > 0.05 ? 1 : 0;
            
            anwesenheitDaten.push([
                tomTester.mitglied_id,
                datum.toISOString().split('T')[0],
                anwesend,
                tomTester.dojo_id
            ]);
        }
        
        console.log(`📊 ${anwesenheitDaten.length} Anwesenheitstage generiert`);
        
        // 4. Hole verfügbare Stundenplan-IDs
        console.log('\n📋 Hole verfügbare Stundenplan-IDs...');
        const [stundenplanIds] = await db.promise().query(`
            SELECT stundenplan_id FROM stundenplan LIMIT 1
        `);
        
        if (stundenplanIds.length === 0) {
            console.log('❌ Keine Stundenplan-IDs gefunden!');
            process.exit(1);
        }
        
        const defaultStundenplanId = stundenplanIds[0].stundenplan_id;
        console.log(`✅ Verwende Stundenplan-ID: ${defaultStundenplanId}`);
        
        // 5. Füge Daten in die Datenbank ein
        console.log('\n💾 Füge Daten in die Datenbank ein...');
        
        const insertQuery = `
            INSERT INTO anwesenheit (mitglied_id, stundenplan_id, datum, anwesend, dojo_id) 
            VALUES ?
        `;
        
        // Erweitere die Daten um stundenplan_id
        const anwesenheitDatenMitStundenplan = anwesenheitDaten.map(row => [
            row[0], // mitglied_id
            defaultStundenplanId, // stundenplan_id
            row[1], // datum
            row[2], // anwesend
            row[3]  // dojo_id
        ]);
        
        const [insertResult] = await db.promise().query(insertQuery, [anwesenheitDatenMitStundenplan]);
        console.log(`✅ ${insertResult.affectedRows} Anwesenheitstage eingefügt`);
        
        // 6. Statistiken anzeigen
        console.log('\n📈 Statistiken:');
        
        const [stats] = await db.promise().query(`
            SELECT 
                COUNT(*) as Gesamt_Tage,
                SUM(CASE WHEN anwesend = 1 THEN 1 ELSE 0 END) as Anwesend_Tage,
                SUM(CASE WHEN anwesend = 0 THEN 1 ELSE 0 END) as Abwesend_Tage,
                MIN(datum) as Erster_Tag,
                MAX(datum) as Letzter_Tag,
                ROUND((SUM(CASE WHEN anwesend = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as Anwesenheitsquote_Prozent
            FROM anwesenheit 
            WHERE mitglied_id = ?
        `, [tomTester.mitglied_id]);
        
        console.table(stats);
        
        // 7. Zeige einige Beispiele
        console.log('\n📋 Beispiele der eingefügten Daten:');
        const [beispiele] = await db.promise().query(`
            SELECT datum, 
                   CASE WHEN anwesend = 1 THEN '✅ Anwesend' ELSE '❌ Abwesend' END as Status
            FROM anwesenheit 
            WHERE mitglied_id = ?
            ORDER BY datum DESC
            LIMIT 10
        `, [tomTester.mitglied_id]);
        
        console.table(beispiele);
        
        console.log('\n✅ Anwesenheitsdaten erfolgreich generiert!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Fehler beim Generieren der Anwesenheitsdaten:', error);
        process.exit(1);
    }
}

generateAnwesenheitForTomTester();
