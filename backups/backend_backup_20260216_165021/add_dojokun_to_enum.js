const db = require('./db.js');

const alterTableSQL = `
ALTER TABLE vertragsdokumente
MODIFY COLUMN dokumenttyp ENUM('agb', 'datenschutz', 'widerruf', 'hausordnung', 'dojokun', 'haftung', 'sonstiges') NOT NULL;
`;

db.query(alterTableSQL, (err, result) => {
    if (err) {
        console.error('❌ Fehler beim Erweitern des ENUM:', err);
        process.exit(1);
    }
    console.log('✅ dokumenttyp ENUM erfolgreich erweitert - dojokun hinzugefügt');
    process.exit(0);
});
