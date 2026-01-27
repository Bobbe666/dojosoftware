const fs = require('fs');
const db = require('./db');

console.log('🚀 Starte Fortschritts-Tracking Setup...');

// SQL-Datei lesen
const sqlFile = fs.readFileSync('./database/create_fortschritt_tracking.sql', 'utf8');

// SQL-Befehle in einzelne Statements aufteilen
// Beachte: Wir müssen DELIMITER-Blöcke speziell behandeln
const statements = [];
let currentStatement = '';
let inDelimiter = false;
let customDelimiter = false;

const lines = sqlFile.split('\n');

for (let line of lines) {
    const trimmedLine = line.trim();

    // Skip Kommentare
    if (trimmedLine.startsWith('--') || trimmedLine.startsWith('//') || trimmedLine === '') {
        continue;
    }

    // DELIMITER Handling
    if (trimmedLine.startsWith('DELIMITER')) {
        if (trimmedLine.includes('//')) {
            customDelimiter = true;
            inDelimiter = true;
        } else if (trimmedLine.includes(';')) {
            customDelimiter = false;
            inDelimiter = false;
        }
        continue;
    }

    currentStatement += line + '\n';

    // Ende eines Statements
    if (customDelimiter && inDelimiter) {
        // Bei Custom Delimiter (Trigger/Procedures)
        if (trimmedLine.endsWith('//')) {
            statements.push(currentStatement.trim().slice(0, -2)); // Entferne '//' am Ende
            currentStatement = '';
        }
    } else {
        // Normaler ; Delimiter
        if (trimmedLine.endsWith(';')) {
            statements.push(currentStatement.trim());
            currentStatement = '';
        }
    }
}

// Letztes Statement falls noch etwas übrig ist
if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
}

console.log(`📝 Gefundene SQL-Statements: ${statements.length}`);

// Statements nacheinander ausführen
let executedCount = 0;
let errorCount = 0;

function executeNext(index) {
    if (index >= statements.length) {
        console.log(`\n✅ Setup abgeschlossen!`);
        console.log(`   Erfolgreich: ${executedCount}`);
        console.log(`   Fehler: ${errorCount}`);
        process.exit(0);
        return;
    }

    const statement = statements[index];

    // Skip leere Statements
    if (!statement || statement.length < 5) {
        executeNext(index + 1);
        return;
    }

    db.query(statement, (err, results) => {
        if (err) {
            // Ignoriere "Table already exists" Fehler
            if (!err.message.includes('already exists')) {
                console.error(`❌ Fehler bei Statement ${index + 1}:`, err.message);
                console.error(`   Statement: ${statement.substring(0, 100)}...`);
                errorCount++;
            } else {
                console.log(`⚠️  Tabelle existiert bereits (Statement ${index + 1})`);
                executedCount++;
            }
        } else {
            executedCount++;
            const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
            console.log(`✓ Statement ${index + 1}: ${preview}...`);
        }

        // Nächstes Statement
        executeNext(index + 1);
    });
}

// Starte Ausführung
executeNext(0);
