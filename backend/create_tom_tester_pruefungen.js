const db = require('./db.js');

async function createTomTesterPruefungen() {
    try {
        console.log('🎯 Erstelle Prüfungsdaten für Tom Tester...\n');
        
        // 1. Prüfe Tom Tester
        const [mitglieder] = await db.promise().query(`
            SELECT mitglied_id, vorname, nachname, dojo_id 
            FROM mitglieder 
            WHERE mitglied_id = 3
        `);
        
        if (mitglieder.length === 0) {
            console.log('❌ Tom Tester (ID: 3) nicht gefunden!');
            process.exit(1);
        }
        
        const tomTester = mitglieder[0];
        console.log(`✅ Tom Tester gefunden: ID ${tomTester.mitglied_id}, Dojo-ID ${tomTester.dojo_id}`);
        
        // 2. Hole Stil-IDs
        const [stile] = await db.promise().query(`
            SELECT stil_id, name FROM stile WHERE aktiv = 1
        `);
        
        console.log('📋 Verfügbare Stile:');
        stile.forEach(stil => {
            console.log(`  - ${stil.stil_id}: ${stil.name}`);
        });
        
        // Finde Taekwon-Do und BJJ
        const taekwondo = stile.find(s => s.name.toLowerCase().includes('taekwon') || s.name.toLowerCase().includes('taekwondo'));
        const bjj = stile.find(s => s.name.toLowerCase().includes('bjj') || s.name.toLowerCase().includes('brazilian') || s.name.toLowerCase().includes('jiu'));
        
        if (!taekwondo) {
            console.log('❌ Taekwon-Do Stil nicht gefunden!');
            process.exit(1);
        }
        
        if (!bjj) {
            console.log('❌ BJJ Stil nicht gefunden!');
            process.exit(1);
        }
        
        console.log(`✅ Taekwon-Do gefunden: ID ${taekwondo.stil_id}`);
        console.log(`✅ BJJ gefunden: ID ${bjj.stil_id}`);
        
        // 3. Hole Graduierungen für beide Stile
        const [graduierungen] = await db.promise().query(`
            SELECT graduierung_id, stil_id, name, reihenfolge 
            FROM graduierungen 
            WHERE stil_id IN (?, ?) AND aktiv = 1
            ORDER BY stil_id, reihenfolge
        `, [taekwondo.stil_id, bjj.stil_id]);
        
        console.log('🎖️ Verfügbare Graduierungen:');
        graduierungen.forEach(grad => {
            const stilName = grad.stil_id === taekwondo.stil_id ? 'Taekwon-Do' : 'BJJ';
            console.log(`  - ${stilName}: ${grad.graduierung_id} - ${grad.name}`);
        });
        
        // 4. Lösche bestehende Prüfungen für Tom Tester
        console.log('\n🗑️ Lösche bestehende Prüfungen...');
        const [deleteResult] = await db.promise().query(`
            DELETE FROM pruefungen WHERE mitglied_id = ?
        `, [tomTester.mitglied_id]);
        console.log(`✅ ${deleteResult.affectedRows} bestehende Prüfungen gelöscht`);
        
        // 5. Erstelle Prüfungsdaten
        const pruefungen = [
            // Taekwon-Do Prüfungen (5)
            {
                stil_id: taekwondo.stil_id,
                graduierung_vorher_id: null,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 1)?.graduierung_id,
                pruefungsdatum: '2023-03-15',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 85.5,
                max_punktzahl: 100.0,
                prueferkommentar: 'Sehr gute Grundtechniken gezeigt. Besonders die Grundstellungen waren exzellent.',
                pruefungsgebuehr: 25.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2023-03-10',
                urkunde_ausgestellt: true,
                urkunde_nr: 'TD-2023-001',
                status: 'bestanden',
                anmerkungen: 'Tom hat eine sehr solide Grundlage gelegt. Weiter so!'
            },
            {
                stil_id: taekwondo.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 1)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 2)?.graduierung_id,
                pruefungsdatum: '2023-08-20',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 92.0,
                max_punktzahl: 100.0,
                prueferkommentar: 'Hervorragende Verbesserung der Techniken. Kata sehr sauber ausgeführt.',
                pruefungsgebuehr: 30.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2023-08-15',
                urkunde_ausgestellt: true,
                urkunde_nr: 'TD-2023-002',
                status: 'bestanden',
                anmerkungen: 'Tom zeigt große Fortschritte. Seine Disziplin und Hingabe sind beeindruckend.'
            },
            {
                stil_id: taekwondo.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 2)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 3)?.graduierung_id,
                pruefungsdatum: '2024-01-12',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 88.5,
                max_punktzahl: 100.0,
                prueferkommentar: 'Gute Leistung in allen Bereichen. Kumite-Techniken verbesserungsfähig.',
                pruefungsgebuehr: 35.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2024-01-08',
                urkunde_ausgestellt: true,
                urkunde_nr: 'TD-2024-001',
                status: 'bestanden',
                anmerkungen: 'Tom arbeitet hart an seinen Schwächen. Kumite-Training empfohlen.'
            },
            {
                stil_id: taekwondo.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 3)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 4)?.graduierung_id,
                pruefungsdatum: '2024-06-18',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 95.0,
                max_punktzahl: 100.0,
                prueferkommentar: 'Exzellente Prüfung! Alle Techniken auf hohem Niveau. Besonders die Sprungtechniken beeindruckend.',
                pruefungsgebuehr: 40.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2024-06-14',
                urkunde_ausgestellt: true,
                urkunde_nr: 'TD-2024-002',
                status: 'bestanden',
                anmerkungen: 'Tom hat sich zu einem sehr talentierten Schüler entwickelt. Bereit für höhere Graduierungen.'
            },
            {
                stil_id: taekwondo.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 4)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === taekwondo.stil_id && g.reihenfolge === 5)?.graduierung_id,
                pruefungsdatum: '2024-11-25',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 90.5,
                max_punktzahl: 100.0,
                prueferkommentar: 'Sehr gute Prüfung. Technische Präzision und Kampfgeist ausgezeichnet.',
                pruefungsgebuehr: 45.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2024-11-20',
                urkunde_ausgestellt: true,
                urkunde_nr: 'TD-2024-003',
                status: 'bestanden',
                anmerkungen: 'Tom ist ein Vorbild für andere Schüler. Seine Führungsqualitäten werden deutlich.'
            },
            
            // BJJ Prüfungen (3)
            {
                stil_id: bjj.stil_id,
                graduierung_vorher_id: null,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === bjj.stil_id && g.reihenfolge === 1)?.graduierung_id,
                pruefungsdatum: '2023-05-10',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 82.0,
                max_punktzahl: 100.0,
                prueferkommentar: 'Gute Grundlagen im Bodenkampf. Escapes und Positionen verstanden.',
                pruefungsgebuehr: 30.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2023-05-05',
                urkunde_ausgestellt: true,
                urkunde_nr: 'BJJ-2023-001',
                status: 'bestanden',
                anmerkungen: 'Tom zeigt natürliches Verständnis für BJJ. Sein Wrestling-Hintergrund hilft.'
            },
            {
                stil_id: bjj.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === bjj.stil_id && g.reihenfolge === 1)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === bjj.stil_id && g.reihenfolge === 2)?.graduierung_id,
                pruefungsdatum: '2024-03-22',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 89.5,
                max_punktzahl: 100.0,
                prueferkommentar: 'Sehr gute Submission-Techniken. Guard-Spiel entwickelt sich gut.',
                pruefungsgebuehr: 40.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2024-03-18',
                urkunde_ausgestellt: true,
                urkunde_nr: 'BJJ-2024-001',
                status: 'bestanden',
                anmerkungen: 'Tom ist ein natürlicher Grappler. Seine Kreativität im Bodenkampf ist beeindruckend.'
            },
            {
                stil_id: bjj.stil_id,
                graduierung_vorher_id: graduierungen.find(g => g.stil_id === bjj.stil_id && g.reihenfolge === 2)?.graduierung_id,
                graduierung_nachher_id: graduierungen.find(g => g.stil_id === bjj.stil_id && g.reihenfolge === 3)?.graduierung_id,
                pruefungsdatum: '2024-10-15',
                pruefungsort: 'Hauptdojo',
                bestanden: true,
                punktzahl: 93.0,
                max_punktzahl: 100.0,
                prueferkommentar: 'Exzellente Prüfung! Alle Aspekte des BJJ gemeistert. Bereit für höhere Graduierungen.',
                pruefungsgebuehr: 50.00,
                gebuehr_bezahlt: true,
                bezahldatum: '2024-10-10',
                urkunde_ausgestellt: true,
                urkunde_nr: 'BJJ-2024-002',
                status: 'bestanden',
                anmerkungen: 'Tom ist zu einem sehr gefährlichen Grappler geworden. Seine Technik und Athletik sind ausgezeichnet.'
            }
        ];
        
        // 6. Füge Prüfungen ein
        console.log('\n📝 Füge Prüfungen ein...');
        let eingefuegt = 0;
        
        for (const pruefung of pruefungen) {
            if (pruefung.graduierung_nachher_id) {
                const [result] = await db.promise().query(`
                    INSERT INTO pruefungen (
                        mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id,
                        pruefungsdatum, pruefungsort, bestanden, punktzahl, max_punktzahl,
                        prueferkommentar, pruefungsgebuehr, gebuehr_bezahlt, bezahldatum,
                        urkunde_ausgestellt, urkunde_nr, status, anmerkungen, erstellt_am
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    tomTester.mitglied_id,
                    pruefung.stil_id,
                    tomTester.dojo_id,
                    pruefung.graduierung_vorher_id,
                    pruefung.graduierung_nachher_id,
                    pruefung.pruefungsdatum,
                    pruefung.pruefungsort,
                    pruefung.bestanden,
                    pruefung.punktzahl,
                    pruefung.max_punktzahl,
                    pruefung.prueferkommentar,
                    pruefung.pruefungsgebuehr,
                    pruefung.gebuehr_bezahlt,
                    pruefung.bezahldatum,
                    pruefung.urkunde_ausgestellt,
                    pruefung.urkunde_nr,
                    pruefung.status,
                    pruefung.anmerkungen
                ]);
                
                eingefuegt++;
                console.log(`✅ Prüfung ${eingefuegt} eingefügt: ${pruefung.pruefungsdatum} - ${pruefung.urkunde_nr}`);
            } else {
                console.log(`⚠️ Prüfung übersprungen: Graduierung nicht gefunden`);
            }
        }
        
        console.log(`\n🎉 ${eingefuegt} Prüfungen erfolgreich für Tom Tester erstellt!`);
        
        // 7. Zeige Statistiken
        console.log('\n📊 Prüfungsstatistiken:');
        const [stats] = await db.promise().query(`
            SELECT 
                s.name AS stil_name,
                COUNT(*) AS anzahl_pruefungen,
                SUM(CASE WHEN p.bestanden = TRUE THEN 1 ELSE 0 END) AS bestanden,
                ROUND(AVG(p.punktzahl), 1) AS durchschnittspunktzahl,
                SUM(p.pruefungsgebuehr) AS gesamtgebuehren
            FROM pruefungen p
            JOIN stile s ON p.stil_id = s.stil_id
            WHERE p.mitglied_id = ?
            GROUP BY s.name
        `, [tomTester.mitglied_id]);
        
        console.table(stats);
        
        console.log('\n✅ Script erfolgreich abgeschlossen!');
        
    } catch (error) {
        console.error('❌ Fehler:', error);
    } finally {
        process.exit(0);
    }
}

createTomTesterPruefungen();
