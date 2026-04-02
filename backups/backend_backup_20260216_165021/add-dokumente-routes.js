const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
const content = fs.readFileSync(serverPath, 'utf8');

const searchPattern = `try {
  const mitgliederRoutes = require('./routes/mitglieder');
  app.use('/api/mitglieder', mitgliederRoutes);
  console.log("✅ API MOUNTED: /api/mitglieder");
} catch (error) {
  console.error("❌ Failed to load mitglieder.js:", error.message);
}`;

const newRoutes = `
try {
  const mitgliederDokumenteRoutes = require('./routes/mitgliederDokumente');
  app.use('/api/mitglieder', mitgliederDokumenteRoutes);
  console.log("✅ API MOUNTED: /api/mitglieder (dokumente)");
} catch (error) {
  console.error("❌ Failed to load mitgliederDokumente.js:", error.message);
}`;

// Check if already added
if (content.includes('mitgliederDokumente')) {
  console.log('✅ Routes already added');
  process.exit(0);
}

const newContent = content.replace(
  searchPattern,
  searchPattern + newRoutes
);

if (newContent === content) {
  console.error('❌ Pattern not found');
  process.exit(1);
}

fs.writeFileSync(serverPath, newContent, 'utf8');
console.log('✅ Routes added successfully');
