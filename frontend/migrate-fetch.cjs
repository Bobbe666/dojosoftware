#!/usr/bin/env node
/**
 * Migration Script: Ersetzt fetch() mit fetchWithAuth() in allen Komponenten
 *
 * Dieses Script:
 * 1. Findet alle .jsx Dateien mit fetch() Calls
 * 2. Fügt import für fetchWithAuth hinzu
 * 3. Ersetzt fetch( mit fetchWithAuth(
 * 4. Erstellt Backup der Originaldateien
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const componentsDir = path.join(__dirname, 'src', 'components');
const backupDir = path.join(__dirname, 'src', 'components', '.migration-backup');

// Erstelle Backup-Verzeichnis
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Liste aller zu migrierenden Dateien
const componentFiles = [
  'AdminRegistrationPopup.jsx',
  'AdminVerwaltung.jsx',
  'Anwesenheit.jsx',
  'ArtikelFormular.jsx',
  'ArtikelgruppenVerwaltung.jsx',
  'ArtikelVerwaltung.jsx',
  'Beitraege.jsx',
  'BerichteDokumente.jsx',
  'CourseSelectionModal.jsx',
  'DojoEdit.jsx',
  'EinstellungenDojo.jsx',
  'EinstellungenMitgliedschaften.jsx',
  'Finanzcockpit.jsx',
  'Kurse.jsx',
  'Lastschriftlauf.jsx',
  'MahnstufenEinstellungen.jsx',
  'Mahnwesen.jsx',
  'MemberDashboard.jsx',
  'MemberStyles.jsx',
  'MitgliederFilter.jsx',
  'NotificationSystem.jsx',
  'PublicRegistration.jsx',
  'RaumVerwaltung.jsx',
  'Rechnungsverwaltung.jsx',
  'SepaMandateVerwaltung.jsx',
  'TarifePreiseOld.jsx',
  'TestNotificationButton.jsx',
  'TrainingReminders.jsx',
  'TresenUebersicht.jsx',
  'Zahllaeufe.jsx',
  'ZahlungsEinstellungen.jsx',
  'ZahlungszyklenSepa.jsx',
];

let migratedCount = 0;
let skippedCount = 0;
let errorCount = 0;

console.log('🚀 Starte Fetch-Migration...\n');

componentFiles.forEach((filename) => {
  const filePath = path.join(componentsDir, filename);

  // Überspringe, wenn Datei nicht existiert
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Überspringe: ${filename} (nicht gefunden)`);
    skippedCount++;
    return;
  }

  try {
    // Lese Datei
    let content = fs.readFileSync(filePath, 'utf8');

    // Überspringe, wenn kein fetch() vorhanden
    if (!content.includes('fetch(') && !content.includes('fetch `')) {
      console.log(`⏭️  Überspringe: ${filename} (kein fetch gefunden)`);
      skippedCount++;
      return;
    }

    // Überspringe, wenn bereits migriert
    if (content.includes('fetchWithAuth')) {
      console.log(`✅ Bereits migriert: ${filename}`);
      skippedCount++;
      return;
    }

    // Erstelle Backup
    const backupPath = path.join(backupDir, filename);
    fs.writeFileSync(backupPath, content, 'utf8');

    // 1. Füge Import hinzu (nach dem letzten import)
    const importRegex = /(import\s+.*?;[\s\S]*?)(\n\n)/;
    const fetchImport = "import { fetchWithAuth } from '../utils/fetchWithAuth';\n";

    if (!content.includes("from '../utils/fetchWithAuth'")) {
      if (importRegex.test(content)) {
        content = content.replace(importRegex, `$1\n${fetchImport}$2`);
      } else {
        // Falls keine Imports vorhanden, füge am Anfang hinzu
        content = fetchImport + '\n' + content;
      }
    }

    // 2. Ersetze fetch( mit fetchWithAuth(
    // Aber NICHT bei: .then(response => response.json())
    content = content.replace(/\bfetch\s*\(/g, 'fetchWithAuth(');
    content = content.replace(/\bfetch\s*`/g, 'fetchWithAuth`');

    // Schreibe zurück
    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`✅ Migriert: ${filename}`);
    migratedCount++;
  } catch (error) {
    console.error(`❌ Fehler bei ${filename}:`, error.message);
    errorCount++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ Migriert: ${migratedCount}`);
console.log(`⏭️  Übersprungen: ${skippedCount}`);
console.log(`❌ Fehler: ${errorCount}`);
console.log('='.repeat(50));
console.log(`\n💾 Backups gespeichert in: ${backupDir}`);
console.log('\n✨ Migration abgeschlossen!');
