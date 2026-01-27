const db = require('../db');

console.log('📦 Erstelle Beispiel-Beiträge für Mahnwesen...');

// Hole zunächst einige Mitglieder aus der Datenbank
const getMitgliederQuery = `
  SELECT mitglied_id, dojo_id
  FROM mitglieder
  LIMIT 10
`;

db.query(getMitgliederQuery, (err, mitglieder) => {
  if (err) {
    console.error('❌ Fehler beim Abrufen der Mitglieder:', err);
    process.exit(1);
  }

  if (mitglieder.length === 0) {
    console.log('⚠️ Keine Mitglieder gefunden. Bitte erst Mitglieder anlegen.');
    process.exit(0);
  }

  console.log(`✅ ${mitglieder.length} Mitglieder gefunden`);

  // Erstelle verschiedene Beiträge (bezahlt und unbezahlt) für realistisches Mahnwesen
  const beitraege = [];

  // Für jedes Mitglied erstelle 2-3 Beiträge
  mitglieder.forEach((mitglied, index) => {
    const dojo_id = mitglied.dojo_id || 1;

    // Bezahlter Beitrag (aktueller Monat)
    beitraege.push([
      mitglied.mitglied_id,
      50.00 + (index * 5), // Verschiedene Beträge
      'lastschrift',
      new Date(new Date().setDate(1)).toISOString().split('T')[0], // Erster des Monats
      1, // bezahlt
      dojo_id
    ]);

    // Unbezahlter Beitrag (vor 15 Tagen fällig)
    if (index % 3 === 0) {
      const vor15Tagen = new Date();
      vor15Tagen.setDate(vor15Tagen.getDate() - 15);
      beitraege.push([
        mitglied.mitglied_id,
        45.00 + (index * 3),
        'ueberweisung',
        vor15Tagen.toISOString().split('T')[0],
        0, // nicht bezahlt
        dojo_id
      ]);
    }

    // Unbezahlter Beitrag (vor 35 Tagen fällig - überfällig)
    if (index % 2 === 0) {
      const vor35Tagen = new Date();
      vor35Tagen.setDate(vor35Tagen.getDate() - 35);
      beitraege.push([
        mitglied.mitglied_id,
        55.00 + (index * 4),
        'ueberweisung',
        vor35Tagen.toISOString().split('T')[0],
        0, // nicht bezahlt
        dojo_id
      ]);
    }

    // Unbezahlter Beitrag (vor 60 Tagen fällig - stark überfällig)
    if (index % 4 === 0) {
      const vor60Tagen = new Date();
      vor60Tagen.setDate(vor60Tagen.getDate() - 60);
      beitraege.push([
        mitglied.mitglied_id,
        60.00 + (index * 2),
        'lastschrift',
        vor60Tagen.toISOString().split('T')[0],
        0, // nicht bezahlt
        dojo_id
      ]);
    }
  });

  console.log(`📝 Erstelle ${beitraege.length} Beispiel-Beiträge...`);

  const insertQuery = `
    INSERT INTO beitraege (mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt, dojo_id)
    VALUES ?
  `;

  db.query(insertQuery, [beitraege], (insertErr, result) => {
    if (insertErr) {
      console.error('❌ Fehler beim Einfügen der Beiträge:', insertErr);
      process.exit(1);
    }

    console.log(`✅ ${result.affectedRows} Beiträge erfolgreich erstellt!`);
    console.log('📊 Davon sind mehrere unbezahlt und überfällig für das Mahnwesen.');

    // Erstelle auch ein paar Beispiel-Mahnungen
    createBeispielMahnungen();
  });
});

function createBeispielMahnungen() {
  console.log('📝 Erstelle Beispiel-Mahnungen...');

  // Hole unbezahlte Beiträge für Mahnungen
  const getOffeneQuery = `
    SELECT beitrag_id
    FROM beitraege
    WHERE bezahlt = 0
    LIMIT 5
  `;

  db.query(getOffeneQuery, (err, offeneBeitraege) => {
    if (err) {
      console.error('❌ Fehler beim Abrufen offener Beiträge:', err);
      process.exit(1);
    }

    if (offeneBeitraege.length === 0) {
      console.log('ℹ️ Keine offenen Beiträge für Mahnungen gefunden.');
      process.exit(0);
    }

    const mahnungen = [];

    offeneBeitraege.forEach((beitrag, index) => {
      // Erstelle Mahnung Stufe 1 für jeden 2. Beitrag
      if (index % 2 === 0) {
        const vor10Tagen = new Date();
        vor10Tagen.setDate(vor10Tagen.getDate() - 10);
        mahnungen.push([
          beitrag.beitrag_id,
          1, // Mahnstufe 1
          vor10Tagen.toISOString().split('T')[0],
          5.00,
          1, // versandt
          'email'
        ]);
      }

      // Erstelle Mahnung Stufe 2 für jeden 3. Beitrag
      if (index % 3 === 0) {
        const vor5Tagen = new Date();
        vor5Tagen.setDate(vor5Tagen.getDate() - 5);
        mahnungen.push([
          beitrag.beitrag_id,
          2, // Mahnstufe 2
          vor5Tagen.toISOString().split('T')[0],
          10.00,
          0, // noch nicht versandt
          'email'
        ]);
      }
    });

    if (mahnungen.length === 0) {
      console.log('✅ Keine Mahnungen zu erstellen.');
      process.exit(0);
      return;
    }

    const insertMahnungenQuery = `
      INSERT INTO mahnungen (beitrag_id, mahnstufe, mahndatum, mahngebuehr, versandt, versand_art)
      VALUES ?
    `;

    db.query(insertMahnungenQuery, [mahnungen], (mahnErr, mahnResult) => {
      if (mahnErr) {
        console.error('❌ Fehler beim Einfügen der Mahnungen:', mahnErr);
        process.exit(1);
      }

      console.log(`✅ ${mahnResult.affectedRows} Mahnungen erfolgreich erstellt!`);
      console.log('🎉 Beispieldaten für Mahnwesen vollständig!');
      process.exit(0);
    });
  });
}
