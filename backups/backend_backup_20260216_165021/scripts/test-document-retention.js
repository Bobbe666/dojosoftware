/**
 * Test-Script für die Aufbewahrungsfristen-Prüfung
 *
 * Führt die automatische Löschung von abgelaufenen Dokumenten und Rechnungen manuell aus
 * Nützlich für Tests und Debugging
 *
 * Ausführung:
 *   node scripts/test-document-retention.js
 */

const { pruefeDokumentenAufbewahrung } = require('../services/documentRetentionService');

console.log('\n⚡ Manueller Test der Aufbewahrungsfristen-Prüfung\n');
console.log('HINWEIS: Dieses Script führt echte Löschungen durch!');
console.log('         Nur in Test-Umgebungen verwenden.\n');

// Führe die Prüfung aus
pruefeDokumentenAufbewahrung()
  .then((result) => {
    console.log('\n✅ Test abgeschlossen');
    console.log('Ergebnis:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test fehlgeschlagen:', error);
    process.exit(1);
  });
