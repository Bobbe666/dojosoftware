#!/usr/bin/env node
/**
 * Script zum Ersetzen von console.log durch strukturierten Logger
 * 
 * Verwendung:
 *   node scripts/replace-console-log.js [--dry-run]
 * 
 * Mit --dry-run werden nur Vorschläge angezeigt, keine Änderungen vorgenommen
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('🔍 DRY RUN Modus - keine Änderungen werden gespeichert\n');
} else {
  console.log('⚠️  LIVE Modus - Dateien werden geändert!\n');
}

// Finde alle JavaScript-Dateien in routes/
const files = glob.sync(path.join(__dirname, '../routes/**/*.js'));

console.log(`📁 Gefundene Dateien: ${files.length}\n`);

let totalReplacements = 0;
const changes = [];

files.forEach(file => {
  const relativePath = path.relative(path.join(__dirname, '..'), file);
  const content = fs.readFileSync(file, 'utf8');
  
  // Prüfe ob logger bereits importiert ist
  const hasLogger = content.includes('require') && content.includes('logger');
  const hasConsoleLog = content.includes('console.log') || content.includes('console.error');
  
  if (!hasConsoleLog) return;
  
  let newContent = content;
  let fileReplacements = 0;
  
  // Füge Logger-Import hinzu wenn nicht vorhanden
  if (!hasLogger) {
    // Finde die richtige Stelle für den Import (nach anderen requires)
    const requireRegex = /const .+ = require\(.+\);/g;
    const matches = [...content.matchAll(requireRegex)];
    
    if (matches.length > 0) {
      const lastRequire = matches[matches.length - 1];
      const insertPos = lastRequire.index + lastRequire[0].length;
      newContent = 
        newContent.slice(0, insertPos) + 
        '\nconst logger = require(\'../utils/logger\');' +
        newContent.slice(insertPos);
      fileReplacements++;
    }
  }
  
  // Ersetze console.error durch logger.error
  const errorPattern = /console\.error\((.*?)\);/g;
  newContent = newContent.replace(errorPattern, (match, args) => {
    fileReplacements++;
    // Einfacher Fall: nur ein String
    if (args.trim().startsWith('"') || args.trim().startsWith("'")) {
      return `logger.error(${args});`;
    }
    // Komplexer Fall mit mehreren Argumenten - als Objekt formatieren
    return `logger.error('Error', { details: ${args} });`;
  });
  
  // Ersetze console.log durch logger.info (nur einfache Fälle)
  const logPattern = /console\.log\(["'](.+?)["']\);/g;
  newContent = newContent.replace(logPattern, (match, message) => {
    fileReplacements++;
    return `logger.info('${message}');`;
  });
  
  if (fileReplacements > 0) {
    totalReplacements += fileReplacements;
    changes.push({ file: relativePath, count: fileReplacements });
    
    console.log(`✏️  ${relativePath}: ${fileReplacements} Änderungen`);
    
    if (!DRY_RUN) {
      fs.writeFileSync(file, newContent, 'utf8');
    }
  }
});

console.log(`\n📊 Zusammenfassung:`);
console.log(`   Dateien geprüft: ${files.length}`);
console.log(`   Dateien geändert: ${changes.length}`);
console.log(`   Gesamt-Ersetzungen: ${totalReplacements}`);

if (DRY_RUN) {
  console.log('\n💡 Führe ohne --dry-run aus um Änderungen zu speichern');
} else {
  console.log('\n✅ Änderungen gespeichert!');
  console.log('\n⚠️  WICHTIG: Prüfe die Änderungen mit git diff und teste die Anwendung!');
  console.log('   Manche console.log Aufrufe müssen manuell angepasst werden.');
}
