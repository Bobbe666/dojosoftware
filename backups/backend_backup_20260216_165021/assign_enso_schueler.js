const db = require('./db');

console.log('\n====== ENSO KARATE SCHÜLER ZUWEISEN ======\n');

// Stil-ID für Enso Karate
const ENSO_STIL_ID = 5;

// Gürtel-IDs für Enso Karate
const GURTEL = {
  WEISS: 47,
  WEISS_GELB: 63,
  GELB: 48,
  GRUEN: 50,
  BLAU_BRAUN: 62,
  BLAU: 64,
  ROT_SCHWARZ: 65,
  SCHWARZ: 51
};

// Schüler-Zuweisung: [mitglied_id, graduierung_id, name]
const zuweisung = [
  // Weißgurt (4 Schüler - Anfänger sind meist mehr)
  [32, GURTEL.WEISS, 'Florian Albrecht'],
  [8, GURTEL.WEISS, 'Jonas Bauer'],
  [14, GURTEL.WEISS, 'Ben Becker'],
  [2, GURTEL.WEISS, 'Anna Beispiel'],

  // Weiß-Gelbgurt (3 Schüler)
  [37, GURTEL.WEISS_GELB, 'Lena Berger'],
  [36, GURTEL.WEISS_GELB, 'Julian Böhme'],
  [22, GURTEL.WEISS_GELB, 'Tim Braun'],

  // Gelbgurt (3 Schüler)
  [11, GURTEL.GELB, 'Mia Fischer'],
  [31, GURTEL.GELB, 'Johanna Franke'],
  [51, GURTEL.GELB, 'Mila Friedrich'],

  // Grüngurt (2 Schüler)
  [53, GURTEL.GRUEN, 'Leonie Graf'],
  [40, GURTEL.GRUEN, 'Tobias Groß'],

  // Blau-Braungurt (2 Schüler)
  [29, GURTEL.BLAU_BRAUN, 'Hannah Günther'],
  [41, GURTEL.BLAU_BRAUN, 'Mira Hahn'],

  // Blaugurt (2 Schüler)
  [23, GURTEL.BLAU, 'Nina Hartmann'],
  [35, GURTEL.BLAU, 'Amelie Heinrich'],

  // Rot-Schwarzgurt (2 Schüler)
  [15, GURTEL.ROT_SCHWARZ, 'Laura Hoffmann'],
  [27, GURTEL.ROT_SCHWARZ, 'Lisa Jung'],

  // Schwarzgurt (2 Schüler)
  [46, GURTEL.SCHWARZ, 'Fabian Kaiser'],
  [17, GURTEL.SCHWARZ, 'Julia Keller']
];

console.log(`Weise ${zuweisung.length} Schüler dem Stil "Enso Karate" (ID: ${ENSO_STIL_ID}) zu...\n`);

// Counter für Statistik
let erfolg = 0;
let fehler = 0;

// Funktion zum Update eines Schülers
const updateSchueler = (mitglied_id, graduierung_id, name) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE mitglieder
      SET stil_id = ?, graduierung_id = ?
      WHERE mitglied_id = ?
    `;

    db.query(query, [ENSO_STIL_ID, graduierung_id, mitglied_id], (err, result) => {
      if (err) {
        console.error(`❌ Fehler bei ${name} (ID: ${mitglied_id}):`, err.message);
        fehler++;
        reject(err);
      } else {
        console.log(`✅ ${name} (ID: ${mitglied_id}) → Gürtel-ID: ${graduierung_id}`);
        erfolg++;
        resolve(result);
      }
    });
  });
};

// Alle Updates sequenziell ausführen
async function assignAll() {
  for (const [mitglied_id, graduierung_id, name] of zuweisung) {
    try {
      await updateSchueler(mitglied_id, graduierung_id, name);
    } catch (err) {
      // Fehler werden bereits in updateSchueler geloggt
    }
  }

  console.log('\n====================================');
  console.log(`✅ Erfolgreich: ${erfolg}`);
  console.log(`❌ Fehler: ${fehler}`);
  console.log(`📊 Gesamt: ${zuweisung.length}`);
  console.log('====================================\n');

  process.exit(0);
}

assignAll();
