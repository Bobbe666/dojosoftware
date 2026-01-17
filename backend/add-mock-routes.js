const fs = require('fs');
const path = require('path');

// Routes die Mock-Daten brauchen
const routesToFix = [
  {
    file: 'stileguertel.js',
    routeName: 'GET /',
    mockResponse: `
  // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment) {
    console.log('🔧 Development Mode: Verwende Mock-Stile');
    const { MOCK_STILE } = require('../mockData');
    return res.json(MOCK_STILE);
  }
`
  }
];

// Funktion zum Hinzufügen von Mock-Daten zu Routen
function addMockToRoute(filePath, mockCode) {
  if (!fs.existsSync(filePath)) {
    console.log(`Datei nicht gefunden: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Prüfe ob Mock-Code bereits vorhanden ist
  if (content.includes('isDevelopment') && content.includes('Mock')) {
    console.log(`Mock-Daten bereits vorhanden in: ${filePath}`);
    return false;
  }

  console.log(`Mock-Daten hinzugefügt zu: ${filePath}`);
  return true;
}

console.log('Mock-Data-Installer bereit!');
console.log('Verwende require() in den Routes statt diesem Script.');
