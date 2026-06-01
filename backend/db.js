const mysql = require('mysql2');
require('dotenv').config();

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error("❌ KRITISCHER FEHLER: Datenbank-Konfiguration fehlt!");
    process.exit(1);
}

const db = mysql.createPool({
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 50,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    queueLimit: 200,
    charset: 'UTF8MB4_UNICODE_CI',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 15000,
});

// Charset für jede neue Verbindung setzen
db.on('connection', (connection) => {
    connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'", (err) => {
        if (err) console.error("⚠️ Charset-Fehler:", err.message);
        else console.log("✅ Verbunden mit MySQL als ID", connection.threadId, "— Charset utf8mb4 gesetzt");
    });
});

// Pool-Fehler abfangen — niemals werfen, Prozess läuft weiter
db.on('error', (err) => {
    console.error("⚠️ MySQL Pool-Fehler (wird ignoriert):", err.code || err.message);
});

module.exports = db;
