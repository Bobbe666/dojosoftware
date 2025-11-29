// Node.js Script zum Entfernen von /api/ Prefix
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

    // Ersetze '/api/XXX' mit '/XXX'
    content = content.replace(/(['"`])\/api\//g, '$1/');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Gefixt: ${path.relative(process.cwd(), filePath)}`);
    }
}

console.log('🔧 Entferne /api/ Prefixe...\n');
walkDir(srcDir);
console.log('\n✅ Fertig!');
