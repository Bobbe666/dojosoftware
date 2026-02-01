/**
 * Seed-Script für EÜR Testdaten
 * ==============================
 * Erstellt realistische Finanzdaten für die lokale Entwicklungsumgebung:
 * - Beiträge (bezahlt)
 * - Rechnungen (bezahlt, offen, überfällig)
 * - Verkäufe
 * - Kassenbuch-Ausgaben
 * - Rücklastschriften (über Mahnungen)
 */

const db = require('../db');

let DOJO_ID = 3; // Wird dynamisch ermittelt
const YEAR = new Date().getFullYear(); // Aktuelles Jahr
const FULL_YEAR = true; // true = alle 12 Monate, false = nur bis aktuellen Monat

// Hilfsfunktionen
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const formatDate = (date) => date.toISOString().split('T')[0];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedEuerTestData() {
  try {
    console.log('🚀 Starte EÜR Testdaten Seed...\n');

    // 0. Ermittle verfügbare Dojo-ID (inkl. TDA mit ID 2)
    const dojos = await queryAsync(`SELECT id, dojoname FROM dojo ORDER BY id LIMIT 5`);
    if (dojos.length > 0) {
      // Finde TDA (ID 2) und ein normales Dojo
      const tdaDojo = dojos.find(d => d.id === 2);
      const normalDojo = dojos.find(d => d.id !== 2);

      if (tdaDojo) {
        console.log(`🏠 TDA gefunden: ${tdaDojo.dojoname} (ID: 2)`);
      }
      if (normalDojo) {
        DOJO_ID = normalDojo.id;
        console.log(`🏠 Normales Dojo: ${normalDojo.dojoname} (ID: ${DOJO_ID})\n`);
      }
    } else {
      console.log('❌ Kein Dojo gefunden!');
      process.exit(1);
    }

    // Auch TDA-Daten erstellen
    const TDA_DOJO_ID = 2;

    // 0b. Cleanup - Lösche bestehende Testdaten für das Jahr (beide Dojos)
    console.log('🧹 Lösche bestehende Testdaten...');

    // Cleanup für normales Dojo
    await queryAsync(`DELETE FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ?`, [DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM verkaeufe WHERE dojo_id = ? AND YEAR(verkauf_datum) = ?`, [DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM rechnungen WHERE dojo_id = ? AND YEAR(datum) = ?`, [DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ?`, [DOJO_ID, YEAR]);
    console.log(`   - Dojo ${DOJO_ID} bereinigt`);

    // Cleanup für TDA
    await queryAsync(`DELETE FROM kassenbuch WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ?`, [TDA_DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM verkaeufe WHERE dojo_id = ? AND YEAR(verkauf_datum) = ?`, [TDA_DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM rechnungen WHERE dojo_id = ? AND YEAR(datum) = ?`, [TDA_DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM beitraege WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ?`, [TDA_DOJO_ID, YEAR]);
    await queryAsync(`DELETE FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(bezahlt_am) = ?`, [YEAR]);
    console.log(`   - TDA (ID 2) bereinigt`);

    console.log('   ✅ Cleanup abgeschlossen\n');

    // 1. Prüfe ob Mitglieder existieren
    const mitglieder = await queryAsync(`
      SELECT mitglied_id, vorname, nachname
      FROM mitglieder
      WHERE dojo_id = ?
      LIMIT 20
    `, [DOJO_ID]);

    if (mitglieder.length === 0) {
      console.log('❌ Keine Mitglieder gefunden! Bitte erst Mitglieder anlegen.');
      process.exit(1);
    }

    console.log(`✅ ${mitglieder.length} Mitglieder gefunden\n`);

    // =====================================================
    // BEITRÄGE (Einnahmen)
    // =====================================================
    console.log('💰 Erstelle Beiträge...');

    let beitraegeCount = 0;
    const beitragsBetraege = [39.90, 49.90, 59.90, 79.90, 99.00];
    const zahlungsarten = ['lastschrift', 'ueberweisung', 'bar'];

    for (const mitglied of mitglieder) {
      const beitragBetrag = randomFromArray(beitragsBetraege);

      // Beiträge für jeden Monat des Jahres (bis zum aktuellen Monat)
      const aktuellerMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

      for (let monat = 1; monat <= aktuellerMonat; monat++) {
        const zahlungsdatum = new Date(YEAR, monat - 1, randomBetween(1, 15));
        const bezahlt = Math.random() > 0.05; // 95% bezahlt

        await queryAsync(`
          INSERT INTO beitraege (
            mitglied_id, dojo_id, betrag, zahlungsart,
            zahlungsdatum, bezahlt
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          mitglied.mitglied_id,
          DOJO_ID,
          beitragBetrag,
          randomFromArray(zahlungsarten),
          formatDate(zahlungsdatum),
          bezahlt ? 1 : 0
        ]);
        beitraegeCount++;
      }
    }
    console.log(`   ✅ ${beitraegeCount} Beiträge erstellt\n`);

    // =====================================================
    // RECHNUNGEN (Einnahmen)
    // =====================================================
    console.log('📄 Erstelle Rechnungen...');

    let rechnungenCount = 0;
    const rechnungsArten = ['pruefungsgebuehr', 'kursgebuehr', 'ausruestung', 'sonstiges'];
    const rechnungsBetraege = {
      pruefungsgebuehr: [35.00, 45.00, 55.00, 75.00],
      kursgebuehr: [120.00, 180.00, 250.00],
      ausruestung: [25.00, 49.90, 89.00, 129.00],
      sonstiges: [15.00, 25.00, 50.00]
    };

    for (const mitglied of mitglieder.slice(0, 10)) { // Nur 10 Mitglieder für Rechnungen
      const anzahlRechnungen = randomBetween(1, 4);

      for (let i = 0; i < anzahlRechnungen; i++) {
        const art = randomFromArray(rechnungsArten);
        const betrag = randomFromArray(rechnungsBetraege[art]);
        const datum = new Date(YEAR, randomBetween(0, new Date().getMonth()), randomBetween(1, 28));
        const faelligkeitsdatum = new Date(datum);
        faelligkeitsdatum.setDate(faelligkeitsdatum.getDate() + 14);

        // 70% bezahlt, 20% offen, 10% überfällig
        const statusRoll = Math.random();
        let status, bezahlt_am;

        if (statusRoll < 0.7) {
          status = 'bezahlt';
          bezahlt_am = new Date(datum);
          bezahlt_am.setDate(bezahlt_am.getDate() + randomBetween(1, 14));
        } else if (statusRoll < 0.9) {
          status = 'offen';
          bezahlt_am = null;
        } else {
          status = 'ueberfaellig';
          bezahlt_am = null;
        }

        const rechnungsnummer = `RE-${YEAR}-${String(rechnungenCount + 1).padStart(5, '0')}-${Date.now().toString().slice(-4)}`;

        await queryAsync(`
          INSERT INTO rechnungen (
            rechnungsnummer, mitglied_id, dojo_id, datum, faelligkeitsdatum,
            betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
            status, bezahlt_am, art, beschreibung
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rechnungsnummer,
          mitglied.mitglied_id,
          DOJO_ID,
          formatDate(datum),
          formatDate(faelligkeitsdatum),
          betrag,
          betrag / 1.19,
          betrag,
          19.00,
          betrag - (betrag / 1.19),
          status,
          bezahlt_am ? formatDate(bezahlt_am) : null,
          art,
          `${art.charAt(0).toUpperCase() + art.slice(1)} für ${mitglied.vorname} ${mitglied.nachname}`
        ]);
        rechnungenCount++;
      }
    }
    console.log(`   ✅ ${rechnungenCount} Rechnungen erstellt\n`);

    // =====================================================
    // VERKÄUFE (Einnahmen)
    // =====================================================
    console.log('🛒 Erstelle Verkäufe...');

    let verkaeufeCount = 0;
    const verkaufsArtikel = [
      { name: 'Wasser 0,5L', preis: 150 },
      { name: 'Apfelschorle 0,5L', preis: 200 },
      { name: 'Energy Drink', preis: 280 },
      { name: 'Proteinriegel', preis: 320 },
      { name: 'Proteinshake', preis: 450 },
      { name: 'Handschuhe Paar', preis: 2500 },
      { name: 'Schienbeinschoner', preis: 3500 },
      { name: 'Gürtel', preis: 1200 },
      { name: 'T-Shirt Dojo', preis: 2990 },
      { name: 'Trainingsanzug', preis: 5990 }
    ];

    const verkaufsMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

    for (let monat = 1; monat <= verkaufsMonat; monat++) {
      const verkaufsAnzahl = randomBetween(15, 35); // 15-35 Verkäufe pro Monat

      for (let i = 0; i < verkaufsAnzahl; i++) {
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));
        const artikel = randomFromArray(verkaufsArtikel);
        const anzahl = randomBetween(1, 3);
        const bruttoGesamt = artikel.preis * anzahl;
        const nettoGesamt = Math.round(bruttoGesamt / 1.19);
        const mwstGesamt = bruttoGesamt - nettoGesamt;

        const mitglied = Math.random() > 0.3 ? randomFromArray(mitglieder) : null;
        const zahlungsart = randomFromArray(['bar', 'karte', 'bar', 'bar']); // Mehr Bar-Zahlungen

        const uhrzeit = `${String(randomBetween(8, 21)).padStart(2, '0')}:${String(randomBetween(0, 59)).padStart(2, '0')}:00`;
        const timestamp = `${formatDate(datum)} ${uhrzeit}`;

        await queryAsync(`
          INSERT INTO verkaeufe (
            bon_nummer, kassen_id, dojo_id, mitglied_id, kunde_name,
            verkauf_datum, verkauf_uhrzeit, verkauf_timestamp,
            brutto_gesamt_cent, netto_gesamt_cent, mwst_gesamt_cent,
            zahlungsart, storniert
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `BON-${YEAR}${String(monat).padStart(2, '0')}-${String(verkaeufeCount + 1).padStart(4, '0')}-${Date.now().toString().slice(-6)}`,
          'KASSE_01',
          DOJO_ID,
          mitglied ? mitglied.mitglied_id : null,
          mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : 'Laufkunde',
          formatDate(datum),
          uhrzeit,
          timestamp,
          bruttoGesamt,
          nettoGesamt,
          mwstGesamt,
          zahlungsart,
          0
        ]);
        verkaeufeCount++;
      }
    }
    console.log(`   ✅ ${verkaeufeCount} Verkäufe erstellt\n`);

    // =====================================================
    // KASSENBUCH - AUSGABEN
    // =====================================================
    console.log('📕 Erstelle Kassenbuch-Ausgaben...');

    let ausgabenCount = 0;
    const ausgabenKategorien = [
      { kategorie: 'miete', betrag: [150000, 180000, 200000], beschreibung: 'Miete Trainingsraum' },
      { kategorie: 'personal', betrag: [50000, 80000, 120000], beschreibung: 'Trainer Vergütung' },
      { kategorie: 'material', betrag: [5000, 15000, 25000], beschreibung: 'Trainingsmaterial' },
      { kategorie: 'marketing', betrag: [3000, 8000, 12000], beschreibung: 'Werbung & Flyer' },
      { kategorie: 'versicherung', betrag: [15000, 25000], beschreibung: 'Vereinsversicherung' },
      { kategorie: 'gebuehren', betrag: [2000, 5000, 8000], beschreibung: 'Bankgebühren & Lizenzgebühren' },
      { kategorie: 'telefon', betrag: [3000, 5000, 7000], beschreibung: 'Internet & Telefon' },
      { kategorie: 'software', betrag: [2000, 5000, 10000], beschreibung: 'Software-Lizenzen' },
      { kategorie: 'reparatur', betrag: [5000, 15000, 30000], beschreibung: 'Reparaturen & Wartung' },
      { kategorie: 'buero', betrag: [1000, 3000, 5000], beschreibung: 'Büromaterial' },
      { kategorie: 'sonstiges', betrag: [2000, 5000, 10000], beschreibung: 'Sonstige Ausgaben' }
    ];

    const ausgabenMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

    for (let monat = 1; monat <= ausgabenMonat; monat++) {
      // Fixkosten jeden Monat
      const fixkosten = ['miete', 'versicherung', 'telefon'];

      for (const fixkost of fixkosten) {
        const kat = ausgabenKategorien.find(k => k.kategorie === fixkost);
        const betrag = randomFromArray(kat.betrag);
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 5));

        await queryAsync(`
          INSERT INTO kassenbuch (
            dojo_id, geschaeft_datum, bewegungsart, betrag_cent,
            beschreibung, kategorie, kassenstand_vorher_cent, kassenstand_nachher_cent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          DOJO_ID,
          formatDate(datum),
          'Ausgabe',
          betrag,
          `${kat.beschreibung} ${new Date(YEAR, monat - 1).toLocaleString('de-DE', { month: 'long' })}`,
          kat.kategorie,
          0,  // kassenstand_vorher_cent
          0   // kassenstand_nachher_cent
        ]);
        ausgabenCount++;
      }

      // Variable Ausgaben (2-5 pro Monat)
      const variableAnzahl = randomBetween(2, 5);
      const variableKategorien = ausgabenKategorien.filter(k => !fixkosten.includes(k.kategorie));

      for (let i = 0; i < variableAnzahl; i++) {
        const kat = randomFromArray(variableKategorien);
        const betrag = randomFromArray(kat.betrag);
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));

        await queryAsync(`
          INSERT INTO kassenbuch (
            dojo_id, geschaeft_datum, bewegungsart, betrag_cent,
            beschreibung, kategorie, kassenstand_vorher_cent, kassenstand_nachher_cent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          DOJO_ID,
          formatDate(datum),
          'Ausgabe',
          betrag,
          kat.beschreibung,
          kat.kategorie,
          0,  // kassenstand_vorher_cent
          0   // kassenstand_nachher_cent
        ]);
        ausgabenCount++;
      }
    }
    console.log(`   ✅ ${ausgabenCount} Ausgaben erstellt\n`);

    // =====================================================
    // TDA-SPEZIFISCHE DATEN (Dojo-ID 2)
    // =====================================================
    console.log('🌐 Erstelle TDA-Daten (Tiger & Dragon Association)...');

    // TDA Mitglieder finden
    const tdaMitglieder = await queryAsync(`
      SELECT mitglied_id, vorname, nachname
      FROM mitglieder
      WHERE dojo_id = ?
      LIMIT 15
    `, [TDA_DOJO_ID]);

    console.log(`   ${tdaMitglieder.length} TDA-Mitglieder gefunden`);

    // TDA Beiträge - Nutze Mitglieder aus anderen Dojos falls keine TDA-Mitglieder
    let tdaBeitraegeCount = 0;
    const tdaBeitragsMitglieder = tdaMitglieder.length > 0 ? tdaMitglieder : mitglieder.slice(0, 10);

    for (const mitglied of tdaBeitragsMitglieder) {
      const beitragBetrag = randomFromArray([29.90, 39.90, 49.90]);
      const tdaMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

      for (let monat = 1; monat <= tdaMonat; monat++) {
        const zahlungsdatum = new Date(YEAR, monat - 1, randomBetween(1, 15));

        await queryAsync(`
          INSERT INTO beitraege (
            mitglied_id, dojo_id, betrag, zahlungsart, zahlungsdatum, bezahlt
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          mitglied.mitglied_id,
          TDA_DOJO_ID,
          beitragBetrag,
          randomFromArray(['lastschrift', 'ueberweisung']),
          formatDate(zahlungsdatum),
          1
        ]);
        tdaBeitraegeCount++;
      }
    }
    console.log(`   ✅ ${tdaBeitraegeCount} TDA-Beiträge erstellt`);

    // TDA Rechnungen (für Seminare, Lehrgänge etc.) - Nutze Mitglieder aus anderen Dojos
    let tdaRechnungenCount = 0;
    const alleMitglieder = tdaMitglieder.length > 0 ? tdaMitglieder : mitglieder;

    for (let i = 0; i < 15; i++) {
      const mitglied = randomFromArray(alleMitglieder);
      const betrag = randomFromArray([75.00, 120.00, 180.00, 250.00]);
      const monat = randomBetween(1, FULL_YEAR ? 12 : new Date().getMonth() + 1);
      const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));
      const bezahltAm = new Date(datum);
      bezahltAm.setDate(bezahltAm.getDate() + randomBetween(1, 14));

      await queryAsync(`
        INSERT INTO rechnungen (
          rechnungsnummer, mitglied_id, dojo_id, datum, faelligkeitsdatum,
          betrag, status, bezahlt_am, art, beschreibung
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `TDA-${YEAR}-${String(tdaRechnungenCount + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`,
        mitglied.mitglied_id,
        TDA_DOJO_ID,
        formatDate(datum),
        formatDate(new Date(datum.getTime() + 14 * 24 * 60 * 60 * 1000)),
        betrag,
        'bezahlt',
        formatDate(bezahltAm),
        'kursgebuehr',
        'TDA Lehrgang / Seminar'
      ]);
      tdaRechnungenCount++;
    }
    console.log(`   ✅ ${tdaRechnungenCount} TDA-Rechnungen erstellt`);

    // TDA Verkäufe
    let tdaVerkaeufeCount = 0;
    const tdaArtikel = [
      { name: 'TDA Lizenz', preis: 5000 },
      { name: 'Prüfungspass', preis: 1500 },
      { name: 'Dan-Urkunde', preis: 3500 },
      { name: 'TDA Polo-Shirt', preis: 3500 },
      { name: 'TDA Trainingsanzug', preis: 7500 }
    ];

    const tdaVerkaufsMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;
    for (let monat = 1; monat <= tdaVerkaufsMonat; monat++) {
      const anzahl = randomBetween(5, 15);
      for (let i = 0; i < anzahl; i++) {
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));
        const artikel = randomFromArray(tdaArtikel);
        const uhrzeit = `${String(randomBetween(9, 18)).padStart(2, '0')}:${String(randomBetween(0, 59)).padStart(2, '0')}:00`;

        await queryAsync(`
          INSERT INTO verkaeufe (
            bon_nummer, kassen_id, dojo_id, kunde_name,
            verkauf_datum, verkauf_uhrzeit, verkauf_timestamp,
            brutto_gesamt_cent, netto_gesamt_cent, mwst_gesamt_cent,
            zahlungsart, storniert
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `TDA-BON-${YEAR}${String(monat).padStart(2, '0')}-${String(tdaVerkaeufeCount + 1).padStart(4, '0')}-${Date.now().toString().slice(-6)}`,
          'TDA_KASSE',
          TDA_DOJO_ID,
          'Verbandsmitglied',
          formatDate(datum),
          uhrzeit,
          `${formatDate(datum)} ${uhrzeit}`,
          artikel.preis,
          Math.round(artikel.preis / 1.19),
          artikel.preis - Math.round(artikel.preis / 1.19),
          randomFromArray(['bar', 'karte', 'digital']),
          0
        ]);
        tdaVerkaeufeCount++;
      }
    }
    console.log(`   ✅ ${tdaVerkaeufeCount} TDA-Verkäufe erstellt`);

    // Verbandsmitgliedschaft-Zahlungen
    // Erst prüfen ob Verbandsmitgliedschaften existieren
    let verbandZahlungenCount = 0;
    try {
      const verbandsmitgliedschaften = await queryAsync(`
        SELECT id FROM verbandsmitgliedschaften WHERE status = 'aktiv' LIMIT 20
      `);

      if (verbandsmitgliedschaften.length > 0) {
        const verbandMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

        for (let monat = 1; monat <= verbandMonat; monat++) {
          // 5-10 Verbandszahlungen pro Monat
          const anzahl = Math.min(randomBetween(5, 10), verbandsmitgliedschaften.length);
          for (let i = 0; i < anzahl; i++) {
            const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));
            const betrag = randomFromArray([50.00, 75.00, 100.00, 150.00]);
            const vmId = verbandsmitgliedschaften[i % verbandsmitgliedschaften.length].id;

            await queryAsync(`
              INSERT INTO verbandsmitgliedschaft_zahlungen (
                verbandsmitgliedschaft_id, betrag_brutto, betrag_netto, bezahlt_am, status, zahlungsart
              ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
              vmId,
              betrag,
              betrag / 1.19,
              formatDate(datum),
              'bezahlt',
              'ueberweisung'
            ]);
            verbandZahlungenCount++;
          }
        }
        console.log(`   ✅ ${verbandZahlungenCount} Verbandsmitgliedschaft-Zahlungen erstellt`);
      } else {
        console.log(`   ⚠️ Keine Verbandsmitgliedschaften gefunden - übersprungen`);
      }
    } catch (err) {
      console.log(`   ⚠️ Verbandsmitgliedschaft-Zahlungen übersprungen (Tabelle existiert evtl. nicht)`);
    }

    // TDA Ausgaben (Kassenbuch)
    let tdaAusgabenCount = 0;
    const tdaAusgabenMonat = FULL_YEAR ? 12 : new Date().getMonth() + 1;

    for (let monat = 1; monat <= tdaAusgabenMonat; monat++) {
      // Fixkosten
      const fixkosten = [
        { kategorie: 'miete', betrag: 80000, beschreibung: 'Geschäftsstelle Miete' },
        { kategorie: 'versicherung', betrag: 25000, beschreibung: 'Verbandsversicherung' },
        { kategorie: 'telefon', betrag: 8000, beschreibung: 'Telefon & Internet' }
      ];

      for (const fix of fixkosten) {
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 5));
        await queryAsync(`
          INSERT INTO kassenbuch (
            dojo_id, geschaeft_datum, bewegungsart, betrag_cent,
            beschreibung, kategorie, kassenstand_vorher_cent, kassenstand_nachher_cent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          TDA_DOJO_ID,
          formatDate(datum),
          'Ausgabe',
          fix.betrag,
          fix.beschreibung,
          fix.kategorie,
          0, 0
        ]);
        tdaAusgabenCount++;
      }

      // Variable Ausgaben
      const variableAnzahl = randomBetween(2, 4);
      for (let i = 0; i < variableAnzahl; i++) {
        const datum = new Date(YEAR, monat - 1, randomBetween(1, 28));
        const kategorie = randomFromArray(['marketing', 'personal', 'buero', 'software', 'sonstiges']);
        const betrag = randomBetween(5000, 30000);

        await queryAsync(`
          INSERT INTO kassenbuch (
            dojo_id, geschaeft_datum, bewegungsart, betrag_cent,
            beschreibung, kategorie, kassenstand_vorher_cent, kassenstand_nachher_cent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          TDA_DOJO_ID,
          formatDate(datum),
          'Ausgabe',
          betrag,
          `TDA ${kategorie}`,
          kategorie,
          0, 0
        ]);
        tdaAusgabenCount++;
      }
    }
    console.log(`   ✅ ${tdaAusgabenCount} TDA-Ausgaben erstellt\n`);

    // =====================================================
    // ZUSAMMENFASSUNG
    // =====================================================
    console.log('📊 Zusammenfassung der erstellten Daten:');
    console.log('=========================================');

    // Beiträge Summe
    const [beitraegeSumme] = await queryAsync(`
      SELECT
        COUNT(*) as anzahl,
        SUM(CASE WHEN bezahlt = 1 THEN betrag ELSE 0 END) as bezahlt_summe,
        SUM(CASE WHEN bezahlt = 0 THEN betrag ELSE 0 END) as offen_summe
      FROM beitraege
      WHERE dojo_id = ? AND YEAR(zahlungsdatum) = ?
    `, [DOJO_ID, YEAR]);

    console.log(`\n💰 Beiträge:`);
    console.log(`   Anzahl: ${beitraegeSumme.anzahl}`);
    console.log(`   Bezahlt: ${parseFloat(beitraegeSumme.bezahlt_summe || 0).toFixed(2)} €`);
    console.log(`   Offen: ${parseFloat(beitraegeSumme.offen_summe || 0).toFixed(2)} €`);

    // Rechnungen Summe
    const [rechnungenSumme] = await queryAsync(`
      SELECT
        COUNT(*) as anzahl,
        SUM(CASE WHEN status = 'bezahlt' THEN betrag ELSE 0 END) as bezahlt_summe,
        SUM(CASE WHEN status != 'bezahlt' THEN betrag ELSE 0 END) as offen_summe
      FROM rechnungen
      WHERE dojo_id = ? AND YEAR(datum) = ?
    `, [DOJO_ID, YEAR]);

    console.log(`\n📄 Rechnungen:`);
    console.log(`   Anzahl: ${rechnungenSumme.anzahl}`);
    console.log(`   Bezahlt: ${parseFloat(rechnungenSumme.bezahlt_summe || 0).toFixed(2)} €`);
    console.log(`   Offen: ${parseFloat(rechnungenSumme.offen_summe || 0).toFixed(2)} €`);

    // Verkäufe Summe
    const [verkaufeSumme] = await queryAsync(`
      SELECT
        COUNT(*) as anzahl,
        SUM(brutto_gesamt_cent) / 100 as brutto_summe
      FROM verkaeufe
      WHERE dojo_id = ? AND YEAR(verkauf_datum) = ? AND (storniert IS NULL OR storniert = 0)
    `, [DOJO_ID, YEAR]);

    console.log(`\n🛒 Verkäufe:`);
    console.log(`   Anzahl: ${verkaufeSumme.anzahl}`);
    console.log(`   Brutto: ${parseFloat(verkaufeSumme.brutto_summe || 0).toFixed(2)} €`);

    // Ausgaben Summe
    const [ausgabenSumme] = await queryAsync(`
      SELECT
        COUNT(*) as anzahl,
        SUM(betrag_cent) / 100 as summe
      FROM kassenbuch
      WHERE dojo_id = ? AND YEAR(geschaeft_datum) = ? AND bewegungsart = 'Ausgabe'
    `, [DOJO_ID, YEAR]);

    console.log(`\n📕 Ausgaben:`);
    console.log(`   Anzahl: ${ausgabenSumme.anzahl}`);
    console.log(`   Summe: ${parseFloat(ausgabenSumme.summe || 0).toFixed(2)} €`);

    // EÜR Übersicht
    const einnahmenGesamt =
      parseFloat(beitraegeSumme.bezahlt_summe || 0) +
      parseFloat(rechnungenSumme.bezahlt_summe || 0) +
      parseFloat(verkaufeSumme.brutto_summe || 0);
    const ausgabenGesamt = parseFloat(ausgabenSumme.summe || 0);
    const ueberschuss = einnahmenGesamt - ausgabenGesamt;

    console.log(`\n📈 EÜR Übersicht ${YEAR}:`);
    console.log(`   Einnahmen gesamt: ${einnahmenGesamt.toFixed(2)} €`);
    console.log(`   Ausgaben gesamt: ${ausgabenGesamt.toFixed(2)} €`);
    console.log(`   ─────────────────────`);
    console.log(`   Überschuss: ${ueberschuss.toFixed(2)} €`);

    console.log('\n✅ EÜR Testdaten erfolgreich erstellt!');
    console.log('   Öffne jetzt die EÜR-Übersicht im Browser.\n');

  } catch (error) {
    console.error('❌ Fehler:', error.message);
    console.error(error.stack);
  } finally {
    process.exit();
  }
}

// Script ausführen
seedEuerTestData();
