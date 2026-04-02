// Quick Fix: Korrigiere loadPruefungsinhalte API-Route
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'PruefungDurchfuehren.jsx');

console.log('🔧 Repariere Prüfungsinhalte-Route...');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Fehler:', err);
    process.exit(1);
  }

  let content = data;

  // 1. Ändere Funktionssignatur
  content = content.replace(
    /const loadPruefungsinhalte = async \(pruefungId, graduierungId\) => {/,
    'const loadPruefungsinhalte = async (pruefungId, stilId, graduierungId) => {'
  );

  // 2. Korrigiere API-Call
  content = content.replace(
    /\$\{API_BASE_URL\}\/stile\/graduierungen\/\$\{graduierungId\}\/pruefungsinhalte/,
    '${API_BASE_URL}/stile/${stilId}/graduierungen/${graduierungId}/pruefungsinhalte'
  );

  // 3. Korrigiere Funktionsaufruf
  content = content.replace(
    /loadPruefungsinhalte\(pruefling\.pruefung_id, targetGurt\?\.id \|\| pruefling\.graduierung_nachher_id\);/,
    'loadPruefungsinhalte(pruefling.pruefung_id, pruefling.stil_id, targetGurt?.id || pruefling.graduierung_nachher_id);'
  );

  fs.writeFile(filePath, content, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('❌ Schreibfehler:', writeErr);
      process.exit(1);
    }

    console.log('✅ Route erfolgreich korrigiert!');
    console.log('📍 Neue Route: /api/stile/:stilId/graduierungen/:graduierungId/pruefungsinhalte');
    process.exit(0);
  });
});
