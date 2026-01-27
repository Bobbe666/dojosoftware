const db = require('../db');

async function addTomTesterFinanceData() {
  try {
    console.log('🚀 Starte Hinzufügung der Finanzdaten für Tom Tester...');

    // 1. Tom Tester finden
    const members = await new Promise((resolve, reject) => {
      db.query(`
        SELECT mitglied_id, vorname, nachname 
        FROM mitglieder 
        WHERE vorname = 'Tom' AND nachname = 'Tester'
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (members.length === 0) {
      console.log('❌ Tom Tester nicht gefunden!');
      return;
    }

    const tomTester = members[0];
    console.log(`✅ Tom Tester gefunden: ID ${tomTester.mitglied_id}`);

    // 2. Beiträge hinzufügen (Tabelle existiert bereits)
    console.log('💰 Füge monatliche Beiträge hinzu...');
    const startDate = new Date('2024-01-01');
    let kassenstand = 50000; // Startkassenstand: 500€

    for (let month = 0; month < 12; month++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + month);
      
      const faelligkeitsdatum = new Date(currentDate);
      const zahlungsdatum = new Date(currentDate);
      zahlungsdatum.setDate(zahlungsdatum.getDate() + Math.floor(Math.random() * 5)); // 0-4 Tage nach Fälligkeit

      const beitragBetrag = 8500; // 85€ in Cent
      const zahlungsart = ['ueberweisung', 'lastschrift', 'bar'][Math.floor(Math.random() * 3)];
      const status = Math.random() > 0.1 ? 'bezahlt' : 'ausstehend'; // 90% bezahlt

      // Beitrag hinzufügen
      await new Promise((resolve, reject) => {
        db.query(`
          INSERT INTO beitraege (
            mitglied_id, dojo_id, betrag, zahlungsart, 
            zahlungsdatum, bezahlt
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          tomTester.mitglied_id,
          1, // dojo_id
          beitragBetrag / 100, // Betrag in Euro (decimal)
          zahlungsart,
          zahlungsdatum.toISOString().split('T')[0],
          status === 'bezahlt' ? 1 : 0 // bezahlt als tinyint
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Kassenbuch-Eintrag für bezahlte Beiträge (nur wenn Tabelle existiert)
      if (status === 'bezahlt') {
        kassenstand += beitragBetrag;
      }
    }

    // 6. Verkäufe hinzufügen (Getränke, Snacks, etc.)
    console.log('🛒 Füge Verkäufe hinzu...');
    const verkaufsArtikel = [
      { name: 'Wasser 0,5L', preis: 150 },
      { name: 'Apfelschorle 0,5L', preis: 200 },
      { name: 'Energy Drink', preis: 250 },
      { name: 'Proteinriegel', preis: 280 },
      { name: 'Nussmischung', preis: 320 },
      { name: 'Proteinshake', preis: 350 }
    ];

    // 2-3 Verkäufe pro Monat
    for (let month = 0; month < 12; month++) {
      const verkaufsAnzahl = Math.floor(Math.random() * 2) + 2; // 2-3 Verkäufe
      
      for (let verkauf = 0; verkauf < verkaufsAnzahl; verkauf++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + month);
        currentDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 28) + 1);
        
        const artikel = verkaufsArtikel[Math.floor(Math.random() * verkaufsArtikel.length)];
        const anzahl = Math.floor(Math.random() * 3) + 1; // 1-3 Stück
        const gesamtpreis = artikel.preis * anzahl;
        
        const zahlungsart = ['bar', 'karte'][Math.floor(Math.random() * 2)];
        
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO verkaeufe (
              bon_nummer, kassen_id, mitglied_id, kunde_name,
              verkauf_datum, verkauf_uhrzeit, brutto_gesamt_cent, zahlungsart
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            `BON-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            'KASSE_01',
            tomTester.mitglied_id,
            `${tomTester.vorname} ${tomTester.nachname}`,
            currentDate.toISOString().split('T')[0],
            `${String(Math.floor(Math.random() * 12) + 8).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
            gesamtpreis,
            zahlungsart
          ], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Kassenbuch-Eintrag (nur wenn Tabelle existiert)
        kassenstand += gesamtpreis;
      }
    }

    // 7. Zusammenfassung
    const beitraegeCount = await new Promise((resolve, reject) => {
      db.query(`
        SELECT COUNT(*) as count FROM beitraege WHERE mitglied_id = ?
      `, [tomTester.mitglied_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const verkaeufeCount = await new Promise((resolve, reject) => {
      db.query(`
        SELECT COUNT(*) as count FROM verkaeufe WHERE mitglied_id = ?
      `, [tomTester.mitglied_id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('✅ Finanzdaten erfolgreich hinzugefügt!');
    console.log(`📊 Zusammenfassung:`);
    console.log(`   - Beiträge: ${beitraegeCount[0].count}`);
    console.log(`   - Verkäufe: ${verkaeufeCount[0].count}`);
    console.log(`   - Finaler Kassenstand: ${(kassenstand / 100).toFixed(2)}€`);

  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen der Finanzdaten:', error);
  }
}

// Script ausführen
addTomTesterFinanceData();