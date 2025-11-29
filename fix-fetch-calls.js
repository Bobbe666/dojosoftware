// Node.js Script zum Fixen von direkten fetch() Calls
// Fügt config.apiBaseUrl vor relative Pfade hinzu
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            processFile(filePath);
        }
    });
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let changed = false;

    // Pattern 1: fetch('/XXX') → fetch(`${config.apiBaseUrl}/XXX`)
    // Aber NICHT wenn es schon config.apiBaseUrl hat oder http:// oder https://
    const fetchPattern = /fetch\(\s*(['"`])(\/)([^'"`]+)\1/g;

    content = content.replace(fetchPattern, (match, quote, slash, path) => {
        // Skip wenn der Pfad schon mit http beginnt oder $ enthält (Template-String)
        if (path.startsWith('http') || match.includes('${')) {
            return match;
        }
        changed = true;
        return `fetch(\`\${config.apiBaseUrl}/${path}\``;
    });

    // Stelle sicher, dass config importiert ist
    if (changed && !content.includes("import config from")) {
        // Finde die letzte import-Zeile
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }

        if (lastImportIndex >= 0) {
            lines.splice(lastImportIndex + 1, 0, "import config from '../config/config.js';");
            content = lines.join('\n');
        }
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Gefixt: ${path.relative(process.cwd(), filePath)}`);
    }
}

console.log('🔧 Fixe direkte fetch() Calls...\n');
walkDir(srcDir);
console.log('\n✅ Fertig!');
